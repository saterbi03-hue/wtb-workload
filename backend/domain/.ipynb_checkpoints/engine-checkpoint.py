"""Pure workload-calculation functions — no I/O, no FastAPI imports."""
from __future__ import annotations

from typing import Optional

import numpy as np
import pandas as pd

from domain.loader import DataBundle, PHASES

EXCLUDED_STATUSES = frozenset({"VAL", "CANCELED"})


# ── Helpers ───────────────────────────────────────────────────────────────────

def _opt_str(val) -> Optional[str]:
    try:
        if pd.isna(val):
            return None
    except (TypeError, ValueError):
        pass
    s = str(val).strip()
    return s if s else None


def _week_series(today: pd.Timestamp, horizon_weeks: int) -> list[pd.Timestamp]:
    monday = today - pd.Timedelta(days=today.weekday())
    return [monday + pd.Timedelta(weeks=i) for i in range(horizon_weeks + 1)]


# ── Phase-instance builder ────────────────────────────────────────────────────

def build_phase_instances(bundle: DataBundle) -> pd.DataFrame:
    """Return one row per active-CA × topic × phase with computed effective window.

    Columns:
      topic_id, ca_id, ca_display, project, topic, supplier, global_status,
      phase, scheduled_start, scheduled_end, status, vh,
      effective_start, effective_end, is_stale, is_active_now
    """
    today = pd.Timestamp(bundle.config["today"])
    catchup_weeks = int(bundle.config["catchup_window_weeks"])
    stale_weeks = int(bundle.config["stale_threshold_weeks"])
    stale_cutoff = today - pd.Timedelta(weeks=stale_weeks)

    active_ca_ids = set(
        bundle.persons.loc[bundle.persons["active"] == 1, "ca_sheet"]
    )

    records: list[dict] = []

    for _, row in bundle.topics.iterrows():
        ca_id = str(row["ca_sheet"])
        if ca_id not in active_ca_ids:
            continue

        for phase in PHASES:
            start_raw = row[f"{phase}_start"]
            end_raw = row[f"{phase}_end"]
            status_raw = row[f"{phase}_status"]

            # Skip phases with no dates at all
            if pd.isna(start_raw) and pd.isna(end_raw):
                continue
            if pd.isna(status_raw):
                continue

            status = str(status_raw).strip()
            params = bundle.phase_params.loc[phase]
            vh = float(params["duration_hrs"]) / float(params["delai_weeks"])

            start_ts: Optional[pd.Timestamp] = (
                None if pd.isna(start_raw) else pd.Timestamp(start_raw)
            )
            end_ts: Optional[pd.Timestamp] = (
                None if pd.isna(end_raw) else pd.Timestamp(end_raw)
            )

            # Stale: ended more than stale_weeks before today, not yet validated/canceled
            is_stale = (
                end_ts is not None
                and end_ts < stale_cutoff
                and status not in EXCLUDED_STATUSES
            )

            # Effective window
            eff_start: pd.Timestamp = (
                max(today, start_ts) if start_ts is not None else today
            )
            catchup_end = eff_start + pd.Timedelta(weeks=catchup_weeks)
            eff_end: pd.Timestamp = (
                max(catchup_end, end_ts) if end_ts is not None else catchup_end
            )

            records.append({
                "topic_id": int(row["id"]),
                "ca_id": ca_id,
                "ca_display": str(row["ca_display"]),
                "project": _opt_str(row["project"]) or "",
                "topic": str(row["topic"]),
                "supplier": _opt_str(row["supplier"]),
                "global_status": _opt_str(row["global_status"]),
                "phase": phase,
                "scheduled_start": start_ts,
                "scheduled_end": end_ts,
                "status": status,
                "vh": vh,
                "effective_start": eff_start,
                "effective_end": eff_end,
                "is_stale": is_stale,
                "complexity_score": float(row.get("complexity_score", 0.0) or 0.0),
                "complexity_level": _opt_str(row.get("complexity_level")),
            })

    _empty_cols = [
        "topic_id", "ca_id", "ca_display", "project", "topic", "supplier",
        "global_status", "phase", "scheduled_start", "scheduled_end",
        "status", "vh", "effective_start", "effective_end", "is_stale",
        "is_active_now", "complexity_score", "complexity_level",
    ]
    if not records:
        return pd.DataFrame(columns=_empty_cols)

    df = pd.DataFrame(records)

    # is_active_now: overlaps the current week (week containing today)
    current_monday = today - pd.Timedelta(days=today.weekday())
    week_end = current_monday + pd.Timedelta(days=7)

    df["is_active_now"] = (
        ~df["status"].isin(EXCLUDED_STATUSES)
        & ~df["is_stale"]
        & (df["effective_start"] < week_end)
        & (df["effective_end"] >= current_monday)
    )

    return df


