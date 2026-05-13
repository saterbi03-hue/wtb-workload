"""Module-level singleton for the currently loaded DataBundle and derived caches.

Single-user local tool — one active dataset at a time is sufficient.
All heavy computations (phase instances, weekly forecast) are lazily computed
once after upload and cached until the next upload replaces the bundle.
"""
from __future__ import annotations

from typing import Optional

import pandas as pd
from fastapi import HTTPException

from domain.loader import DataBundle

_bundle: Optional[DataBundle] = None
_phase_instances: Optional[pd.DataFrame] = None
_weekly_forecast: Optional[pd.DataFrame] = None
_monthly_forecast: Optional[pd.DataFrame] = None
_complexity_df: Optional[pd.DataFrame] = None
_live_mode: bool = False
_cached_today: Optional[pd.Timestamp] = None


def set_bundle(bundle: DataBundle) -> None:
    global _bundle, _phase_instances, _weekly_forecast, _monthly_forecast, _cached_today, _complexity_df
    _bundle = bundle
    _phase_instances = None
    _weekly_forecast = None
    _monthly_forecast = None
    _cached_today = None
    _complexity_df = None


def set_live_mode(enabled: bool) -> None:
    global _live_mode, _cached_today, _phase_instances, _weekly_forecast, _monthly_forecast, _complexity_df
    _live_mode = enabled
    _cached_today = None
    _phase_instances = None
    _weekly_forecast = None
    _monthly_forecast = None
    _complexity_df = None


def is_live_mode() -> bool:
    return _live_mode


def _resolve_today(bundle: DataBundle) -> pd.Timestamp:
    if _live_mode:
        return pd.Timestamp.now().normalize()
    return pd.Timestamp(bundle.config["today"])


def require_bundle() -> DataBundle:
    if _bundle is None:
        raise HTTPException(
            status_code=424,
            detail="No data loaded. Upload a file via POST /api/upload first.",
        )
    return _bundle


def get_phase_instances() -> pd.DataFrame:
    global _phase_instances, _weekly_forecast, _monthly_forecast, _cached_today
    bundle = require_bundle()
    today = _resolve_today(bundle)
    if _phase_instances is None or today != _cached_today:
        from domain.engine import build_phase_instances
        _phase_instances = build_phase_instances(bundle, today=today)
        _cached_today = today
        _weekly_forecast = None
        _monthly_forecast = None
    return _phase_instances


def get_weekly_forecast() -> pd.DataFrame:
    global _weekly_forecast
    bundle = require_bundle()
    if _weekly_forecast is None:
        from domain.engine import forecast_weekly
        today = _resolve_today(bundle)
        _weekly_forecast = forecast_weekly(bundle, get_phase_instances(), today=today)
    return _weekly_forecast


def get_monthly_forecast() -> pd.DataFrame:
    global _monthly_forecast
    if _monthly_forecast is None:
        from domain.engine import forecast_monthly
        _monthly_forecast = forecast_monthly(get_weekly_forecast())
    return _monthly_forecast


def get_complexity_df() -> pd.DataFrame:
    global _complexity_df
    if _complexity_df is None:
        from domain.engine import compute_complexity
        _complexity_df = compute_complexity(require_bundle(), get_phase_instances())
    return _complexity_df
