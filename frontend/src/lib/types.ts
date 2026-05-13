// ── Upload ────────────────────────────────────────────────────────────────────

export interface ConfigOut {
  today: string
  weekly_capacity_hrs: number
  catchup_window_weeks: number
  stale_threshold_weeks: number
  forecast_horizon_weeks: number
}

export interface PersonOut {
  ca_id: string
  ca_display: string
  n_topics: number
}

export interface UploadResponse {
  n_topics: number
  n_active_cas: number
  config: ConfigOut
  persons: PersonOut[]
}

// ── Overview ──────────────────────────────────────────────────────────────────

export interface KpisOut {
  total_active_topics: number
  total_active_cas: number
  avg_workload: number
  max_workload: number
  max_workload_ca: string
}

export interface WeekWorkload {
  week: string
  cw: string
  cw_label: string
  cw_year: number
  cw_number: number
  workload: number
}

export interface CaHeatmapRow {
  ca_id: string
  ca_display: string
  weeks: WeekWorkload[]
}

export interface OverviewResponse {
  kpis: KpisOut
  heatmap: CaHeatmapRow[]
}

// ── Team ──────────────────────────────────────────────────────────────────────

export interface TeamRow {
  ca_id: string
  ca_display: string
  current_workload: number
  peak_workload: number
  peak_week: string
  n_active_topics: number
}

// ── CA Detail ─────────────────────────────────────────────────────────────────

export interface PhaseDetail {
  phase: string
  start: string | null
  end: string | null
  status: string | null
}

export interface TopicOut {
  id: number
  project: string
  topic: string
  supplier: string | null
  global_status: string | null
  complexity_score: number
  complexity_level: string | null
  phases: PhaseDetail[]
}

export interface ActivePhaseOut {
  topic: string
  project: string
  phase: string
  start: string | null
  end: string | null
  vh: number
  vh_pct: number
  complexity_score: number
  complexity_level: string | null
}

export interface CaDetailResponse {
  ca_id: string
  ca_display: string
  current_workload: number
  weekly_forecast: WeekWorkload[]
  active_phases: ActivePhaseOut[]
  topics: TopicOut[]
}

// ── Forecast ──────────────────────────────────────────────────────────────────

export interface ForecastSeries {
  ca_id: string
  ca_display: string
  values: number[]
}

export interface DataQualityRow {
  ca_id: string
  ca_display: string
  quality_score: number
  date_coverage: number
  future_coverage: number
  stale_ratio: number
  reliable_horizon_weeks: number
}

export interface ForecastResponse {
  view: string
  labels: string[]
  series: ForecastSeries[]
  data_quality: DataQualityRow[]
}

// ── Smoothing ─────────────────────────────────────────────────────────────────

export interface ImpactOut {
  from_before: number
  from_after: number
  to_before: number
  to_after: number
}

export interface SmoothingSuggestion {
  from_ca_id: string
  from_ca_display: string
  to_ca_id: string
  to_ca_display: string
  topic_id: number
  topic: string
  project: string
  impact: ImpactOut
}

export interface SmoothingResponse {
  suggestions: SmoothingSuggestion[]
  team_balance_before: number
  team_balance_after: number
}

// ── Decisions ─────────────────────────────────────────────────────────────────

export interface DecisionOut {
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
  ca_id: string | null
  ca_display: string | null
  message: string
  current_load: number | null
  peak_load: number | null
  peak_week: string | null
}

// ── Criticality matrix ────────────────────────────────────────────────────────

export interface TopicCriticalityItem {
  topic_id: number
  topic: string
  project: string
  ca_id: string
  ca_display: string
  complexity_score: number
  complexity_level: string
  jalonnement_score: number
  jalonnement_level: string
}

export interface CriticalityCellOut {
  complexity_level: string
  jalonnement_level: string
  count: number
  topics: TopicCriticalityItem[]
}

export interface CriticalityMatrixResponse {
  cells: CriticalityCellOut[]
  total_topics: number
  unscored_topics: number
}

// ── Data warnings ─────────────────────────────────────────────────────────────

export interface DataWarningItem {
  severity: 'ERROR' | 'WARNING'
  code: string
  ca_id: string
  ca_display: string
  topic_id: number
  topic: string
  project: string
  phase: string
  detail: string
}

export interface DataWarningsResponse {
  warnings: DataWarningItem[]
  total: number
  errors: number
}
