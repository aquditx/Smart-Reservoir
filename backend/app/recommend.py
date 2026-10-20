"""Scenario-based release recommendation (slide 25 logic).

    Current storage + forecast inflow - losses      -> storage if we release nothing
    How much release keeps each day below FRL?      -> R_k = (S_k^no-release - FRL) / k
    Take the largest over the forecast days         -> minimum feasible constant release

Scenarios (constant release over the horizon, cusecs):
  * Conservative - R_min on the predicted (median) inflow: holds the most water.
  * Recommended  - R_min on the upper (90th pct) inflow: stays below FRL even if
                   inflow comes in at the top of the forecast band.
  * Aggressive   - keeps storage below the flood-cushion level (95% of FRL) under
                   the upper inflow: maximum flood safety, least water retained.
All are capped at R_max, the largest release that keeps storage above MDDL.
"""
from dataclasses import dataclass

import numpy as np
import pandas as pd

from . import config as C
from .simulation import classify, cusecs_to_tmc, simulate_storage, tmc_to_cusecs, worst_zone

SERIES = {"predicted": "predicted_inflow_cusecs", "lower": "lower_bound_cusecs",
          "upper": "upper_bound_cusecs", "actual": "actual_inflow_cusecs"}


@dataclass
class Window:
    """Everything needed to simulate from decision date D over D+1..D+H."""
    decision_date: pd.Timestamp
    initial_storage_tmc: float
    dates: list[pd.Timestamp]
    inflow_cusecs: dict[str, list[float]]  # keyed by SERIES name
    withdrawal_cusecs: list[float]
    evaporation_cusecs: list[float]
    actual_release_cusecs: list[float]
    actual_storage_tmc: list[float]


def build_window(store, decision_date, horizon: int) -> Window:
    d = pd.Timestamp(decision_date).normalize()
    k = store.krs
    if d not in k.index or pd.isna(k.at[d, "gross_tmc"]):
        raise ValueError(f"No storage observation on {d.date()}")
    dates = [d + pd.Timedelta(days=i) for i in range(1, horizon + 1)]
    fc = store.fc_by_target.reindex(dates)
    if fc["predicted_inflow_cusecs"].isna().any():
        raise ValueError(f"Forecast not available for every day {dates[0].date()}..{dates[-1].date()}")

    # Withdrawal and evaporation: last values known on the decision date (persistence),
    # which is what an operator would actually have when deciding.
    today = k.loc[d]
    w = float(np.nan_to_num(today.withdrawal_cusecs))
    e = float(np.nan_to_num(today.evaporation_cusecs))
    obs = k.reindex(dates)
    return Window(
        decision_date=d,
        initial_storage_tmc=float(today.gross_tmc),
        dates=dates,
        inflow_cusecs={name: fc[col].astype(float).fillna(0).tolist() for name, col in SERIES.items()},
        withdrawal_cusecs=[w] * horizon,
        evaporation_cusecs=[e] * horizon,
        actual_release_cusecs=obs.outflow_cusecs.astype(float).tolist(),
        actual_storage_tmc=obs.gross_tmc.astype(float).tolist(),
    )


def run(win: Window, release_cusecs, series: str = "predicted") -> list[float]:
    rel = release_cusecs if isinstance(release_cusecs, (list, tuple)) else [release_cusecs] * len(win.dates)
    return simulate_storage(
        win.initial_storage_tmc,
        [cusecs_to_tmc(q) for q in win.inflow_cusecs[series]],
        [cusecs_to_tmc(q) for q in rel],
        [cusecs_to_tmc(q) for q in win.withdrawal_cusecs],
        [cusecs_to_tmc(q) for q in win.evaporation_cusecs],
    )


def min_release_to_stay_below(win: Window, ceiling_tmc: float, series: str) -> tuple[float, list[dict]]:
    """Slide-25 calculation. Returns (release in cusecs, per-day working)."""
    no_release = run(win, 0.0, series)
    steps = []
    for k in range(1, len(no_release)):
        need_tmc_per_day = (no_release[k] - ceiling_tmc) / k
        steps.append({
            "date": win.dates[k - 1].strftime("%Y-%m-%d"),
            "day": k,
            "storage_if_no_release_tmc": no_release[k],
            "excess_over_ceiling_tmc": no_release[k] - ceiling_tmc,
            "required_release_cusecs": max(0.0, tmc_to_cusecs(need_tmc_per_day)),
        })
    return max(s["required_release_cusecs"] for s in steps), steps


