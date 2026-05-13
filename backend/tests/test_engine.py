import pytest
import pandas as pd
from domain.engine import (
    EXCLUDED_STATUSES,
    build_phase_instances,
    criticality_matrix,
    data_quality,
    data_warnings,
    forecast_weekly,
    forecast_monthly,
    n_active_topics_per_ca,
    peak_analysis,
    smoothing_suggestions,
    decisions,
    to_calendar_week,
)
from domain.loader import DataBundle


# ── build_phase_instances ─────────────────────────────────────────────────────

def test_phase_instances_excludes_inactive_cas(bundle: DataBundle):
    pi = build_phase_instances(bundle)
    inactive = set(bundle.persons.loc[bundle.persons["active"] == 0, "ca_sheet"])
    assert not set(pi["ca_id"]).intersection(inactive)


def test_phase_instances_excludes_null_date_phases(bundle: DataBundle):
    pi = build_phase_instances(bundle)
    # Every remaining row must have at least one non-null scheduled date
    has_date = pi["scheduled_start"].notna() | pi["scheduled_end"].notna()
    assert has_date.all()


def test_phase_instances_excluded_status_not_active_now(bundle: DataBundle):
    pi = build_phase_instances(bundle)
    active_now = pi[pi["is_active_now"]]
    assert not active_now["status"].isin(EXCLUDED_STATUSES).any()


def test_stale_phases_not_active_now(bundle: DataBundle):
    pi = build_phase_instances(bundle)
    stale_active = pi[pi["is_stale"] & pi["is_active_now"]]
    assert stale_active.empty


def test_effective_start_not_before_today(bundle: DataBundle):
    pi = build_phase_instances(bundle)
    today = pd.Timestamp(bundle.config["today"])
    assert (pi["effective_start"] >= today).all()


def test_effective_end_gte_effective_start(bundle: DataBundle):
    pi = build_phase_instances(bundle)
    assert (pi["effective_end"] >= pi["effective_start"]).all()


def test_vh_formula(bundle: DataBundle):
    """VH = duration_hrs / delai_weeks for each phase."""
    pi = build_phase_instances(bundle)
    for phase in ["advanced", "digital", "static", "dynamic", "delivery"]:
        params = bundle.phase_params.loc[phase]
        expected_vh = float(params["duration_hrs"]) / float(params["delai_weeks"])
        phase_rows = pi[pi["phase"] == phase]
        if not phase_rows.empty:
            assert abs(phase_rows["vh"].iloc[0] - expected_vh) < 1e-9


# ── forecast_weekly ───────────────────────────────────────────────────────────

def test_forecast_weekly_shape(bundle: DataBundle):
    pi = build_phase_instances(bundle)
    wkly = forecast_weekly(bundle, pi)
    horizon = int(bundle.config["forecast_horizon_weeks"])
    expected_rows = horizon + 1
    assert len(wkly) == expected_rows


def test_forecast_weekly_columns_are_active_cas(bundle: DataBundle):
    pi = build_phase_instances(bundle)
    wkly = forecast_weekly(bundle, pi)
    active_cas = set(bundle.persons.loc[bundle.persons["active"] == 1, "ca_sheet"])
    assert set(wkly.columns) == active_cas


def test_forecast_weekly_non_negative(bundle: DataBundle):
    pi = build_phase_instances(bundle)
    wkly = forecast_weekly(bundle, pi)
    assert (wkly >= 0).all().all()


def test_forecast_weekly_index_are_mondays(bundle: DataBundle):
    pi = build_phase_instances(bundle)
    wkly = forecast_weekly(bundle, pi)
    # weekday() == 0 means Monday
    assert all(ts.weekday() == 0 for ts in wkly.index)


# ── forecast_monthly ──────────────────────────────────────────────────────────

def test_forecast_monthly_index_is_month_start(bundle: DataBundle):
    pi = build_phase_instances(bundle)
    wkly = forecast_weekly(bundle, pi)
    mthly = forecast_monthly(wkly)
    assert all(ts.day == 1 for ts in mthly.index)


# ── KPIs ──────────────────────────────────────────────────────────────────────

def test_n_active_topics_per_ca_non_negative(bundle: DataBundle):
    pi = build_phase_instances(bundle)
    counts = n_active_topics_per_ca(pi)
    assert all(v >= 0 for v in counts.values())


def test_peak_analysis_keys(bundle: DataBundle):
    pi = build_phase_instances(bundle)
    wkly = forecast_weekly(bundle, pi)
    peak = peak_analysis(wkly)
    for ca in wkly.columns:
        assert ca in peak
        assert "peak_workload" in peak[ca]
        assert peak[ca]["peak_workload"] >= 0


