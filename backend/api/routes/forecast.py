from __future__ import annotations

import re
from typing import Annotated, Literal

import pandas as pd
from fastapi import APIRouter, HTTPException, Query

import api.state as state
from domain.engine import data_quality, to_calendar_week
from domain.models import DataQualityRow, ForecastResponse, ForecastSeries

router = APIRouter()

_CW_RE = re.compile(r"^CW(\d{1,2})-(\d{4})$")


def _parse_cw(cw: str) -> int:
    """Parse 'CW18-2026' → 202618 (year*100+week). Raises ValueError on bad format."""
    m = _CW_RE.match(cw)
    if not m:
        raise ValueError(f"Invalid CW format: {cw!r}. Expected 'CWww-yyyy'")
    week, year = int(m.group(1)), int(m.group(2))
    return year * 100 + week


@router.get("/forecast", response_model=ForecastResponse)
def get_forecast(
    view: Literal['weekly', 'monthly'] = Query('weekly'),
    ca_id: Annotated[list[str] | None, Query()] = None,
    cw_from: str | None = Query(None),
    cw_to: str | None = Query(None),
) -> ForecastResponse:
    # Validate CW params before require_bundle so 400 is returned fast
    key_from: int | None = None
    key_to: int | None = None
    for val, name in ((cw_from, "cw_from"), (cw_to, "cw_to")):
        if val is not None:
            try:
                key = _parse_cw(val)
            except ValueError as exc:
                raise HTTPException(status_code=400, detail=str(exc)) from exc
            if name == "cw_from":
                key_from = key
            else:
                key_to = key

    bundle = state.require_bundle()
    pi = state.get_phase_instances()
    ca_display = bundle.persons.set_index("ca_sheet")["ca_display"].to_dict()

    if view == "weekly":
        df = state.get_weekly_forecast()
        if key_from is not None or key_to is not None:
            iso = df.index.isocalendar()
            cw_keys = (iso["year"] * 100 + iso["week"]).values
            keep = [
                (key_from is None or k >= key_from) and (key_to is None or k <= key_to)
                for k in cw_keys
            ]
            df = df[keep]
        labels = [to_calendar_week(ts)["cw"] for ts in df.index]
    else:
        df = state.get_monthly_forecast()
        labels = [ts.strftime("%Y-%m") for ts in df.index]

    # Filter to requested CAs (default: all)
    cols = list(df.columns)
    if ca_id:
        cols = [c for c in ca_id if c in df.columns]

    series = [
        ForecastSeries(
            ca_id=ca,
            ca_display=ca_display.get(ca, ca),
            values=[round(float(v), 3) for v in df[ca]],
        )
        for ca in cols
    ]

    # Data quality always computed for all CAs
    wkly = state.get_weekly_forecast()
    quality_rows = data_quality(bundle, pi, wkly)

    return ForecastResponse(
        view=view,
        labels=labels,
        series=series,
        data_quality=[DataQualityRow(**q) for q in quality_rows],
    )
