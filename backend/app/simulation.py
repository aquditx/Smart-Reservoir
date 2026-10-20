"""Day-by-day water balance (Person C's engine, generalised).

    S[t+1] = S[t] + Inflow[t] - Release[t] - Withdrawal[t] - Evaporation[t]

All volumes are daily TMC. Rates in cusecs are converted with CUSECS_PER_TMC_DAY.
"""
from collections.abc import Sequence

from . import config as C


def cusecs_to_tmc(q: float) -> float:
    return q / C.CUSECS_PER_TMC_DAY


def tmc_to_cusecs(v: float) -> float:
    return v * C.CUSECS_PER_TMC_DAY


def simulate_storage(initial_storage_tmc: float,
                     daily_inflows_tmc: Sequence[float],
                     daily_releases_tmc: Sequence[float],
                     daily_withdrawals_tmc: Sequence[float],
                     daily_evaporation_tmc: Sequence[float]) -> list[float]:
    """Person C's function, unchanged in behaviour. Returns [S0, S1, ..., Sn]."""
    storage = float(initial_storage_tmc)
    trajectory = [storage]
    for inflow, release, withdrawal, evaporation in zip(
            daily_inflows_tmc, daily_releases_tmc, daily_withdrawals_tmc, daily_evaporation_tmc):
        storage = storage + inflow - release - withdrawal - evaporation
        trajectory.append(storage)
    return trajectory


def classify(storage_tmc: float) -> str:
    """Operating zone for a gross storage value."""
    if storage_tmc > C.FRL_TMC:
        return "flood_risk"
    if storage_tmc > C.CAUTION_FRACTION * C.FRL_TMC:
        return "caution"
    if storage_tmc < C.MDDL_TMC:
        return "below_mddl"
    if storage_tmc < C.MDDL_TMC + C.LOW_BUFFER_TMC:
        return "low"
    return "normal"


ZONE_SEVERITY = {"normal": 0, "caution": 1, "low": 1, "flood_risk": 3, "below_mddl": 3}


def worst_zone(trajectory: Sequence[float]) -> str:
    return max((classify(s) for s in trajectory[1:] or trajectory), key=ZONE_SEVERITY.__getitem__)
