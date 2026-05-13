from __future__ import annotations

from fastapi import APIRouter

import api.state as state
from domain.engine import data_warnings
from domain.models import DataWarningItem, DataWarningsResponse

router = APIRouter()


@router.get("/data-warnings", response_model=DataWarningsResponse)
def get_data_warnings() -> DataWarningsResponse:
    bundle = state.require_bundle()
    result = data_warnings(bundle)
    return DataWarningsResponse(
        warnings=[DataWarningItem(**w) for w in result["warnings"]],
        total=result["total"],
        errors=result["errors"],
    )
