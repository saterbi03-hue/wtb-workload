import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ReferenceLine, ResponsiveContainer,
} from 'recharts'
import { AlertTriangle } from 'lucide-react'
import { fetchForecast } from '@/lib/api'
import { useApp } from '@/lib/context'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import type { DataQualityRow } from '@/lib/types'

const CA_COLORS = [
  '#6366f1', '#f59e0b', '#10b981', '#ef4444', '#3b82f6',
  '#ec4899', '#14b8a6', '#f97316', '#8b5cf6', '#84cc16', '#06b6d4',
]

function pct(v: number) { return `${(v * 100).toFixed(0)}%` }

function qualityColor(score: number) {
  if (score >= 0.7) return 'bg-emerald-500'
  if (score >= 0.5) return 'bg-amber-400'
  return 'bg-red-500'
}

function QualityDot({ score }: { score: number }) {
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full shrink-0 ${qualityColor(score)}`}
      title={`Qualité données : ${(score * 100).toFixed(0)}%`}
    />
  )
}

function QualityTooltip({ row }: { row: DataQualityRow }) {
  return (
    <div className="absolute z-50 bottom-full mb-1.5 left-1/2 -translate-x-1/2 bg-white border rounded-lg shadow-lg p-2.5 text-xs w-44 pointer-events-none">
      <p className="font-semibold mb-1">{row.ca_display}</p>
      <p className="text-muted-foreground">Qualité : <span className="font-medium text-foreground">{(row.quality_score * 100).toFixed(0)}%</span></p>
      <p className="text-muted-foreground">Dates renseignées : <span className="font-medium text-foreground">{(row.date_coverage * 100).toFixed(0)}%</span></p>
      <p className="text-muted-foreground">Phases futures : <span className="font-medium text-foreground">{(row.future_coverage * 100).toFixed(0)}%</span></p>
      <p className="text-muted-foreground">Phases obsolètes : <span className="font-medium text-foreground">{(row.stale_ratio * 100).toFixed(0)}%</span></p>
      <p className="text-muted-foreground">Horizon fiable : <span className="font-medium text-foreground">sem. {row.reliable_horizon_weeks}</span></p>
    </div>
  )
}

export function ForecastPage() {
  const { uploadData } = useApp()
  const [view, setView] = useState<'weekly' | 'monthly'>('weekly')
  const [selectedCas, setSelectedCas] = useState<string[]>([])
  const [hovered, setHovered] = useState<string | null>(null)
  const [cwFrom, setCwFrom] = useState<string>('')
  const [cwTo, setCwTo] = useState<string>('')

  const persons = uploadData?.persons ?? []

  const { data, isLoading, error } = useQuery({
    queryKey: ['forecast', view, selectedCas],
    queryFn: () => fetchForecast(view, selectedCas.length ? selectedCas : undefined),
  })

  // Initialise la fenêtre CW depuis la première réponse API
  useEffect(() => {
    if (data?.labels?.length && view === 'weekly') {
      setCwFrom((p) => p || data.labels[0])
      setCwTo((p) => p || data.labels[data.labels.length - 1])
    }
  }, [data, view])

  function toggleCa(caId: string) {
    setSelectedCas((prev) =>
      prev.includes(caId) ? prev.filter((x) => x !== caId) : [...prev, caId]
    )
  }

  if (isLoading)
    return (
      <div className="p-8 space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-80" />
      </div>
    )

  if (error) return <div className="p-8 text-sm text-red-600">{(error as Error).message}</div>
  if (!data) return null

  // Quality map: ca_id → quality row
  const qualityMap = Object.fromEntries(data.data_quality.map((q) => [q.ca_id, q]))

  // Which CAs are displayed
  const activeCas = data.series.filter((s) => !selectedCas.length || selectedCas.includes(s.ca_id))
  const poorQualityCas = activeCas.filter((s) => (qualityMap[s.ca_id]?.quality_score ?? 1) < 0.5)

  // Reliable horizon: median of selected CAs
  const horizons = activeCas
    .map((s) => qualityMap[s.ca_id]?.reliable_horizon_weeks ?? 0)
    .filter((h) => h > 0)
  const medianHorizon = horizons.length
    ? horizons.sort((a, b) => a - b)[Math.floor(horizons.length / 2)]
    : null

  // Build full Recharts data
  const chartData = data.labels.map((label, i) => {
    const point: Record<string, string | number> = { label }
    data.series.forEach((s) => { point[s.ca_id] = s.values[i] ?? 0 })
    return point
  })

  // CW window: slice by index (weekly only)
  const fromIdx = view === 'weekly' && cwFrom
    ? Math.max(0, data.labels.indexOf(cwFrom))
    : 0
  const toIdx = view === 'weekly' && cwTo
    ? Math.max(fromIdx, data.labels.indexOf(cwTo) >= 0 ? data.labels.indexOf(cwTo) : data.labels.length - 1)
    : data.labels.length - 1
  const windowedData = view === 'weekly' ? chartData.slice(fromIdx, toIdx + 1) : chartData

  const sampled = view === 'weekly'
    ? windowedData.filter((_, i) => i % 2 === 0)
    : chartData

  // Horizon label from full data, shown only if inside current window
  const sampledHorizonIdx = medianHorizon !== null
    ? Math.floor(medianHorizon / (view === 'weekly' ? 2 : 1))
    : null
  const fullSampled = view === 'weekly'
    ? chartData.filter((_, i) => i % 2 === 0)
    : chartData
  const rawHorizonLabel = sampledHorizonIdx !== null
    ? (fullSampled[sampledHorizonIdx]?.label ?? null)
    : null
  const horizonLabel = rawHorizonLabel && sampled.some((d) => d.label === rawHorizonLabel)
    ? rawHorizonLabel
    : null

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Prévisions</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Charge prévisionnelle hebdomadaire et mensuelle
        </p>
      </div>

      {/* Poor quality warning */}
      {poorQualityCas.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            <strong>Données insuffisantes</strong> pour {poorQualityCas.map((s) => s.ca_display).join(', ')} — prévisions estimées, à interpréter avec précaution.
          </span>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap gap-4 items-start">
        {/* View toggle */}
        <div className="flex gap-2">
          <Button size="sm" variant={view === 'weekly' ? 'default' : 'outline'} onClick={() => setView('weekly')}>
            Hebdomadaire
          </Button>
          <Button size="sm" variant={view === 'monthly' ? 'default' : 'outline'} onClick={() => setView('monthly')}>
            Mensuel
          </Button>
        </div>

        {/* CW window selector (weekly only) */}
        {view === 'weekly' && data.labels.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 shrink-0">Fenêtre :</span>
            <select
              value={cwFrom}
              onChange={(e) => setCwFrom(e.target.value)}
              className="border border-slate-200 rounded-md px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
            >
              {data.labels.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
            <span className="text-xs text-slate-400">→</span>
            <select
              value={cwTo}
              onChange={(e) => setCwTo(e.target.value)}
              className="border border-slate-200 rounded-md px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
            >
              {data.labels.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
        )}

        {/* CA filter chips with quality dots */}
        <div className="flex flex-wrap gap-1.5">
          {persons.map((p) => {
            const q = qualityMap[p.ca_id]
            const active = !selectedCas.length || selectedCas.includes(p.ca_id)
            return (
              <div key={p.ca_id} className="relative" onMouseEnter={() => setHovered(p.ca_id)} onMouseLeave={() => setHovered(null)}>
                <button
                  onClick={() => toggleCa(p.ca_id)}
                  className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-xs border transition-colors ${
                    active
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-muted-foreground border-muted'
                  }`}
                >
                  {q && <QualityDot score={q.quality_score} />}
                  {p.ca_id}
                </button>
                {hovered === p.ca_id && q && <QualityTooltip row={q} />}
              </div>
            )
          })}
          {selectedCas.length > 0 && (
            <button
              onClick={() => setSelectedCas([])}
              className="px-2 py-0.5 rounded text-xs border text-muted-foreground hover:bg-muted"
            >
              Tous
            </button>
          )}
        </div>
      </div>

      {/* Quality legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span>Qualité données :</span>
        {[['bg-emerald-500', '≥ 70 %'], ['bg-amber-400', '50–70 %'], ['bg-red-500', '< 50 %']].map(([cls, label]) => (
          <span key={label} className="flex items-center gap-1">
            <span className={`inline-block w-2 h-2 rounded-full ${cls}`} />
            {label}
          </span>
        ))}
      </div>

      {/* Chart */}
      <div className="rounded-lg border p-4">
        <ResponsiveContainer width="100%" height={400}>
          {view === 'weekly' ? (
            <LineChart data={sampled} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis tickFormatter={pct} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v) => pct(Number(v))} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <ReferenceLine y={1} stroke="#ef4444" strokeDasharray="4 4" label={{ value: '100%', fontSize: 10, fill: '#ef4444' }} />
              {horizonLabel && (
                <ReferenceLine
                  x={horizonLabel}
                  stroke="#94a3b8"
                  strokeDasharray="6 3"
                  label={{ value: 'Horizon fiable', fontSize: 9, fill: '#94a3b8', position: 'insideTopRight' }}
                />
              )}
              {activeCas.map((s, idx) => (
                <Line
                  key={s.ca_id}
                  type="monotone"
                  dataKey={s.ca_id}
                  name={s.ca_display}
                  stroke={CA_COLORS[idx % CA_COLORS.length]}
                  strokeWidth={1.5}
                  dot={false}
                  strokeOpacity={(qualityMap[s.ca_id]?.quality_score ?? 1) < 0.5 ? 0.45 : 1}
                  strokeDasharray={(qualityMap[s.ca_id]?.quality_score ?? 1) < 0.5 ? '5 3' : undefined}
                />
              ))}
            </LineChart>
          ) : (
            <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tickFormatter={pct} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v) => pct(Number(v))} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <ReferenceLine y={1} stroke="#ef4444" strokeDasharray="4 4" />
              {activeCas.map((s, i) => (
                <Bar
                  key={s.ca_id}
                  dataKey={s.ca_id}
                  name={s.ca_display}
                  fill={CA_COLORS[i % CA_COLORS.length]}
                  fillOpacity={(qualityMap[s.ca_id]?.quality_score ?? 1) < 0.5 ? 0.4 : 0.8}
                />
              ))}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  )
}
