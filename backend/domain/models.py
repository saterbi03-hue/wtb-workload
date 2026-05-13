"""Pydantic v2 response models for all API endpoints."""
from __future__ import annotations

from typing import Optional
from pydantic import BaseModel


# ── Upload ────────────────────────────────────────────────────────────────────

class ConfigOut(BaseModel):
    today: str
    weekly_capacity_hrs: float
    catchup_window_weeks: int
    stale_threshold_weeks: int
    forecast_horizon_weeks: int


class PersonOut(BaseModel):
    ca_id: str
    ca_display: str
    n_topics: int


class UploadResponse(BaseModel):
    n_topics: int
    n_active_cas: int
    config: ConfigOut
    persons: list[PersonOut]


# ── Overview ──────────────────────────────────────────────────────────────────

class KpisOut(BaseModel):
    total_active_topics: int
    total_active_cas: int
    avg_workload: float
    max_workload: float
    max_workload_ca: str


class WeekWorkload(BaseModel):
    week: str       # ISO date of the Monday
    cw: str         # e.g. "CW18-2026"
    cw_label: str   # e.g. "CW18"
    cw_year: int
    cw_number: int
    workload: float


class CaHeatmapRow(BaseModel):
    ca_id: str
    ca_display: str
    weeks: list[WeekWorkload]


class OverviewResponse(BaseModel):
    kpis: KpisOut
    heatmap: list[CaHeatmapRow]


# ── Team ──────────────────────────────────────────────────────────────────────

class TeamRow(BaseModel):
    ca_id: str
    ca_display: str
    current_workload: float
    peak_workload: float
    peak_week: str
    n_active_topics: int


# ── CA Detail ─────────────────────────────────────────────────────────────────

class PhaseDetail(BaseModel):
    phase: str
    start: Optional[str] = None
    end: Optional[str] = None
    status: Optional[str] = None


class TopicOut(BaseModel):
    id: int
    project: str
    topic: str
    supplier: Optional[str] = None
    global_status: Optional[str] = None
    complexity_score: float = 0.0
    complexity_level: Optional[str] = None
    phases: list[PhaseDetail]


class ActivePhaseOut(BaseModel):
    topic: str
    project: str
    phase: str
    start: Optional[str] = None
    end: Optional[str] = None
    vh: float
    vh_pct: float          # fraction de capacity (ex: 0.034 = 3.4%)
    complexity_score: float = 0.0
    complexity_level: Optional[str] = None


class CaDetailResponse(BaseModel):
    ca_id: str
    ca_display: str
    current_workload: float
    weekly_forecast: list[WeekWorkload]
    active_phases: list[ActivePhaseOut]
    topics: list[TopicOut]


# ── Forecast ──────────────────────────────────────────────────────────────────

class ForecastSeries(BaseModel):
    ca_id: str
    ca_display: str
    values: list[float]


class DataQualityRow(BaseModel):
    ca_id: str
    ca_display: str
    quality_score: float        # 0–1, composite metric
    date_coverage: float        # fraction of phases with both dates defined
    future_coverage: float      # fraction of phases ending in the future
    stale_ratio: float          # fraction of stale phases
    reliable_horizon_weeks: int # last week index where ≥2 non-stale phases active


class ForecastResponse(BaseModel):
    view: str               # "weekly" or "monthly"
    labels: list[str]       # ISO week dates or "YYYY-MM" month strings
    series: list[ForecastSeries]
    data_quality: list[DataQualityRow]


# ── Smoothing ─────────────────────────────────────────────────────────────────

class ImpactOut(BaseModel):
    from_before: float
    from_after: float
    to_before: float
    to_after: float


class SmoothingSuggestion(BaseModel):
    from_ca_id: str
    from_ca_display: str
    to_ca_id: str
    to_ca_display: str
    topic_id: int
    topic: str
    project: str
    impact: ImpactOut


class SmoothingResponse(BaseModel):
    suggestions: list[SmoothingSuggestion]
    team_balance_before: float  # load std-dev before transfers
    team_balance_after: float   # load std-dev after applying suggestions


# ── Decisions ─────────────────────────────────────────────────────────────────

class DecisionOut(BaseModel):
    priority: str                       # "HIGH" | "MEDIUM" | "LOW"
    ca_id: Optional[str] = None
    ca_display: Optional[str] = None
    message: str
    current_load: Optional[float] = None   # fraction (1.0 = 100 % capacity)
    peak_load: Optional[float] = None
    peak_week: Optional[str] = None        # dd/mm/yyyy


# ── Criticality matrix ────────────────────────────────────────────────────────

class TopicCriticalityItem(BaseModel):
    topic_id: int
    topic: str
    project: str
    ca_id: str
    ca_display: str
    complexity_score: float
    complexity_level: str
    jalonnement_score: float
    jalonnement_level: str


class CriticalityCellOut(BaseModel):
    complexity_level: str
    jalonnement_level: str
    count: int
    topics: list[TopicCriticalityItem]


class CriticalityMatrixResponse(BaseModel):
    cells: list[CriticalityCellOut]
    total_topics: int
    unscored_topics: int


# ── Data warnings ─────────────────────────────────────────────────────────────

class DataWarningItem(BaseModel):
    severity: str   # "ERROR" | "WARNING"
    code: str       # "INVERTED_DATES" | "PARTIAL_DATES"
    ca_id: str
    ca_display: str
    topic_id: int
    topic: str
    project: str
    phase: str
    detail: str


class DataWarningsResponse(BaseModel):
    warnings: list[DataWarningItem]
    total: int
    errors: int
