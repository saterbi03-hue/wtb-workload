from __future__ import annotations

import api.state as state
from domain.engine import n_active_topics_per_ca
from domain.models import TeamRow
from fastapi import APIRouter

router = APIRouter()


@router.get("/team", response_model=list[TeamRow])
def get_team() -> list[TeamRow]:
    bundle = state.require_bundle()
    pi = state.get_phase_instances()
    wkly = state.get_weekly_forecast()

    ca_display = bundle.persons.set_index("ca_sheet")["ca_display"].to_dict()
    current = wkly.iloc[0]
    peak = wkly.max()
    peak_weeks = wkly.idxmax()
    n_active = n_active_topics_per_ca(pi)

    rows = [
        TeamRow(
            ca_id=ca_id,
            ca_display=ca_display.get(ca_id, ca_id),
            current_workload=round(float(current[ca_id]), 3),
            peak_workload=round(float(peak[ca_id]), 3),
            peak_week=peak_weeks[ca_id].strftime("%Y-%m-%d"),
            n_active_topics=n_active.get(ca_id, 0),
        )
        for ca_id in wkly.columns
    ]
    rows.sort(key=lambda r: r.current_workload, reverse=True)
    return rows