# ── Forecast ──────────────────────────────────────────────────────────────────

def forecast_weekly(bundle: DataBundle, phase_instances: pd.DataFrame) -> pd.DataFrame:
    """Return workload fractions per CA per week.

    Index: pd.DatetimeIndex of week Mondays (horizon_weeks + 1 rows).
    Columns: active CA ids (sorted).
    Values: workload fraction (1.0 = full capacity).
    """
    today = pd.Timestamp(bundle.config["today"])
    horizon = int(bundle.config["forecast_horizon_weeks"])
    capacity = float(bundle.config["weekly_capacity_hrs"])

    active_cas: list[str] = sorted(
        bundle.persons.loc[bundle.persons["active"] == 1, "ca_sheet"].tolist()
    )
    weeks = _week_series(today, horizon)

    # Only non-stale, non-excluded phases can contribute
    pi = phase_instances[
        ~phase_instances["status"].isin(EXCLUDED_STATUSES)
        & ~phase_instances["is_stale"]
    ]

    if pi.empty:
        return pd.DataFrame(
            0.0,
            index=pd.DatetimeIndex(weeks),
            columns=active_cas,
        )

    # Vectorised overlap: build (W × N) boolean matrix once
    eff_starts = pi["effective_start"].values.astype("datetime64[ns]")
    eff_ends = pi["effective_end"].values.astype("datetime64[ns]")
    vh_vals = pi["vh"].values.astype(float)
    ca_ids = pi["ca_id"].values

    ws_np = np.array([w.to_datetime64() for w in weeks])          # (W,)
    we_np = ws_np + np.timedelta64(7, "D")                         # (W,)

    overlap = (
        (eff_starts[np.newaxis, :] < we_np[:, np.newaxis])         # (W, N)
        & (eff_ends[np.newaxis, :] >= ws_np[:, np.newaxis])
    )

    rows: list[dict] = []
    for i in range(len(weeks)):
        mask = overlap[i]
        row: dict[str, float] = {ca: 0.0 for ca in active_cas}
        if mask.any():
            a_vh = vh_vals[mask]
            a_ca = ca_ids[mask]
            for ca in np.unique(a_ca):
                if ca in row:
                    row[ca] = float(a_vh[a_ca == ca].sum()) / capacity
        rows.append(row)

    df = pd.DataFrame(rows, index=pd.DatetimeIndex(weeks))
    return df[active_cas]


def forecast_monthly(weekly_df: pd.DataFrame) -> pd.DataFrame:
    """Average weekly workloads by calendar month (Month-Start index)."""
    return weekly_df.resample("MS").mean()


# ── KPIs ──────────────────────────────────────────────────────────────────────

def n_active_topics_per_ca(phase_instances: pd.DataFrame) -> dict[str, int]:
    """Count of distinct topics with at least one phase active now, per CA."""
    active = phase_instances[phase_instances["is_active_now"]]
    return active.groupby("ca_id")["topic_id"].nunique().to_dict()


