from __future__ import annotations

import pandas as pd
from fastapi import APIRouter, File, HTTPException, UploadFile

import api.state as state
from domain.loader import parse_workbook
from domain.models import ConfigOut, PersonOut, UploadResponse

router = APIRouter()


@router.post("/upload", response_model=UploadResponse)
async def upload_file(file: UploadFile = File(...)) -> UploadResponse:
    if not (file.filename or "").lower().endswith(".xlsx"):
        raise HTTPException(status_code=400, detail="File must be a .xlsx workbook.")

    content = await file.read()
    try:
        bundle = parse_workbook(content)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    state.set_bundle(bundle)

    active_persons = bundle.persons[bundle.persons["active"] == 1]
    cfg = bundle.config

    return UploadResponse(
        n_topics=len(bundle.topics),
        n_active_cas=len(active_persons),
        config=ConfigOut(
            today=str(pd.Timestamp(cfg["today"]).date()),
            weekly_capacity_hrs=float(cfg["weekly_capacity_hrs"]),
            catchup_window_weeks=int(cfg["catchup_window_weeks"]),
            stale_threshold_weeks=int(cfg["stale_threshold_weeks"]),
            forecast_horizon_weeks=int(cfg["forecast_horizon_weeks"]),
        ),
        persons=[
            PersonOut(
                ca_id=str(row["ca_sheet"]),
                ca_display=str(row["ca_display"]),
                n_topics=int(row["n_topics"]),
            )
            for _, row in active_persons.iterrows()
        ],
    )