# ── decisions ─────────────────────────────────────────────────────────────────

def test_decisions_priorities(bundle: DataBundle):
    pi = build_phase_instances(bundle)
    wkly = forecast_weekly(bundle, pi)
    dec = decisions(bundle, wkly)
    valid = {"HIGH", "MEDIUM", "LOW"}
    assert all(d["priority"] in valid for d in dec)


def test_decisions_sorted(bundle: DataBundle):
    pi = build_phase_instances(bundle)
    wkly = forecast_weekly(bundle, pi)
    dec = decisions(bundle, wkly)
    order = {"HIGH": 0, "MEDIUM": 1, "LOW": 2}
    priorities = [order[d["priority"]] for d in dec]
    assert priorities == sorted(priorities)


# ── smoothing_suggestions ─────────────────────────────────────────────────────

def test_smoothing_returns_dict_shape(bundle: DataBundle):
    pi = build_phase_instances(bundle)
    wkly = forecast_weekly(bundle, pi)
    result = smoothing_suggestions(bundle, pi, wkly)
    assert "suggestions" in result
    assert "team_balance_before" in result
    assert "team_balance_after" in result
    assert isinstance(result["suggestions"], list)


def test_smoothing_balance_after_lte_before(bundle: DataBundle):
    """Every transfer must reduce or maintain team load std-dev."""
    pi = build_phase_instances(bundle)
    wkly = forecast_weekly(bundle, pi)
    result = smoothing_suggestions(bundle, pi, wkly)
    assert result["team_balance_after"] <= result["team_balance_before"] + 1e-9


def test_smoothing_no_topic_moved_twice(bundle: DataBundle):
    """Each topic_id must appear at most once across all suggestions."""
    pi = build_phase_instances(bundle)
    wkly = forecast_weekly(bundle, pi)
    result = smoothing_suggestions(bundle, pi, wkly)
    topic_ids = [s["topic_id"] for s in result["suggestions"]]
    assert len(topic_ids) == len(set(topic_ids))


def test_smoothing_transfer_never_inverts_gap(bundle: DataBundle):
    """After each transfer the receiver must not become more loaded than the sender was."""
    pi = build_phase_instances(bundle)
    wkly = forecast_weekly(bundle, pi)
    result = smoothing_suggestions(bundle, pi, wkly)
    for s in result["suggestions"]:
        impact = s["impact"]
        assert impact["to_after"] <= impact["from_before"] + 1e-9


def test_smoothing_balance_improves_or_stays(bundle: DataBundle):
    pi = build_phase_instances(bundle)
    wkly = forecast_weekly(bundle, pi)
    result = smoothing_suggestions(bundle, pi, wkly)
    assert result["team_balance_after"] <= result["team_balance_before"] + 1e-9


# ── criticality_matrix ───────────────────────────────────────────────────────

def test_criticality_matrix_returns_all_cells(bundle: DataBundle):
    pi = build_phase_instances(bundle)
    result = criticality_matrix(bundle, pi)
    assert len(result["cells"]) == 20  # 5 complexity × 4 jalonnement


def test_criticality_matrix_counts_non_negative(bundle: DataBundle):
    pi = build_phase_instances(bundle)
    result = criticality_matrix(bundle, pi)
    assert all(cell["count"] >= 0 for cell in result["cells"])


def test_criticality_matrix_total_equals_cell_sum(bundle: DataBundle):
    pi = build_phase_instances(bundle)
    result = criticality_matrix(bundle, pi)
    assert result["total_topics"] == sum(cell["count"] for cell in result["cells"])


def test_criticality_matrix_jalonnement_scores_in_range(bundle: DataBundle):
    pi = build_phase_instances(bundle)
    result = criticality_matrix(bundle, pi)
    for cell in result["cells"]:
        for t in cell["topics"]:
            assert 0.0 <= t["jalonnement_score"] <= 1.0


def test_complexity_phase_instances_have_score_column(bundle: DataBundle):
    pi = build_phase_instances(bundle)
    assert "complexity_score" in pi.columns
    assert "complexity_level" in pi.columns
    assert (pi["complexity_score"] >= 0).all()


# ── to_calendar_week ──────────────────────────────────────────────────────────

def test_to_calendar_week_year_transition():
    """2025-12-29 est le lundi de la semaine ISO 1 de 2026."""
    result = to_calendar_week(pd.Timestamp("2025-12-29"))
    assert result["cw"] == "CW01-2026"