def peak_analysis(weekly_df: pd.DataFrame) -> dict[str, dict]:
    """Peak workload fraction and corresponding week per CA."""
    result: dict[str, dict] = {}
    for ca in weekly_df.columns:
        series = weekly_df[ca]
        peak_val = float(series.max())
        peak_ts = series.idxmax()
        result[ca] = {
            "peak_workload": peak_val,
            "peak_week": peak_ts.strftime("%Y-%m-%d") if pd.notna(peak_ts) else None,
        }
    return result


# ── Criticality matrix ────────────────────────────────────────────────────────

_COMPLEXITY_LEVELS = ['Très faible', 'Faible', 'Moyen', 'Fort', 'Très fort']
_JALONNEMENT_LEVELS = ['Bon', 'Moyen', 'Faible', 'Critique']


def criticality_matrix(
    bundle: DataBundle,
    phase_instances: pd.DataFrame,
) -> dict:
    """Build a Complexity × Jalonnement criticality matrix, one entry per topic.

    Only topics that have at least one non-excluded phase are included.
    Topics without a complexity level are counted separately (unscored_topics).

    Jalonnement score per topic = fraction of non-CANCELED phases that are
    on track: either already VAL, or has both dates + effective_end > today
    + not stale.

    Returns:
        cells           – 20 dicts (5 complexity × 4 jalonnement), each with
                          complexity_level, jalonnement_level, count, topics
        total_topics    – topics placed in the matrix
        unscored_topics – topics skipped due to missing complexity level
    """
    today = pd.Timestamp(bundle.config["today"])
    ca_display = bundle.persons.set_index("ca_sheet")["ca_display"].to_dict()

    # Topics that have at least one active (non-excluded) phase
    relevant_ids: set[int] = set(
        int(tid) for tid in
        phase_instances[
            ~phase_instances["status"].isin(EXCLUDED_STATUSES)
        ]["topic_id"].unique()
    )

    cells: dict[tuple[str, str], list[dict]] = {
        (c, j): [] for c in _COMPLEXITY_LEVELS for j in _JALONNEMENT_LEVELS
    }
    unscored = 0

    for topic_id, topic_phases in phase_instances.groupby("topic_id"):
        if int(topic_id) not in relevant_ids:
            continue

        topic_rows = bundle.topics[bundle.topics["id"] == topic_id]
        if topic_rows.empty:
            continue
        tr = topic_rows.iloc[0]

        # Complexity level
        c_level = _opt_str(tr.get("complexity_level"))
        if c_level not in _COMPLEXITY_LEVELS:
            unscored += 1
            continue
        c_score = float(tr.get("complexity_score", 0.0) or 0.0)

        # Jalonnement: ignore CANCELED phases entirely
        non_canceled = topic_phases[topic_phases["status"] != "CANCELED"]
        total = len(non_canceled)
        if total == 0:
            j_level = "Critique"
            j_score = 0.0
        else:
            val_count = int((non_canceled["status"] == "VAL").sum())
            active_phases = non_canceled[non_canceled["status"] != "VAL"]
            on_track = active_phases[
                active_phases["scheduled_start"].notna()
                & active_phases["scheduled_end"].notna()
                & (active_phases["effective_end"] > today)
                & ~active_phases["is_stale"]
            ]
            j_score = (val_count + len(on_track)) / total
            if j_score >= 0.75:
                j_level = "Bon"
            elif j_score >= 0.50:
                j_level = "Moyen"
            elif j_score >= 0.25:
                j_level = "Faible"
            else:
                j_level = "Critique"

        ca_id = str(tr["ca_sheet"])
        cells[(c_level, j_level)].append({
            "topic_id": int(topic_id),
            "topic": str(tr["topic"]),
            "project": _opt_str(tr.get("project")) or "",
            "ca_id": ca_id,
            "ca_display": ca_display.get(ca_id, ca_id),
            "complexity_score": round(c_score, 1),
            "complexity_level": c_level,
            "jalonnement_score": round(j_score, 3),
            "jalonnement_level": j_level,
        })

    result = [
        {
            "complexity_level": c,
            "jalonnement_level": j,
            "count": len(cells[(c, j)]),
            "topics": cells[(c, j)],
        }
        for c in _COMPLEXITY_LEVELS
        for j in _JALONNEMENT_LEVELS
    ]

    return {
        "cells": result,
        "total_topics": sum(cell["count"] for cell in result),
        "unscored_topics": unscored,
    }


