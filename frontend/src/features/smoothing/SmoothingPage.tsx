import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight,
  CheckCircle2,
  TrendingDown,
  Download,
  AlertTriangle,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { fetchSmoothing } from '@/lib/api'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'
import type { SmoothingSuggestion } from '@/lib/types'

function pct(v: number) {
  return `${(v * 100).toFixed(0)}%`
}

function WorkloadBar({ value, maxValue = 2.0 }: { value: number; maxValue?: number }) {
  const fill = Math.min(value / maxValue, 1)
  const color =
    value > 1.0 ? 'bg-red-500' : value > 0.85 ? 'bg-amber-400' : 'bg-emerald-500'
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-28 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${fill * 100}%` }}
        />
      </div>
      <span className="tabular-nums text-sm font-medium w-10">{pct(value)}</span>
    </div>
  )
}

function BalanceBadge({ label, value }: { label: string; value: number }) {
  const pctVal = (value * 100).toFixed(1)
  const color =
    value < 0.15
      ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
      : value < 0.30
      ? 'text-amber-600 bg-amber-50 border-amber-200'
      : 'text-red-600 bg-red-50 border-red-200'
  return (
    <div className={`flex flex-col items-center px-4 py-3 rounded-lg border text-center ${color}`}>
      <span className="text-xs font-medium uppercase tracking-wide opacity-70">{label}</span>
      <span className="text-2xl font-bold tabular-nums mt-0.5">σ {pctVal}%</span>
    </div>
  )
}

function TransferCard({
  suggestion,
  index,
}: {
  suggestion: SmoothingSuggestion
  index: number
}) {
  const { impact } = suggestion
  const hasWarning = impact.to_before < 0.05

  return (
    <Card className="overflow-hidden">
      <div className="flex items-stretch">
        <div className="w-10 shrink-0 bg-muted flex items-center justify-center">
          <span className="text-xs font-semibold text-muted-foreground">{index + 1}</span>
        </div>

        <CardContent className="flex-1 py-4 px-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-8">
            {/* Topic info */}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{suggestion.topic}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{suggestion.project}</p>
              <p className="text-xs text-slate-500 mt-1">
                Pic&nbsp;: <span className="font-medium text-slate-700">{suggestion.critical_week_cw}</span>
                {' · '}impact&nbsp;<span className="font-medium text-red-600">{(suggestion.critical_week_impact * 100).toFixed(1)}%</span>
              </p>
            </div>

            {/* From CA */}
            <div className="text-center shrink-0">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                {suggestion.from_ca_display}
              </p>
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-muted-foreground w-12 text-right">Avant</span>
                  <WorkloadBar value={impact.from_before} />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-muted-foreground w-12 text-right">Après</span>
                  <WorkloadBar value={impact.from_after} />
                </div>
              </div>
            </div>

            {/* Arrow */}
            <div className="flex flex-col items-center text-muted-foreground shrink-0">
              <ArrowRight className="h-5 w-5" />
            </div>

            {/* To CA */}
            <div className="text-center shrink-0">
              <div className="flex items-center justify-center gap-1.5 mb-2">
                <p className="text-xs font-medium text-muted-foreground">
                  {suggestion.to_ca_display}
                </p>
                {hasWarning && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded px-1 py-0.5 shrink-0">
                    <AlertTriangle className="h-2.5 w-2.5" />
                    Données incomplètes
                  </span>
                )}
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-muted-foreground w-12 text-right">Avant</span>
                  <WorkloadBar value={impact.to_before} />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-muted-foreground w-12 text-right">Après</span>
                  <WorkloadBar value={impact.to_after} />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </div>
    </Card>
  )
}

// Build per-CA before/after distribution from the cumulative transfer impacts
function buildDistribution(suggestions: SmoothingSuggestion[]) {
  const initial = new Map<string, number>()
  const final = new Map<string, number>()
  const names = new Map<string, string>()

  for (const s of suggestions) {
    if (!initial.has(s.from_ca_id)) initial.set(s.from_ca_id, s.impact.from_before)
    if (!initial.has(s.to_ca_id)) initial.set(s.to_ca_id, s.impact.to_before)
    final.set(s.from_ca_id, s.impact.from_after)
    final.set(s.to_ca_id, s.impact.to_after)
    names.set(s.from_ca_id, s.from_ca_display)
    names.set(s.to_ca_id, s.to_ca_display)
  }

  return Array.from(initial.keys())
    .map((ca) => ({
      name: names.get(ca) ?? ca,
      Avant: Math.round((initial.get(ca) ?? 0) * 100),
      Après: Math.round((final.get(ca) ?? initial.get(ca) ?? 0) * 100),
    }))
    .sort((a, b) => b.Avant - a.Avant)
}

function exportCSV(suggestions: SmoothingSuggestion[]) {
  const header = ['#', 'Sujet', 'Projet', 'De (CA)', 'Charge avant', 'Charge après', 'Vers (CA)', 'Charge avant', 'Charge après']
  const rows = suggestions.map((s, i) => [
    i + 1,
    `"${s.topic.replace(/"/g, '""')}"`,
    `"${s.project}"`,
    `"${s.from_ca_display}"`,
    `${(s.impact.from_before * 100).toFixed(0)}%`,
    `${(s.impact.from_after * 100).toFixed(0)}%`,
    `"${s.to_ca_display}"`,
    `${(s.impact.to_before * 100).toFixed(0)}%`,
    `${(s.impact.to_after * 100).toFixed(0)}%`,
  ])
  const csv = [header, ...rows].map((r) => r.join(',')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'lissage_charge.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export function SmoothingPage() {
  const [activeProject, setActiveProject] = useState<string>('Tous')

  const { data, isLoading, error } = useQuery({
    queryKey: ['smoothing'],
    queryFn: fetchSmoothing,
  })

  const projects = useMemo(() => {
    if (!data) return []
    const unique = Array.from(new Set(data.suggestions.map((s) => s.project))).filter(Boolean)
    return unique.sort()
  }, [data])

  const filtered = useMemo(() => {
    if (!data) return []
    if (activeProject === 'Tous') return data.suggestions
    return data.suggestions.filter((s) => s.project === activeProject)
  }, [data, activeProject])

  const distribution = useMemo(
    () => (data ? buildDistribution(data.suggestions) : []),
    [data],
  )

  if (isLoading)
    return (
      <div className="p-8 space-y-4">
        <Skeleton className="h-20 w-80" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-lg" />
        ))}
      </div>
    )

  if (error) return <div className="p-8 text-sm text-red-600">{(error as Error).message}</div>
  if (!data) return null

  const improvement =
    data.team_balance_before > 0
      ? ((data.team_balance_before - data.team_balance_after) / data.team_balance_before) * 100
      : 0

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Lissage de charge</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Transferts suggérés pour équilibrer la charge entre CAs
          </p>
        </div>
        {filtered.length > 0 && (
          <button
            onClick={() => exportCSV(filtered)}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-md border border-border bg-background hover:bg-muted transition-colors shrink-0"
          >
            <Download className="h-3.5 w-3.5" />
            Exporter CSV
          </button>
        )}
      </div>

      {/* Balance stats */}
      <div className="flex flex-wrap gap-4 items-center">
        <BalanceBadge label="Déséquilibre actuel" value={data.team_balance_before} />
        <TrendingDown className="h-5 w-5 text-muted-foreground shrink-0" />
        <BalanceBadge label="Après transferts" value={data.team_balance_after} />
        {improvement > 0 && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <div>
              <p className="text-xs font-medium">Amélioration</p>
              <p className="text-xl font-bold tabular-nums">{improvement.toFixed(0)}%</p>
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground -mt-2">
        Les pourcentages représentent la charge{' '}
        <strong>moyenne sur l'horizon de prévision</strong>, pas uniquement la semaine en cours.
      </p>

      {/* Before / after distribution chart */}
      {distribution.length > 0 && (
        <div className="rounded-lg border p-4">
          <p className="text-xs font-medium text-muted-foreground mb-3">
            Distribution de charge avant / après — tous transferts
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={distribution} margin={{ top: 4, right: 8, left: -16, bottom: 4 }}>
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10 }}
                tickFormatter={(v: string) => v.split(' ')[0]}
              />
              <YAxis
                tick={{ fontSize: 10 }}
                tickFormatter={(v: number) => `${v}%`}
                domain={[0, 'auto']}
              />
              <Tooltip formatter={(v) => (typeof v === 'number' ? `${v}%` : v)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <ReferenceLine y={100} stroke="#ef4444" strokeDasharray="3 3" strokeWidth={1.5} />
              <Bar dataKey="Avant" fill="#f59e0b" radius={[3, 3, 0, 0]} maxBarSize={28} />
              <Bar dataKey="Après" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
          <p className="text-[10px] text-muted-foreground mt-1 text-right">
            Ligne rouge = 100 % de capacité
          </p>
        </div>
      )}

      {data.suggestions.length === 0 ? (
        <div className="rounded-lg border p-12 text-center">
          <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-3" />
          <p className="text-sm font-medium">Charge déjà équilibrée</p>
          <p className="text-xs text-muted-foreground mt-1">
            L'écart entre CAs est inférieur à 10 % de capacité
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Project filter */}
          {projects.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {['Tous', ...projects].map((p) => (
                <button
                  key={p}
                  onClick={() => setActiveProject(p)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    activeProject === p
                      ? 'bg-foreground text-background border-foreground'
                      : 'border-border text-muted-foreground hover:border-foreground/40'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            {filtered.length} transfert{filtered.length > 1 ? 's' : ''} suggéré
            {filtered.length > 1 ? 's' : ''}
            {activeProject !== 'Tous' ? ` — ${activeProject}` : " — à appliquer dans l'ordre"}
          </p>

          {filtered.map((s, i) => (
            <TransferCard key={`${s.from_ca_id}-${s.topic_id}`} suggestion={s} index={i} />
          ))}
        </div>
      )}
    </div>
  )
}
