import pytest
import pandas as pd
from domain.loader import DataBundle, PHASES


def test_bundle_shapes(bundle: DataBundle):
    assert len(bundle.topics) == 589
    assert len(bundle.phase_params) == 5
    assert len(bundle.persons) == 14


def test_phase_params_index(bundle: DataBundle):
    for phase in PHASES:
        assert phase in bundle.phase_params.index


def test_phase_params_vh(bundle: DataBundle):
    """VH = duration_hrs / delai_weeks — spot-check delivery phase."""
    p = bundle.phase_params.loc["delivery"]
    assert abs(p["duration_hrs"] / p["delai_weeks"] - 7.25 / 16) < 1e-9


def test_active_persons(bundle: DataBundle):
    active = bundle.persons[bundle.persons["active"] == 1]
    assert len(active) == 11


def test_config_keys(bundle: DataBundle):
    required = {
        "today", "weekly_capacity_hrs", "catchup_window_weeks",
        "stale_threshold_weeks", "forecast_horizon_weeks",
    }
    assert required.issubset(bundle.config.keys())


def test_config_today_is_timestamp(bundle: DataBundle):
    today = bundle.config["today"]
    assert isinstance(today, pd.Timestamp)


def test_topics_date_columns_parsed(bundle: DataBundle):
    """Date columns should be datetime64, not object."""
    assert pd.api.types.is_datetime64_any_dtype(bundle.topics["digital_start"])


def test_invalid_file_raises():
    from domain.loader import parse_workbook
    with pytest.raises(ValueError, match="Cannot read Excel file"):
        parse_workbook(b"not an xlsx file")


def test_missing_sheet_raises(tmp_path):
    import openpyxl, io
    wb = openpyxl.Workbook()
    buf = io.BytesIO()
    wb.save(buf)
    from domain.loader import parse_workbook
    with pytest.raises(ValueError, match="Missing required sheets"):
        parse_workbook(buf.getvalue())