# ── Smoothing ─────────────────────────────────────────────────────────────────

def smoothing_suggestions(
    bundle: DataBundle,
    phase_instances: pd.DataFrame,
    weekly_df: pd.DataFrame,
    min_gap: float = 0.10,
) -> dict:
    """Iteratively rebalance team workload toward equal distribution.

    Optimises the mean workload across the full forecast horizon (not just
    week 0). Each candidate topic is scored by its average weekly load
    contribution across all horizon weeks so transfers with long-lasting
    impact are preferred. Stops only when the gap between the most- and
    least-loaded CA falls below min_gap or no improving transfer exists.

    Returns:
        suggestions          – ordered list of transfer dicts
        team_balance_before  – load std-dev before any transfers (mean-based)
        team_balance_after   – load std-dev after applying all suggestions
    """
    capacity = float(bundle.config["weekly_capacity_hrs"])
    today = pd.Timestamp(bundle.config["today"])
    ca_display = bundle.persons.set_index("ca_sheet")["ca_display"].to_dict()

    # Full-horizon mean workload per CA (not just week 0)
    working = weekly_df.mean().copy()
    balance_before = float(working.std())

    # Precompute week boundaries for vectorised overlap counting
    weeks_np = weekly_df.index.values.astype("datetime64[ns]")
    weeks_end_np = weeks_np + np.timedelta64(7, "D")
    H = max(len(weeks_np), 1)

    # Broad candidate pool: any non-excluded, non-stale, still-future topic
    pool = phase_instances[
        ~phase_instances["status"].isin(EXCLUDED_STATUSES)
        & ~phase_instances["is_stale"]
        & (phase_instances["effective_end"] > today)
    ]

    transferred_topics: set[int] = set()
    suggestions: list[dict] = []

    for _ in range(100):  # safety cap — real stop is min_gap / no valid move
        from_ca = str(working.idxmax())
        to_ca = str(working.idxmin())

        if working[from_ca] - working[to_ca] < min_gap:
            break

        ca_pool = pool[
            (pool["ca_id"] == from_ca)
            & ~pool["topic_id"].isin(transferred_topics)
        ]
        if ca_pool.empty:
            break

        best_topic_id: Optional[int] = None
        best_std = float(working.std())
        best_contribution = 0.0

        for topic_id in ca_pool["topic_id"].unique():
            topic_phases = ca_pool[ca_pool["topic_id"] == topic_id]

            eff_starts = topic_phases["effective_start"].values.astype("datetime64[ns]")
            eff_ends = topic_phases["effective_end"].values.astype("datetime64[ns]")
            vh_vals = topic_phases["vh"].values.astype(float)

            # Weeks each phase overlaps — shape (n_phases, H)
            overlap = (
                (eff_starts[:, np.newaxis] < weeks_end_np[np.newaxis, :])
                & (eff_ends[:, np.newaxis] >= weeks_np[np.newaxis, :])
            )
            weeks_per_phase = overlap.sum(axis=1)
            mean_contrib = float((vh_vals / capacity * weeks_per_phase).sum()) / H

            if mean_contrib == 0.0:
                continue

            new_to = working[to_ca] + mean_contrib
            if new_to > working[from_ca]:
                continue

            temp = working.copy()
            temp[from_ca] -= mean_contrib
            temp[to_ca] = new_to
            new_std = float(temp.std())

            if new_std < best_std:
                best_std = new_std
                best_topic_id = int(topic_id)
                best_contribution = mean_contrib

        if best_topic_id is None:
            break

        topic_rows = bundle.topics[bundle.topics["id"] == best_topic_id]
        if topic_rows.empty:
            break
        topic_row = topic_rows.iloc[0]

        suggestions.append({
            "from_ca_id": from_ca,
            "from_ca_display": ca_display.get(from_ca, from_ca),
            "to_ca_id": to_ca,
            "to_ca_display": ca_display.get(to_ca, to_ca),
            "topic_id": best_topic_id,
            "topic": str(topic_row["topic"]),
            "project": str(topic_row["project"]),
            "impact": {
                "from_before": round(float(working[from_ca]), 3),
                "from_after": round(float(working[from_ca]) - best_contribution, 3),
                "to_before": round(float(working[to_ca]), 3),
                "to_after": round(float(working[to_ca]) + best_contribution, 3),
            },
        })

        working[from_ca] -= best_contribution
        working[to_ca] += best_contribution
        transferred_topics.add(best_topic_id)

    return {
        "suggestions": suggestions,
        "team_balance_before": round(balance_before, 4),
        "team_balance_after": round(float(working.std()), 4),
    }