def max_release_above_mddl(win: Window, series: str = "lower") -> float:
    """Largest constant release that keeps every day at or above MDDL."""
    no_release = run(win, 0.0, series)
    caps = [(no_release[k] - C.MDDL_TMC) / k for k in range(1, len(no_release))]
    return max(0.0, tmc_to_cusecs(min(caps)))


def _scenario(win, key, label, purpose, release, explanation):
    traj = {s: run(win, release, s) for s in ("predicted", "lower", "upper")}
    p = traj["predicted"]
    return {
        "key": key, "label": label, "purpose": purpose,
        "release_cusecs": round(release),
        "release_tmc_total": cusecs_to_tmc(release) * len(win.dates),
        "trajectory": p, "trajectory_lower": traj["lower"], "trajectory_upper": traj["upper"],
        "min_storage_tmc": min(p[1:]), "max_storage_tmc": max(p[1:]), "final_storage_tmc": p[-1],
        "max_storage_upper_tmc": max(traj["upper"][1:]),
        "status": worst_zone(p), "status_if_upper_inflow": worst_zone(traj["upper"]),
        "explanation": explanation,
    }


def recommend(win: Window) -> dict:
    r_max = max_release_above_mddl(win)
    r_cons, _ = min_release_to_stay_below(win, C.FRL_TMC, "predicted")
    r_rec, steps = min_release_to_stay_below(win, C.FRL_TMC, "upper")
    cushion = C.CAUTION_FRACTION * C.FRL_TMC
    r_aggr, _ = min_release_to_stay_below(win, cushion, "upper")
    r_cons, r_rec, r_aggr = (min(r, r_max) for r in (r_cons, r_rec, r_aggr))
    r_rec = max(r_rec, r_cons)
    r_aggr = max(r_aggr, r_rec)

    no_rel_pred = run(win, 0.0, "predicted")
    flood_pressure = max(no_rel_pred) > cushion
    def why(r, basis):
        if r <= 0:
            return (f"Storage stays below {basis} even with no river release, so only canal "
                    f"withdrawals are needed. Holding water protects supply for the dry season.")
        return (f"Without release, storage would exceed {basis}. A steady {r:,.0f} cusecs is the "
                f"smallest constant release that keeps every forecast day below it.")

    scenarios = [
        _scenario(win, "conservative", "Conservative", "Prioritises water supply", r_cons,
                  why(r_cons, f"FRL ({C.FRL_TMC} TMC) under the expected inflow")),
        _scenario(win, "recommended", "Recommended", "Balanced: robust to forecast uncertainty", r_rec,
                  why(r_rec, f"FRL ({C.FRL_TMC} TMC) even if inflow hits the 90th-percentile forecast")),
        _scenario(win, "aggressive", "Aggressive", "Prioritises flood safety", r_aggr,
                  why(r_aggr, f"the flood-cushion level ({cushion:.1f} TMC) under high inflow")),
    ]
    return {
        "decision_date": win.decision_date.strftime("%Y-%m-%d"),
        "dates": [d.strftime("%Y-%m-%d") for d in win.dates],
        "initial_storage_tmc": win.initial_storage_tmc,
        "initial_zone": classify(win.initial_storage_tmc),
        "inflow_cusecs": win.inflow_cusecs,
        "withdrawal_cusecs": win.withdrawal_cusecs,
        "evaporation_cusecs": win.evaporation_cusecs,
        "actual_release_cusecs": win.actual_release_cusecs,
        "actual_storage_tmc": win.actual_storage_tmc,
        "no_release_trajectory": no_rel_pred,
        "max_safe_release_cusecs": round(r_max),
        "flood_pressure": bool(flood_pressure),
        "logic_steps": steps,
        "scenarios": scenarios,
    }
