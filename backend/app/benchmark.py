"""Benchmark the recommender against what KRS operators actually released.

For every decision day in the test period we compute the Recommended release
(3-day horizon), then replay those 3 days with the *actual* inflow to see
whether the recommendation would have kept storage below FRL. That is compared
with the actual release and the actual storage the operators achieved.
"""
from functools import lru_cache

import numpy as np
import pandas as pd

from . import config as C
from .recommend import build_window, recommend, run
from .store import get_store

HORIZON = 3


@lru_cache(maxsize=1)
def benchmark() -> dict:
    store = get_store()
    start, end = store.decision_dates
    rows = []
    for d in pd.date_range(start, end, freq="D"):
        try:
            win = build_window(store, d, HORIZON)
        except ValueError:
            continue
        if any(np.isnan(win.inflow_cusecs["actual"])) or any(np.isnan(win.actual_release_cusecs)):
            continue
        rec = recommend(win)["scenarios"][1]
        replay = run(win, rec["release_cusecs"], "actual")
        rows.append({
            "date": d,
            "recommended_cusecs": rec["release_cusecs"],
            "actual_release_cusecs": float(np.mean(win.actual_release_cusecs)),
            "actual_inflow_cusecs": float(np.mean(win.inflow_cusecs["actual"])),
            "storage_tmc": win.initial_storage_tmc,
            "replay_max_tmc": max(replay[1:]),
            "actual_max_tmc": float(np.nanmax(win.actual_storage_tmc)),
        })
    df = pd.DataFrame(rows)
    tol = 0.05  # TMC; bulletin storage at FRL fluctuates by a few hundredths
    df["replay_over_frl"] = df.replay_max_tmc > C.FRL_TMC + tol
    df["actual_over_frl"] = df.actual_max_tmc > C.FRL_TMC + tol

    monthly = (df.set_index("date")[["recommended_cusecs", "actual_release_cusecs", "actual_inflow_cusecs", "storage_tmc"]]
                 .resample("MS").mean().dropna().reset_index())
    monthly["date"] = monthly.date.dt.strftime("%Y-%m")

    def case(start, stop, title, note):
        c = df[(df.date >= start) & (df.date <= stop)]
        return {
            "title": title, "note": note,
            "series": [{"date": r.date.strftime("%Y-%m-%d"), "recommended": r.recommended_cusecs,
                        "actual_release": round(r.actual_release_cusecs), "inflow": round(r.actual_inflow_cusecs),
                        "storage": round(r.storage_tmc, 3)} for r in c.itertuples()],
            "peak_inflow": float(c.actual_inflow_cusecs.max()),
            "peak_actual_release": float(c.actual_release_cusecs.max()),
            "peak_recommended": float(c.recommended_cusecs.max()),
        }

    total_rec = df.recommended_cusecs.sum() / C.CUSECS_PER_TMC_DAY
    total_act = df.actual_release_cusecs.sum() / C.CUSECS_PER_TMC_DAY
    return {
        "days": len(df),
        "period": [df.date.min().strftime("%Y-%m-%d"), df.date.max().strftime("%Y-%m-%d")],
        "replay_days_over_frl": int(df.replay_over_frl.sum()),
        "actual_days_over_frl": int(df.actual_over_frl.sum()),
        "pct_days_safe": float(100 * (1 - df.replay_over_frl.mean())),
        "total_recommended_tmc": float(total_rec),
        "total_actual_tmc": float(total_act),
        "correlation": float(df.recommended_cusecs.corr(df.actual_release_cusecs)),
        "monthly": monthly.round(1).to_dict(orient="records"),
        "case_studies": [
            case("2018-06-01", "2018-09-30", "2018 South-West monsoon",
                 "The year of the Kerala floods. Heavy Kodagu/Wayanad rain drove KRS inflows above 1 lakh cusecs in August."),
            case("2019-07-15", "2019-09-30", "2019 monsoon",
                 "A late but intense monsoon after a dry June. The reservoir refilled from ~23% in early July."),
        ],
    }
