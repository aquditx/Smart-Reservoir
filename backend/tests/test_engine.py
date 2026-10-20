import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app import config as C
from app.main import app
from app.recommend import build_window, max_release_above_mddl, min_release_to_stay_below, recommend, run
from app.simulation import classify, cusecs_to_tmc, simulate_storage, tmc_to_cusecs
from app.store import get_store

client = TestClient(app)


def test_unit_conversion_round_trip():
    assert tmc_to_cusecs(cusecs_to_tmc(12345.6)) == pytest.approx(12345.6)
    assert C.CUSECS_PER_TMC_DAY == pytest.approx(11574.07, abs=0.01)


def test_reproduces_person_c_trajectories():
    """Same inputs as Person C's notebook -> same storage numbers."""
    c = pd.read_csv(C.RAW / "person_c" / "daily_simulation_output_for_D.csv")
    expected_final = {5000: 43.4753, 10000: 42.1793, 15000: 40.8833}
    for rel, grp in c.groupby("release_cusecs"):
        traj = simulate_storage(41.073, grp.predicted_inflow_tmc, [rel / C.CUSECS_PER_TMC_DAY] * 3,
                                grp.withdrawal_tmc, grp.evaporation_tmc)
        assert traj[1:] == pytest.approx(grp.projected_storage_tmc.tolist(), abs=1e-3)
        assert traj[-1] == pytest.approx(expected_final[rel], abs=1e-3)


def test_zones():
    assert classify(C.FRL_TMC + 0.1) == "flood_risk"
    assert classify(C.FRL_TMC - 0.5) == "caution"
    assert classify(30) == "normal"
    assert classify(C.MDDL_TMC + 1) == "low"
    assert classify(C.MDDL_TMC - 1) == "below_mddl"


@pytest.mark.parametrize("date", ["2014-09-27", "2016-08-01", "2018-08-10", "2018-08-14", "2019-08-12"])
def test_min_feasible_release_is_tight(date):
    win = build_window(get_store(), date, 3)
    r, _ = min_release_to_stay_below(win, C.FRL_TMC, "upper")
    assert max(run(win, r, "upper")[1:]) <= C.FRL_TMC + 1e-6
    if r > 1:
        assert max(run(win, r - 1, "upper")[1:]) > C.FRL_TMC


@pytest.mark.parametrize("date", ["2015-01-15", "2017-05-01", "2018-08-14", "2019-03-01"])
def test_scenarios_ordered_and_capped(date):
    win = build_window(get_store(), date, 5)
    res = recommend(win)
    rel = [s["release_cusecs"] for s in res["scenarios"]]
    assert rel == sorted(rel)
    assert all(r <= max_release_above_mddl(win) + 1 for r in rel)


def test_api_endpoints():
    assert client.get("/api/reservoirs").status_code == 200
    assert client.get("/api/krs/thresholds").json()["frl"]["gross_tmc"] == C.FRL_TMC
    assert len(client.get("/api/krs/history", params={"from": "2018-01-01", "to": "2018-12-31"}).json()) == 365
    assert client.get("/api/krs/forecast").status_code == 200
    assert client.get("/api/krs/metrics").json()["best_model"] == "random_forest"
    r = client.get("/api/krs/recommend", params={"date": "2018-08-10", "horizon": 3}).json()
    assert [s["key"] for s in r["scenarios"]] == ["conservative", "recommended", "aggressive"]
    sim = client.post("/api/krs/simulate", json={"date": "2018-08-10", "horizon": 3, "release_cusecs": 0}).json()
    assert sim["spill_days"] >= 1
    assert client.get("/api/krs/recommend", params={"date": "2005-01-01"}).status_code == 422
    assert client.get("/api/srisailam/forecast").status_code == 200
    assert client.get("/api/krs/benchmark").json()["days"] > 1800
