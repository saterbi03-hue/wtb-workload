from __future__ import annotations

from pydantic import BaseModel
from fastapi import APIRouter

import api.state as state

router = APIRouter()


class ModeRequest(BaseModel):
    live: bool


@router.post("/mode")
def set_mode(body: ModeRequest) -> dict:
    state.set_live_mode(body.live)
    return {"live": body.live}


@router.get("/mode")
def get_mode() -> dict:
    return {"live": state.is_live_mode()}
