from __future__ import annotations

import pandas as pd
from fastapi import APIRouter, HTTPException

import api.state as state
from domain.engine import to_calendar_week
from domain.loader import PHASES
from domain.models import (
    ActivePhaseOut,
    CaDetailResponse,
    PhaseDetail,
    TopicOut,
    WeekWorkload,
)

router = APIRouter()


def _fmt_date(ts) -> str | None:
    if ts is None or (isinstance(ts, float) and pd.isna(ts)):
        return None
    try:
        return pd.Timestamp(ts).strftime("%Y-%m-%d")
    except Exception:
        return None


@router.get("/ca/{ca_id}", response_model=CaDetailResponse)
def get_ca_detail(ca_id: str) -> CaDetailResponse:
    bundle = state.require_bundle()
    pi = state.get_phase_instances()
    wkly = state.get_weekly_forecast()

    # Validate ca_id
    active_cas = set(bundle.persons.loc[bundle.persons["active"] == 1, "ca_sheet"])
    if ca_id not in active_cas:
        raise HTTPException(status_code=404, detail=f"CA '{ca_id}' not found.")

    ca_display = str(
        bundle.persons.loc[bundle.persons["ca_sheet"] == ca_id, "ca_display"].iloc[0]
    )
    current_workload = round(float(wkly.iloc[0][ca_id]), 3)
    capacity = float(bundle.config["weekly_capacity_hrs"])

    # Weekly forecast for this CA only
    weekly_forecast = [
        WeekWorkload(**to_calendar_week(ts), workload=round(float(val), 3))
        for ts, val in wkly[ca_id].items()
    ]

    # Active phases right now
    active_now = pi[(pi["ca_id"] == ca_id) & pi["is_active_now"]].copy()
    active_phases = [
        ActivePhaseOut(
            topic=str(r["topic"]),
            project=str(r["project"]),
            phase=str(r["phase"]),
            start=_fmt_date(r["scheduled_start"]),
            end=_fmt_date(r["scheduled_end"]),
            vh=round(float(r["vh"]), 3),
            vh_pct=round(float(r["vh"]) / capacity, 4),
            complexity_score=round(float(r.get("complexity_score", 0.0) or 0.0), 1),
            complexity_level=str(r["complexity_level"])
            if r.get("complexity_level") is not None and not (
                isinstance(r.get("complexity_level"), float) and pd.isna(r["complexity_level"])
            )
            else None,
        )
        for _, r in active_now.iterrows()
    ]
    active_phases.sort(key=lambda p: p.vh, reverse=True)

    # All topics for this CA
    ca_topics = bundle.topics[bundle.topics["ca_sheet"] == ca_id].copy()
    topics_out: list[TopicOut] = []
    for _, row in ca_topics.iterrows():
        phase_details = [
            PhaseDetail(
                phase=phase,
                start=_fmt_date(row[f"{phase}_start"]),
                end=_fmt_date(row[f"{phase}_end"]),
                status=str(row[f"{phase}_status"])
                if not pd.isna(row[f"{phase}_status"])
                else None,
            )
            for phase in PHASES
        ]
        cx_level = row.get("complexity_level")
        topics_out.append(
            TopicOut(
                id=int(row["id"]),
                project=str(row["project"]) if not pd.isna(row["project"]) else "",
                topic=str(row["topic"]),
                supplier=str(row["supplier"])
                if not pd.isna(row.get("supplier", float("nan")))
                else None,
                global_status=str(row["global_status"])
                if not pd.isna(row["global_status"])
                else None,
                complexity_score=round(float(row.get("complexity_score", 0.0) or 0.0), 1),
                complexity_level=str(cx_level)
                if cx_level is not None and not (isinstance(cx_level, float) and pd.isna(cx_level))
                else None,
                phases=phase_details,
            )
        )

    return CaDetailResponse(
        ca_id=ca_id,
        ca_display=ca_display,
        current_workload=current_workload,
        weekly_forecast=weekly_forecast,
        active_phases=active_phases,
        topics=topics_out,
    )
