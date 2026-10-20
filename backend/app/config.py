"""Constants and operating thresholds for the Smart Reservoir DSS.

Thresholds come from the KRS O&M manual (gauge levels supplied by Person A)
and were cross-checked against the reservoir bulletin data:

  * FRL  124.80 ft gauge  -> 2468.8 ft in the bulletin datum -> 49.452 TMC gross
    (the bulletin's "Design Gross Capacity"; live storage there is 41.073 TMC)
  * MDDL  74.00 ft gauge  -> 2418.0 ft in the bulletin datum -> ~8.38 TMC gross
    (live storage is ~0 at this level; gross - live is a constant 8.379 TMC)

All simulation is done in GROSS storage (TMC) so it compares directly with FRL.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw"
DB_PATH = ROOT / "data" / "dss.sqlite"
FRONTEND_DIST = ROOT / "frontend" / "dist"

# 1 TMC = 1e9 ft^3; 1 cusec for a day = 86,400 ft^3
CUSECS_PER_TMC_DAY = 1e9 / 86400  # 11,574.07, same constant Person C used

KRS_NAME = "K.R.Sagara Dam"
FORECAST_HORIZON_DAYS = 3  # Person B's model predicts inflow 3 days ahead

# Bulletin level datum = dam gauge + this offset (2468.8 - 124.80)
GAUGE_DATUM_OFFSET_FT = 2344.0

FRL_GAUGE_FT = 124.80
MDDL_GAUGE_FT = 74.00
FRL_TMC = 49.452          # gross storage at FRL (design gross capacity)
DEAD_STORAGE_TMC = 8.379  # gross - live, constant in the bulletin data
MDDL_TMC = 8.39           # gross storage at MDDL (empirical median at 2418 ft)

# Operating zones (gross TMC)
CAUTION_FRACTION = 0.95   # above 95% of FRL storage = flood-cushion zone
LOW_BUFFER_TMC = 5.0      # within 5 TMC of MDDL = low-storage warning

# Release slider / recommendation bounds (cusecs)
MAX_RELEASE_CUSECS = 150_000
