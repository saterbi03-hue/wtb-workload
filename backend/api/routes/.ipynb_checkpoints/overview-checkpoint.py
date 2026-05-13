from __future__ import annotations

import api.state as state
from domain.engine import n_active_topics_per_ca
from domain.models import CaHeatmapRow, KpisOut, OverviewResponse, WeekWorkload
from fastapi import APIRouter, Query

router = APIRouter()

DEFAULT_HEATMAP_WEEKS = 26


@router.get("/overview", response_model=OverviewResponse)
def get_overview(weeks: int = Query(DEFAULT_HEATMAP_WEEKS, ge=1, le=78)) -> OverviewResponse:
    bundle = state.require_bundle()
    pi = state.get_phase_instances()
    wkly = state.get_weekly_forecast()

    ca_display_map = bundle.persons.set_index("ca_sheet")["ca_display"].to_dict()

    current = wkly.iloc[0]
    n_active = n_active_topics_per_ca(pi)

    max_ca = str(current.idxmax()) if current.any() else (
        current.index[0] if len(current) > 0 else ""
    )

    kpis = KpisOut(
        total_active_topics=int(pi[pi["is_active_now"]]["topic_id"].nunique()),
        total_active_cas=len(wkly.columns),
        avg_workload=round(float(current.mean()), 3),
        max_workload=round(float(current.max()), 3),
        max_workload_ca=max_ca,
    )

    heatmap_df = wkly.iloc[:weeks]
    heatmap = [
        CaHeatmapRow(
            ca_id=ca_id,
            ca_display=ca_display_map.get(ca_id, ca_id),
            weeks=[
                WeekWorkload(week=ts.strftime("%Y-%m-%d"), workload=round(float(val), 3))
                for ts, val in heatmap_df[ca_id].items()
            ],
        )
        for ca_id in heatmap_df.columns
    ]

    return OverviewResponse(kpis=kpis, heatmap=heatmap)