# ── Data quality ──────────────────────────────────────────────────────────────

def data_quality(
    bundle: DataBundle,
    phase_instances: pd.DataFrame,
    weekly_df: pd.DataFrame,
) -> list[dict]:
    """Per-CA data quality assessment for the forecast page.

    quality_score = 0.4 × date_coverage + 0.3 × future_coverage + 0.3 × (1 - stale_ratio)

    Also computes reliable_horizon_weeks: the last week index (from today) where
    at least 2 non-stale, non-excluded phases are active for that CA.
    """
    today = pd.Timestamp(bundle.config["today"])
    horizon = int(bundle.config["forecast_horizon_weeks"])
    ca_display = bundle.persons.set_index("ca_sheet")["ca_display"].to_dict()

    weeks = _week_series(today, horizon)
    eff_starts = phase_instances["effective_start"].values.astype("datetime64[ns]")
    eff_ends = phase_instances["effective_end"].values.astype("datetime64[ns]")
    ca_ids = phase_instances["ca_id"].values
    is_stale = phase_instances["is_stale"].values
    status_vals = phase_instances["status"].values

    ws_np = np.array([w.to_datetime64() for w in weeks])
    we_np = ws_np + np.timedelta64(7, "D")
    overlap = (
        (eff_starts[np.newaxis, :] < we_np[:, np.newaxis])
        & (eff_ends[np.newaxis, :] >= ws_np[:, np.newaxis])
    )

    result: list[dict] = []
    for ca_id in weekly_df.columns:
        mask_ca = ca_ids == ca_id
        ca_pi = phase_instances[mask_ca]

        total = len(ca_pi)
        if total == 0:
            result.append({
                "ca_id": str(ca_id),
                "ca_display": ca_display.get(str(ca_id), str(ca_id)),
                "quality_score": 0.0,
                "date_coverage": 0.0,
                "future_coverage": 0.0,
                "stale_ratio": 1.0,
                "reliable_horizon_weeks": 0,
            })
            continue

        # date_coverage: % phases with both start and end defined
        has_both = ca_pi["scheduled_start"].notna() & ca_pi["scheduled_end"].notna()
        date_coverage = float(has_both.sum()) / total

        # future_coverage: % phases whose effective_end is in the future
        future_mask = ca_pi["effective_end"] > today
        future_coverage = float(future_mask.sum()) / total

        # stale_ratio
        stale_ratio = float(ca_pi["is_stale"].sum()) / total

        quality_score = round(
            0.4 * date_coverage + 0.3 * future_coverage + 0.3 * (1.0 - stale_ratio),
            3,
        )

        # reliable_horizon: last week where >= 2 non-stale, non-excluded phases active
        ca_overlap_idx = np.where(mask_ca)[0]
        ca_is_stale = is_stale[ca_overlap_idx]
        ca_status = status_vals[ca_overlap_idx]
        non_stale_non_excl = ~ca_is_stale & ~np.isin(ca_status, list(EXCLUDED_STATUSES))

        reliable_horizon = 0
        for w_i in range(len(weeks)):
            row_overlap = overlap[w_i][ca_overlap_idx]
            active_count = int((row_overlap & non_stale_non_excl).sum())
            if active_count >= 2:
                reliable_horizon = w_i

        result.append({
            "ca_id": str(ca_id),
            "ca_display": ca_display.get(str(ca_id), str(ca_id)),
            "quality_score": quality_score,
            "date_coverage": round(date_coverage, 3),
            "future_coverage": round(future_coverage, 3),
            "stale_ratio": round(stale_ratio, 3),
            "reliable_horizon_weeks": reliable_horizon,
        })

    return result


