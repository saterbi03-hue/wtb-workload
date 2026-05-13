from __future__ import annotations

import api.state as state
from domain.engine import decisions
from domain.models import DecisionOut
from fastapi import APIRouter

router = APIRouter()


@router.get("/decisions", response_model=list[DecisionOut])
def get_decisions() -> list[DecisionOut]:
    bundle = state.require_bundle()
    wkly = state.get_weekly_forecast()

    raw = decisions(bundle, wkly)
    return [DecisionOut(**d) for d in raw]
