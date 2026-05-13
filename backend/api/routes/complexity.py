from __future__ import annotations

import api.state as state
from domain.engine import criticality_matrix
from domain.models import CriticalityCellOut, CriticalityMatrixResponse, TopicCriticalityItem
from fastapi import APIRouter

router = APIRouter()


@router.get("/complexity", response_model=CriticalityMatrixResponse)
def get_complexity() -> CriticalityMatrixResponse:
    bundle = state.require_bundle()
    pi = state.get_phase_instances()

    raw = criticality_matrix(bundle, pi)
    return CriticalityMatrixResponse(
        cells=[
            CriticalityCellOut(
                complexity_level=cell["complexity_level"],
                jalonnement_level=cell["jalonnement_level"],
                count=cell["count"],
                topics=[TopicCriticalityItem(**t) for t in cell["topics"]],
            )
            for cell in raw["cells"]
        ],
        total_topics=raw["total_topics"],
        unscored_topics=raw["unscored_topics"],
    )
