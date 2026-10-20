"""FastAPI backend for the Smart Reservoir DSS.

Dev:   uvicorn app.main:app --reload --port 8000   (run from backend/)
"""
import threading
from contextlib import asynccontextmanager
from typing import Literal

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import config as C
from .benchmark import benchmark
from .recommend import build_window, recommend, run
from .simulation import classify, worst_zone
from .store import get_store

@asynccontextmanager
async def lifespan(_app):
    """Load data and pre-compute the benchmark in the background (~10 s)."""
    get_store()
    threading.Thread(target=benchmark, daemon=True).start()
    yield


app = FastAPI(title="Smart Reservoir DSS", version="1.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.mount("/plots/krs", StaticFiles(directory=C.RAW / "krs"), name="plots_krs")
app.mount("/plots/srisailam", StaticFiles(directory=C.RAW / "srisailam"), name="plots_sri")


def records(df: pd.DataFrame) -> list[dict]:
    """JSON-safe records (NaN -> null, dates -> ISO strings)."""
    out = df.copy()
    for c in out.columns:
        if pd.api.types.is_datetime64_any_dtype(out[c]):
            out[c] = out[c].dt.strftime("%Y-%m-%d")
    return out.replace({np.nan: None}).to_dict(orient="records")


@app.get("/api/reservoirs")
def reservoirs():
    s = get_store()
    start, end = s.decision_dates
    return [
        {"id": "krs", "name": "K.R. Sagara (KRS)", "river": "Cauvery", "state": "Karnataka",
         "role": "Main case: measured inflow, full forecast-simulate-recommend pipeline",
         "decision_range": [start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d")],
         "history_range": [s.krs.index.min().strftime("%Y-%m-%d"), s.krs.index.max().strftime("%Y-%m-%d")]},
        {"id": "srisailam", "name": "Srisailam", "river": "Krishna", "state": "Andhra Pradesh / Telangana",
         "role": "Limited second case: net storage change only, no release data"},
    ]


@app.get("/api/krs/thresholds")
def thresholds():
    s = get_store()
    return {
        "frl": {"gauge_ft": C.FRL_GAUGE_FT, "datum_ft": C.FRL_GAUGE_FT + C.GAUGE_DATUM_OFFSET_FT, "gross_tmc": C.FRL_TMC},
        "mddl": {"gauge_ft": C.MDDL_GAUGE_FT, "datum_ft": C.MDDL_GAUGE_FT + C.GAUGE_DATUM_OFFSET_FT, "gross_tmc": C.MDDL_TMC},
        "dead_storage_tmc": C.DEAD_STORAGE_TMC,
        "caution_tmc": C.CAUTION_FRACTION * C.FRL_TMC,
        "low_tmc": C.MDDL_TMC + C.LOW_BUFFER_TMC,
        "cusecs_per_tmc_day": C.CUSECS_PER_TMC_DAY,
        "max_release_cusecs": C.MAX_RELEASE_CUSECS,
        "level_curve": records(s.curve),
        "source": "KRS O&M manual (via Person A); cross-checked against bulletin data. Verify against manual pages before citing.",
    }


@app.get("/api/krs/history")
def history(start: str | None = Query(None, alias="from"), end: str | None = Query(None, alias="to"),
            step: int = Query(1, ge=1, le=31)):
    k = get_store().krs.loc[start:end]
    if step > 1:
        k = k.iloc[::step]
    cols = ["gross_tmc", "live_tmc", "gauge_ft", "pct_full_calc", "inflow_cusecs", "outflow_cusecs",
            "withdrawal_cusecs", "evaporation_cusecs"]
    return records(k[cols].round(3).reset_index())


@app.get("/api/krs/day/{date}")
def day(date: str):
    k = get_store().krs
    d = pd.Timestamp(date)
    if d not in k.index:
        raise HTTPException(404, "date out of range")
    row = k.loc[d]
    prev = k.loc[:d].iloc[-8:]
    return {
        "date": date, **{c: (None if pd.isna(row[c]) else float(row[c])) for c in
                         ["gross_tmc", "live_tmc", "gauge_ft", "pct_full_calc", "inflow_cusecs", "outflow_cusecs",
                          "withdrawal_cusecs", "evaporation_cusecs"]},
        "zone": classify(row.gross_tmc) if pd.notna(row.gross_tmc) else None,
        "storage_change_7d_tmc": float(prev.gross_tmc.iloc[-1] - prev.gross_tmc.iloc[0]),
    }


@app.get("/api/krs/forecast")
def forecast(start: str | None = Query(None, alias="from"), end: str | None = Query(None, alias="to")):
    f = get_store().fc_by_target.loc[start:end].reset_index()
    return records(f)


@app.get("/api/krs/metrics")
def krs_metrics():
    m = get_store().meta["krs_metrics"]
    f = get_store().forecast
    inside = ((f.actual_inflow_cusecs >= f.lower_bound_cusecs) & (f.actual_inflow_cusecs <= f.upper_bound_cusecs)).mean()
    return {**m,
            "coverage_80_band_pct": round(100 * inside, 1),
            "comparison": {"random_forest": {"rmse": 8900.4, "mae": 2971.8, "r2": 0.449, "log_rmse": 1.064},
                           "xgboost": {"rmse": 8811.8, "mae": 2974.6, "r2": 0.460, "log_rmse": 1.284}},
            "top_features": ["7-day storage change", "Day of year", "3-day rainfall average", "Storage"]}


@app.get("/api/krs/recommend")
def krs_recommend(date: str, horizon: int = Query(3, ge=1, le=7)):
    try:
        return recommend(build_window(get_store(), date, horizon))
    except ValueError as e:
        raise HTTPException(422, str(e))


class SimRequest(BaseModel):
    date: str
    horizon: int = Field(3, ge=1, le=7)
    release_cusecs: float | list[float] = 10000
    inflow_series: Literal["predicted", "lower", "upper", "actual"] = "predicted"


@app.post("/api/krs/simulate")
def krs_simulate(req: SimRequest):
    try:
        win = build_window(get_store(), req.date, req.horizon)
    except ValueError as e:
        raise HTTPException(422, str(e))
    if isinstance(req.release_cusecs, list) and len(req.release_cusecs) != req.horizon:
        raise HTTPException(422, "release list length must equal horizon")
    traj = run(win, req.release_cusecs, req.inflow_series)
    return {"dates": [win.decision_date.strftime("%Y-%m-%d")] + [d.strftime("%Y-%m-%d") for d in win.dates],
            "trajectory": traj, "zones": [classify(s) for s in traj], "status": worst_zone(traj),
            "spill_days": sum(s > C.FRL_TMC for s in traj[1:])}


@app.get("/api/krs/benchmark")
def krs_benchmark():
    return benchmark()


@app.get("/api/srisailam/forecast")
def sri_forecast():
    return records(get_store().srisailam)


@app.get("/api/srisailam/metrics")
def sri_metrics():
    return get_store().meta["srisailam_metrics"]


# Serve the built React app (production / single-command demo)
if C.FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=C.FRONTEND_DIST / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        f = C.FRONTEND_DIST / path
        return FileResponse(f if path and f.is_file() else C.FRONTEND_DIST / "index.html")
