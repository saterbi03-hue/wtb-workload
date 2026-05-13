"""Parse and validate the wtb_data.xlsx workbook into a DataBundle."""
from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO

import pandas as pd

PHASES = ["advanced", "digital", "static", "dynamic", "delivery"]

REQUIRED_SHEETS = {"topics", "phase_params", "persons", "config"}

TOPIC_DATE_COLS = [f"{p}_{s}" for p in PHASES for s in ("start", "end")]

TOPIC_REQUIRED_COLS: set[str] = {
    "id",
    "ca_sheet",
    "ca_display",
    "project",
    "topic",
    "global_status",
    *[f"{p}_{s}" for p in PHASES for s in ("start", "end", "status")],
}

# Optional columns added in v2 — filled with defaults if absent
TOPIC_OPTIONAL_DEFAULTS: dict[str, object] = {
    "complexity_score": 0.0,
    "complexity_level": None,
}


@dataclass
class DataBundle:
    topics: pd.DataFrame        # 589 rows, 1 per CA × topic
    phase_params: pd.DataFrame  # 5 rows, indexed by phase name
    persons: pd.DataFrame       # 14 rows, active + inactive CAs
    config: dict                # key → Python scalar or pd.Timestamp


def parse_workbook(file_bytes: bytes) -> DataBundle:
    """Parse a wtb_data.xlsx file and return a validated DataBundle.

    Raises ValueError with a human-readable message on any structural problem.
    """
    try:
        xl = pd.ExcelFile(BytesIO(file_bytes), engine="openpyxl")
    except Exception as exc:
        raise ValueError(f"Cannot read Excel file: {exc}") from exc

    missing_sheets = REQUIRED_SHEETS - set(xl.sheet_names)
    if missing_sheets:
        raise ValueError(f"Missing required sheets: {sorted(missing_sheets)}")

    topics = xl.parse("topics", parse_dates=TOPIC_DATE_COLS)
    missing_cols = TOPIC_REQUIRED_COLS - set(topics.columns)
    if missing_cols:
        raise ValueError(f"'topics' sheet missing columns: {sorted(missing_cols)}")

    phase_params_raw = xl.parse("phase_params")
    if "phase" not in phase_params_raw.columns:
        raise ValueError("'phase_params' sheet missing 'phase' column")
    phase_params = phase_params_raw.set_index("phase")
    for required_phase in PHASES:
        if required_phase not in phase_params.index:
            raise ValueError(f"'phase_params' missing phase row: '{required_phase}'")

    persons = xl.parse("persons")
    if "active" not in persons.columns:
        raise ValueError("'persons' sheet missing 'active' column")

    config_df = xl.parse("config")
    import datetime as _dt

    config: dict = {}
    for _, row in config_df.iterrows():
        key = str(row["key"])
        val = row["value"]
        if isinstance(val, pd.Timestamp):
            config[key] = val
        elif isinstance(val, (_dt.datetime, _dt.date)):
            config[key] = pd.Timestamp(val)
        elif hasattr(val, "item"):
            # numpy scalar → Python scalar
            config[key] = val.item()
        else:
            config[key] = val

    # Inject optional columns if not present in this workbook version
    for col, default in TOPIC_OPTIONAL_DEFAULTS.items():
        if col not in topics.columns:
            topics[col] = default

    topics["complexity_score"] = (
        pd.to_numeric(topics["complexity_score"], errors="coerce").fillna(0.0)
    )

    return DataBundle(
        topics=topics,
        phase_params=phase_params,
        persons=persons,
        config=config,
    )
