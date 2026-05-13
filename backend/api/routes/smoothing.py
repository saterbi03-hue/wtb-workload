from __future__ import annotations

import api.state as state
from domain.engine import smoothing_suggestions
from domain.models import ImpactOut, SmoothingResponse, SmoothingSuggestion
from fastapi import APIRouter

router = APIRouter()


@router.get("/smoothing", response_model=SmoothingResponse)
def get_smoothing() -> SmoothingResponse:
    bundle = state.require_bundle()
    pi = state.get_phase_instances()
    wkly = state.get_weekly_forecast()

    raw = smoothing_suggestions(bundle, pi, wkly)
    return SmoothingResponse(
        suggestions=[
            SmoothingSuggestion(
                from_ca_id=s["from_ca_id"],
                from_ca_display=s["from_ca_display"],
                to_ca_id=s["to_ca_id"],
                to_ca_display=s["to_ca_display"],
                topic_id=s["topic_id"],
                topic=s["topic"],
                project=s["project"],
                impact=ImpactOut(**s["impact"]),
            )
            for s in raw["suggestions"]
        ],
        team_balance_before=raw["team_balance_before"],
        team_balance_after=raw["team_balance_after"],
    )
