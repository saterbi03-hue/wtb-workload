import type {
  CaDetailResponse,
  CriticalityMatrixResponse,
  DataWarningsResponse,
  DecisionOut,
  ForecastResponse,
  OverviewResponse,
  SmoothingResponse,
  TeamRow,
  UploadResponse,
} from './types'

const BASE = '/api'

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

export async function uploadFile(file: File): Promise<UploadResponse> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${BASE}/upload`, { method: 'POST', body: form })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<UploadResponse>
}

export const fetchOverview = (weeks = 26) =>
  get<OverviewResponse>(`/overview?weeks=${weeks}`)

export const fetchTeam = () => get<TeamRow[]>('/team')

export const fetchCa = (caId: string) =>
  get<CaDetailResponse>(`/ca/${encodeURIComponent(caId)}`)

export const fetchForecast = (view: 'weekly' | 'monthly', caIds?: string[]) => {
  const params = new URLSearchParams({ view })
  caIds?.forEach((id) => params.append('ca_id', id))
  return get<ForecastResponse>(`/forecast?${params}`)
}

export const fetchSmoothing = () => get<SmoothingResponse>('/smoothing')

export const fetchDecisions = () => get<DecisionOut[]>('/decisions')

export const fetchComplexity = () => get<CriticalityMatrixResponse>('/complexity')

export const fetchDataWarnings = () => get<DataWarningsResponse>('/data-warnings')