# ── Decisions ─────────────────────────────────────────────────────────────────

def decisions(bundle: DataBundle, weekly_df: pd.DataFrame) -> list[dict]:
    """Generate HIGH / MEDIUM / LOW action recommendations.

    HIGH:   current workload > 1.0 (individual CA) or avg team > 1.0
    MEDIUM: current ok but peak within forecast horizon > 1.0, or avg team > 0.85
    LOW:    everything nominal
    """
    ca_display = bundle.persons.set_index("ca_sheet")["ca_display"].to_dict()
    current = weekly_df.iloc[0]
    peak = weekly_df.max()

    result: list[dict] = []

    # Team-level decision
    avg = float(current.mean())
    team_peak_ts = weekly_df.mean(axis=1).idxmax()
    team_peak_week = (
        team_peak_ts.strftime("%d/%m/%Y") if pd.notna(team_peak_ts) else None
    )
    if avg > 1.0:
        result.append({
            "priority": "HIGH",
            "ca_id": None,
            "ca_display": None,
            "message": "Charge moyenne équipe dépasse la capacité.",
            "current_load": round(avg, 3),
            "peak_load": round(float(weekly_df.mean(axis=1).max()), 3),
            "peak_week": team_peak_week,
        })
    elif avg > 0.85:
        result.append({
            "priority": "MEDIUM",
            "ca_id": None,
            "ca_display": None,
            "message": "Charge moyenne équipe élevée — surveiller les pics.",
            "current_load": round(avg, 3),
            "peak_load": round(float(weekly_df.mean(axis=1).max()), 3),
            "peak_week": team_peak_week,
        })

    # Per-CA decisions
    _order = {"HIGH": 0, "MEDIUM": 1, "LOW": 2}
    for ca_id in current.index:
        curr = float(current[ca_id])
        pk = float(peak[ca_id])
        disp = ca_display.get(ca_id, ca_id)
        peak_week_ts = weekly_df[ca_id].idxmax()
        peak_week_str = (
            peak_week_ts.strftime("%d/%m/%Y") if pd.notna(peak_week_ts) else None
        )

        if curr > 1.0:
            result.append({
                "priority": "HIGH",
                "ca_id": ca_id,
                "ca_display": disp,
                "message": "Surcharge actuelle — transfert de dossiers requis.",
                "current_load": round(curr, 3),
                "peak_load": round(pk, 3),
                "peak_week": peak_week_str,
            })
        elif pk > 1.0:
            result.append({
                "priority": "MEDIUM",
                "ca_id": ca_id,
                "ca_display": disp,
                "message": f"Pic de surcharge prévu — anticiper.",
                "current_load": round(curr, 3),
                "peak_load": round(pk, 3),
                "peak_week": peak_week_str,
            })
        else:
            result.append({
                "priority": "LOW",
                "ca_id": ca_id,
                "ca_display": disp,
                "message": "Charge nominale.",
                "current_load": round(curr, 3),
                "peak_load": round(pk, 3),
                "peak_week": peak_week_str,
            })

    result.sort(key=lambda x: _order[x["priority"]])
    return result
