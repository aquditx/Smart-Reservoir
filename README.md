# Smart Reservoir Decision Support System: Person D

Recommendation engine and interactive dashboard for **K.R. Sagara Dam (KRS)**, with Srisailam as a limited second case.
This builds on Person B's inflow forecast and Person C's water-balance simulation.

## Run it

**One click:** double-click `run_dashboard.bat`. It opens http://localhost:8000.

**Developer mode** (hot reload), in two terminals:

```bash
backend/.venv/Scripts/python.exe -m uvicorn app.main:app --app-dir backend --reload --port 8000
```

```bash
npm --prefix frontend run dev
```

Then open http://localhost:5173.

**Tests:**

```bash
cd backend && .venv/Scripts/python.exe -m pytest -q
```

**Rebuild the database** (only after changing `data/raw`):

```bash
cd backend && .venv/Scripts/python.exe -m app.etl
```

Requirements: Python 3.11+ (venv in `backend/.venv` with fastapi, uvicorn, pandas, numpy, pytest, httpx) and Node.js 20+.

## Project layout

| Path | What it does |
|---|---|
| `data/raw/` | Person B's data and outputs, plus Person C's hand-off files |
| `backend/app/etl.py` | Cleans the KRS bulletin and loads everything into SQLite (`data/dss.sqlite`) |
| `backend/app/config.py` | Thresholds (FRL, MDDL, cushion) and unit constants |
| `backend/app/simulation.py` | Person C's water balance, unchanged, plus zone classification |
| `backend/app/recommend.py` | Slide-25 minimum-feasible-release logic and the 3 scenarios |
| `backend/app/benchmark.py` | Back-test against the actual operator releases (2014–2019) |
| `backend/app/main.py` | FastAPI routes under `/api/...`; also serves the built React app |
| `frontend/src/pages/` | Control room, Simulate & recommend, Forecast, History, Benchmark, Srisailam, Methodology |

## Thresholds and how they were verified

| | Gauge | Bulletin datum | Gross storage |
|---|---|---|---|
| FRL | 124.80 ft | 2,468.8 ft | 49.452 TMC |
| MDDL | 74.00 ft | 2,418.0 ft | ≈ 8.39 TMC (live ≈ 0) |

The bulletin records levels on a datum 2,344 ft above the dam gauge. Its highest recorded level is 2,468.8 ft, and gross storage there equals the design capacity of 49.452 TMC. At 2,418 ft, live storage reaches zero (dead storage is a constant 8.379 TMC). **Check FRL and MDDL against the O&M manual pages before presenting.**

## Recommendation logic (slide 25)

1. Storage if nothing is released: S₀ + Σ(inflow − canal − evaporation), computed for each forecast day k.
2. Release needed on day k: Rₖ = (S_k,no-release − FRL) / k.
3. Minimum feasible constant release: R = max(0, maxₖ Rₖ), capped so storage never falls below MDDL.

| Scenario | Inflow used | Ceiling |
|---|---|---|
| Conservative (water supply) | median forecast | FRL |
| **Recommended** (balanced) | P90 forecast | FRL |
| Aggressive (flood safety) | P90 forecast | 95% of FRL (flood cushion) |

## Key results

- **Back-test, 1,865 decision days from 2014 to 2019:** the Recommended release kept storage below FRL in **98.1%** of the 3-day windows when replayed with the inflow that actually arrived.
- **Breaches:** all 35 breach windows fell in the 2018 and 2019 floods, when actual inflow exceeded even the P90 forecast.
- **Total volume:** the DSS would have released 408 TMC in total; operators actually released 403 TMC.
- **Fix to C's hand-off:** C's simulation started from *live* storage (41.073 TMC), which is FRL. But it checked the result against *gross* capacity (49.452), so all three of its release cases rose above FRL without being flagged. The DSS uses gross storage throughout.

## Limitations (stated in the dashboard)

- Rainfall data ends in Nov 2019, so everything is historical back-testing, not live forecasting.
- The forecast's 80% band covers only ~67% of actual values, and it under-predicts extreme flood peaks.
- Horizons longer than 3 days use forecasts issued after the decision date. They show what a longer forecast would allow.
- Gate capacities and inter-state release obligations (Cauvery tribunal) are not modelled.
- Srisailam has no release data. Its target is the *net storage change*, so it gets a forecast only, with no simulation.
