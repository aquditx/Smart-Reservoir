"""Load Person A/B data, clean it and persist it to SQLite.

Run directly to (re)build the database:  python -m app.etl
"""
import json
import sqlite3

import numpy as np
import pandas as pd

from . import config as C

KRS_COLS = {
    "Monitoring Date": "raw_date",
    "Percentage Full": "pct_full",
    "Reservoir Level (ft)": "level_ft",
    "Gross Capacity (TMC)": "gross_tmc",
    "Live Capacity (TMC)": "live_tmc",
    "Inflow (Cusecs)": "inflow_cusecs",
    "Outflow to River (Cusecs)": "outflow_cusecs",
    "Canal Withdrawal (Cusecs)": "withdrawal_cusecs",
    "Evaporation (Cusecs)": "evaporation_cusecs",
}


def load_krs() -> pd.DataFrame:
    df = pd.read_csv(C.RAW / "krs" / "karnataka_man_reservoir_data.csv")
    # Column names contain embedded newlines (same fix Person C used)
    df.columns = [" ".join(str(c).split()) for c in df.columns]
    k = df[df["Reservoir Name"].astype(str).str.strip() == C.KRS_NAME]
    k = k[list(KRS_COLS)].rename(columns=KRS_COLS)

    k["date"] = pd.to_datetime(k["raw_date"], format="%d-%m-%Y %H:%M:%S", errors="coerce").dt.normalize()
    num = [c for c in KRS_COLS.values() if c != "raw_date"]
    for c in num:
        k[c] = pd.to_numeric(k[c], errors="coerce")
    k = (k.dropna(subset=["date"]).sort_values("date")
          .drop_duplicates("date", keep="last").drop(columns="raw_date"))

    # Outlier masking: values that are physically impossible for KRS
    bad_level = (k.level_ft < 2380) | (k.level_ft > 2475)
    k.loc[bad_level, "level_ft"] = np.nan
    bad_storage = (k.gross_tmc > C.FRL_TMC * 1.05) | (k.gross_tmc < 1)
    k.loc[bad_storage, ["gross_tmc", "live_tmc"]] = np.nan
    for c in ["inflow_cusecs", "outflow_cusecs", "withdrawal_cusecs", "evaporation_cusecs"]:
        k.loc[k[c] < 0, c] = np.nan

    k = k.set_index("date").asfreq("D")
    # Short gaps in storage/level are interpolated; flows are left as-is
    k[["gross_tmc", "live_tmc", "level_ft"]] = k[["gross_tmc", "live_tmc", "level_ft"]].interpolate(limit=5)
    k["evaporation_cusecs"] = k["evaporation_cusecs"].ffill(limit=31)
    k["gauge_ft"] = k.level_ft - C.GAUGE_DATUM_OFFSET_FT
    k["pct_full_calc"] = 100 * k.gross_tmc / C.FRL_TMC
    return k.reset_index()


def load_forecast() -> pd.DataFrame:
    f = pd.read_csv(C.RAW / "krs" / "forecast_output.csv", parse_dates=["date"])
    f = f.rename(columns={"date": "origin_date"})
    f["target_date"] = f.origin_date + pd.Timedelta(days=C.FORECAST_HORIZON_DAYS)
    return f


def load_srisailam() -> pd.DataFrame:
    return pd.read_csv(C.RAW / "srisailam" / "srisailam_forecast_output.csv", parse_dates=["date"])


def level_storage_curve(k: pd.DataFrame) -> pd.DataFrame:
    """Empirical gauge-level -> gross-storage curve (median per 0.5 ft bin)."""
    x = k.dropna(subset=["gauge_ft", "gross_tmc"])
    x = x[(x.gauge_ft > 55) & (x.gauge_ft <= C.FRL_GAUGE_FT + 0.01)]
    bins = (x.gauge_ft * 2).round() / 2
    curve = x.groupby(bins).gross_tmc.median().rename_axis("gauge_ft").reset_index()
    curve["gross_tmc"] = np.maximum.accumulate(curve.gross_tmc.values)  # enforce monotone
    return curve


def build() -> None:
    krs = load_krs()
    fc = load_forecast()
    sri = load_srisailam()
    curve = level_storage_curve(krs)

    C.DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(C.DB_PATH) as con:
        krs.assign(date=krs.date.dt.strftime("%Y-%m-%d")).to_sql("krs_daily", con, if_exists="replace", index=False)
        fc.assign(origin_date=fc.origin_date.dt.strftime("%Y-%m-%d"),
                  target_date=fc.target_date.dt.strftime("%Y-%m-%d")).to_sql("krs_forecast", con, if_exists="replace", index=False)
        sri.assign(date=sri.date.dt.strftime("%Y-%m-%d")).to_sql("srisailam_forecast", con, if_exists="replace", index=False)
        curve.to_sql("krs_level_curve", con, if_exists="replace", index=False)
        meta = {
            "krs_metrics": json.loads((C.RAW / "krs" / "metrics_summary.json").read_text()),
            "srisailam_metrics": json.loads((C.RAW / "srisailam" / "srisailam_metrics.json").read_text()),
        }
        con.execute("DROP TABLE IF EXISTS meta")
        con.execute("CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT)")
        con.executemany("INSERT INTO meta VALUES (?, ?)", [(k, json.dumps(v)) for k, v in meta.items()])
    print(f"KRS days: {len(krs)}  forecast rows: {len(fc)}  srisailam rows: {len(sri)}  curve points: {len(curve)}")
    print(f"Database written to {C.DB_PATH}")


if __name__ == "__main__":
    build()