def test_to_calendar_week_normal():
    """2026-04-27 est le lundi de la semaine ISO 18 de 2026."""
    result = to_calendar_week(pd.Timestamp("2026-04-27"))
    assert result["cw"] == "CW18-2026"


# ── data_quality ──────────────────────────────────────────────────────────────

def test_data_quality_one_row_per_active_ca(bundle: DataBundle):
    pi = build_phase_instances(bundle)
    wkly = forecast_weekly(bundle, pi)
    rows = data_quality(bundle, pi, wkly)
    assert len(rows) == len(wkly.columns)


def test_data_quality_scores_bounded(bundle: DataBundle):
    pi = build_phase_instances(bundle)
    wkly = forecast_weekly(bundle, pi)
    rows = data_quality(bundle, pi, wkly)
    for r in rows:
        assert 0.0 <= r["quality_score"] <= 1.0
        assert 0.0 <= r["date_coverage"] <= 1.0
        assert 0.0 <= r["stale_ratio"] <= 1.0


def test_data_quality_reliable_horizon_non_negative(bundle: DataBundle):
    pi = build_phase_instances(bundle)
    wkly = forecast_weekly(bundle, pi)
    rows = data_quality(bundle, pi, wkly)
    assert all(r["reliable_horizon_weeks"] >= 0 for r in rows)


# ── data_warnings ─────────────────────────────────────────────────────────────

# ── forecast CW filter ────────────────────────────────────────────────────────

def test_forecast_cw_range_valid():
    """CW filter keeps only weeks inside [cw_from, cw_to]."""
    from api.routes.forecast import _parse_cw
    # 2026-04-13 is CW16, +4 weeks gives CW16…CW20
    mondays = pd.date_range("2026-04-13", periods=5, freq="W-MON")
    df = pd.DataFrame(
        {"CA1": [float(i) for i in range(5)]},
        index=pd.DatetimeIndex(mondays),
    )
    key_from = _parse_cw("CW17-2026")
    key_to   = _parse_cw("CW19-2026")
    iso = df.index.isocalendar()
    cw_keys = (iso["year"] * 100 + iso["week"]).values
    keep = [key_from <= k <= key_to for k in cw_keys]
    filtered = df[keep]
    assert len(filtered) == 3
    from domain.engine import to_calendar_week
    labels = [to_calendar_week(ts)["cw"] for ts in filtered.index]
    assert labels == ["CW17-2026", "CW18-2026", "CW19-2026"]


def test_forecast_cw_invalid_format():
    """_parse_cw raises ValueError for malformed CW strings (route returns 400)."""
    from api.routes.forecast import _parse_cw
    for bad in ("CW18/2026", "18-2026", "cw18-2026", "CW18-26", "CW183-2026", ""):
        with pytest.raises(ValueError):
            _parse_cw(bad)


def test_data_warnings_detects_inverted_dates():
    """A phase with start > end must produce an INVERTED_DATES ERROR."""
    today = pd.Timestamp("2026-05-12")
    topics = pd.DataFrame([{
        "id": 1,
        "ca_sheet": "CA1", "ca_display": "CA One",
        "project": "P", "topic": "T",
        "supplier": None, "global_status": "EN COURS",
        "advanced_start": today + pd.Timedelta(weeks=4),  # start AFTER end
        "advanced_end":   today + pd.Timedelta(weeks=1),
        "advanced_status": "EN COURS",
        **{f"{ph}_{s}": (pd.NaT if s in ("start", "end") else None)
           for ph in ["digital", "static", "dynamic", "delivery"]
           for s in ("start", "end", "status")},
        "complexity_score": 0.0, "complexity_level": None,
    }])
    phase_params = pd.DataFrame([
        {"phase": p, "duration_hrs": 10.0, "delai_weeks": 4}
        for p in ["advanced", "digital", "static", "dynamic", "delivery"]
    ]).set_index("phase")
    persons = pd.DataFrame([{"ca_sheet": "CA1", "ca_display": "CA One", "active": 1}])
    config = {
        "today": today, "weekly_capacity_hrs": 40.0,
        "catchup_window_weeks": 2, "stale_threshold_weeks": 4,
        "forecast_horizon_weeks": 4,
    }
    bundle = DataBundle(topics=topics, phase_params=phase_params,
                        persons=persons, config=config)
    result = data_warnings(bundle)
    inv = [w for w in result["warnings"] if w["code"] == "INVERTED_DATES"]
    assert len(inv) == 1
    assert inv[0]["severity"] == "ERROR"
    assert inv[0]["phase"] == "advanced"
    assert result["errors"] == 1
