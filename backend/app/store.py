"""In-memory view of the SQLite database, loaded once at startup."""
import json
import sqlite3
from functools import lru_cache

import pandas as pd

from . import config as C


class Store:
    def __init__(self) -> None:
        if not C.DB_PATH.exists():
            from .etl import build
            build()
        with sqlite3.connect(C.DB_PATH) as con:
            self.krs = pd.read_sql("SELECT * FROM krs_daily", con, parse_dates=["date"]).set_index("date")
            self.forecast = pd.read_sql("SELECT * FROM krs_forecast", con, parse_dates=["origin_date", "target_date"])
            self.srisailam = pd.read_sql("SELECT * FROM srisailam_forecast", con, parse_dates=["date"])
            self.curve = pd.read_sql("SELECT * FROM krs_level_curve", con)
            self.meta = {k: json.loads(v) for k, v in con.execute("SELECT key, value FROM meta")}
        self.fc_by_target = self.forecast.set_index("target_date").sort_index()

    @property
    def decision_dates(self) -> tuple[pd.Timestamp, pd.Timestamp]:
        """Range of 'today' dates for which at least a 1-day forecast exists."""
        t = self.fc_by_target.index
        return t.min() - pd.Timedelta(days=1), t.max() - pd.Timedelta(days=1)


@lru_cache(maxsize=1)
def get_store() -> Store:
    return Store()
