import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchComplexity } from '@/lib/api'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { TopicCriticalityItem } from '@/lib/types'

// ── Axis definitions ──────────────────────────────────────────────────────────

const COMPLEXITY_LEVELS = ['Très faible', 'Faible', 'Moyen', 'Fort', 'Très fort'] as const
// Displayed top-to-bottom: worst jalonnement at top so danger zone is top-right
const JALONNEMENT_ROWS = ['Critique', 'Faible', 'Moyen', 'Bon'] as const

type ComplexityLevel = typeof COMPLEXITY_LEVELS[number]
type JalonnementLevel = typeof JALONNEMENT_ROWS[number]

// ── Cell colour ───────────────────────────────────────────────────────────────

const CELL_COLORS: Record<ComplexityLevel, Record<JalonnementLevel, string>> = {
  'Très faible': {
    'Critique': 'bg-amber-100 hover:bg-amber-200 border-amber-200',
    'Faible':   'bg-yellow-50 hover:bg-yellow-100 border-yellow-200',
    'Moyen':    'bg-emerald-50 hover:bg-emerald-100 border-emerald-200',
    'Bon':      'bg-emerald-50 hover:bg-emerald-100 border-emerald-200',
  },
  'Faible': {
    'Critique': 'bg-orange-100 hover:bg-orange-200 border-orange-200',
    'Faible':   'bg-amber-100 hover:bg-amber-200 border-amber-200',
    'Moyen':    'bg-yellow-50 hover:bg-yellow-100 border-yellow-200',
    'Bon':      'bg-emerald-100 hover:bg-emerald-200 border-emerald-200',
  },
  'Moyen': {
    'Critique': 'bg-orange-200 hover:bg-orange-300 border-orange-300',
    'Faible':   'bg-orange-100 hover:bg-orange-200 border-orange-200',
    'Moyen':    'bg-amber-100 hover:bg-amber-200 border-amber-200',
    'Bon':      'bg-yellow-50 hover:bg-yellow-100 border-yellow-200',
  },
  'Fort': {
    'Critique': 'bg-red-200 hover:bg-red-300 border-red-300',
    'Faible':   'bg-red-100 hover:bg-red-200 border-red-200',
    'Moyen':    'bg-orange-100 hover:bg-orange-200 border-orange-200',
    'Bon':      'bg-amber-100 hover:bg-amber-200 border-amber-200',
  },
  'Très fort': {
    'Critique': 'bg-red-400 hover:bg-red-500 border-red-500',
    'Faible':   'bg-red-200 hover:bg-red-300 border-red-300',
    'Moyen':    'bg-orange-200 hover:bg-orange-300 border-orange-300',
    'Bon':      'bg-orange-100 hover:bg-orange-200 border-orange-200',
  },
}

const TEXT_COLORS: Record<ComplexityLevel, Record<JalonnementLevel, string>> = {
  'Très faible': { 'Critique': 'text-amber-800',   'Faible': 'text-yellow-800',  'Moyen': 'text-emerald-700', 'Bon': 'text-emerald-700' },
  'Faible':      { 'Critique': 'text-orange-800',  'Faible': 'text-amber-800',   'Moyen': 'text-yellow-800',  'Bon': 'text-emerald-800' },
  'Moyen':       { 'Critique': 'text-orange-900',  'Faible': 'text-orange-800',  'Moyen': 'text-amber-800',   'Bon': 'text-yellow-800'  },
  'Fort':        { 'Critique': 'text-red-900',     'Faible': 'text-red-800',     'Moyen': 'text-orange-800',  'Bon': 'text-amber-800'   },
  'Très fort':   { 'Critique': 'text-white',       'Faible': 'text-red-900',     'Moyen': 'text-orange-900',  'Bon': 'text-orange-800'  },
}

// ── Legend ────────────────────────────────────────────────────────────────────

const LEGEND = [
  { color: 'bg-emerald-100 border-emerald-200', label: 'Faible risque' },
  { color: 'bg-yellow-100 border-yellow-200',   label: 'Risque modéré' },
  { color: 'bg-amber-100 border-amber-200',     label: 'Risque élevé' },
  { color: 'bg-orange-200 border-orange-300',   label: 'Risque fort' },
  { color: 'bg-red-300 border-red-400',         label: 'Critique' },
]

// ── Topic detail table ────────────────────────────────────────────────────────

function pct(v: number) { return `${(v * 100).toFixed(0)}%` }

function JalBadge({ level }: { level: string }) {
  const cls =
    level === 'Bon'      ? 'bg-emerald-100 text-emerald-800' :
    level === 'Moyen'    ? 'bg-yellow-100 text-yellow-800' :
    level === 'Faible'   ? 'bg-orange-100 text-orange-800' :
                           'bg-red-100 text-red-800'
  return <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${cls}`}>{level}</span>
}

function TopicTable({ topics }: { topics: TopicCriticalityItem[] }) {
  const sorted = [...topics].sort((a, b) => b.complexity_score - a.complexity_score)
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b text-xs text-muted-foreground uppercase tracking-wide">
          <th className="text-left pb-2 font-medium">Topic</th>
          <th className="text-left pb-2 font-medium">Projet</th>
          <th className="text-left pb-2 font-medium">CA</th>
          <th className="text-right pb-2 font-medium">Complexité</th>
          <th className="text-right pb-2 font-medium">Jalonnement</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((t) => (
          <tr key={t.topic_id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
            <td className="py-2 font-medium max-w-[220px] truncate">{t.topic}</td>
            <td className="py-2 text-muted-foreground">{t.project}</td>
            <td className="py-2 text-muted-foreground text-xs">{t.ca_display}</td>
            <td className="py-2 text-right tabular-nums">{t.complexity_score.toFixed(1)}</td>
            <td className="py-2 text-right">
              <JalBadge level={t.jalonnement_level} />
              <span className="ml-1.5 tabular-nums text-xs text-muted-foreground">{pct(t.jalonnement_score)}</span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function ComplexityPage() {
  const [selected, setSelected] = useState<{ c: ComplexityLevel; j: JalonnementLevel } | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['complexity'],
    queryFn: fetchComplexity,
  })

  // Build lookup: cellMap[complexity][jalonnement] → cell
  const cellMap = useMemo(() => {
    const map: Partial<Record<ComplexityLevel, Partial<Record<JalonnementLevel, { count: number; topics: TopicCriticalityItem[] }>>>> = {}
    data?.cells.forEach((cell) => {
      const c = cell.complexity_level as ComplexityLevel
      const j = cell.jalonnement_level as JalonnementLevel
      if (!map[c]) map[c] = {}
      map[c]![j] = { count: cell.count, topics: cell.topics }
    })
    return map
  }, [data])

  const selectedCell = selected ? cellMap[selected.c]?.[selected.j] : null

  if (isLoading)
    return (
      <div className="p-8 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64" />
      </div>
    )

  if (error) return <div className="p-8 text-sm text-red-600">{(error as Error).message}</div>
  if (!data) return null

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold">Matrice de criticité</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {data.total_topics} topics évalués
          {data.unscored_topics > 0 && (
            <span className="ml-2 text-amber-600">
              · {data.unscored_topics} sans score de complexité (exclus)
            </span>
          )}
        </p>
      </div>

      {/* Matrix */}
      <Card>
        <CardContent className="pt-6 pb-5 overflow-x-auto">
          <div className="inline-block min-w-full">
            {/* Column headers — Complexité */}
            <div className="flex items-end mb-1 pl-28">
              {COMPLEXITY_LEVELS.map((c) => (
                <div key={c} className="w-32 shrink-0 text-center">
                  <span className="text-[11px] font-medium text-muted-foreground leading-tight block px-1">{c}</span>
                </div>
              ))}
            </div>

            {/* Rows */}
            {JALONNEMENT_ROWS.map((j) => (
              <div key={j} className="flex items-stretch mb-1">
                {/* Row label */}
                <div className="w-28 shrink-0 flex items-center justify-end pr-3">
                  <span className="text-xs font-medium text-muted-foreground">{j}</span>
                </div>

                {/* Cells */}
                {COMPLEXITY_LEVELS.map((c) => {
                  const cell = cellMap[c]?.[j]
                  const count = cell?.count ?? 0
                  const isSelected = selected?.c === c && selected?.j === j
                  const bg = CELL_COLORS[c][j]
                  const tx = TEXT_COLORS[c][j]
                  return (
                    <button
                      key={c}
                      onClick={() => setSelected(isSelected ? null : { c, j })}
                      className={[
                        'w-32 h-20 shrink-0 border rounded-lg mx-0.5 flex flex-col items-center justify-center gap-0.5 transition-all',
                        bg,
                        isSelected ? 'ring-2 ring-offset-1 ring-foreground/30 shadow-md' : '',
                      ].join(' ')}
                    >
                      <span className={`text-2xl font-bold tabular-nums leading-none ${tx}`}>
                        {count > 0 ? count : '—'}
                      </span>
                      {count > 0 && (
                        <span className={`text-[10px] font-medium opacity-70 ${tx}`}>
                          topic{count > 1 ? 's' : ''}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            ))}

            {/* X axis label */}
            <div className="pl-28 mt-2 flex">
              <div className="flex-1 text-center">
                <span className="text-xs text-muted-foreground">Complexité →</span>
              </div>
            </div>
          </div>

          {/* Y axis label — left of grid */}
          <div className="flex items-center gap-3 mt-4 pl-2">
            <span className="text-xs text-muted-foreground">↑ Jalonnement critique &nbsp;·&nbsp; ↓ Bon jalonnement</span>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t">
            {LEGEND.map((l) => (
              <div key={l.label} className="flex items-center gap-1.5">
                <div className={`w-3 h-3 rounded border ${l.color}`} />
                <span className="text-[11px] text-muted-foreground">{l.label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Detail panel */}
      {selected && selectedCell && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <span>Complexité</span>
              <Badge variant="outline">{selected.c}</Badge>
              <span>×</span>
              <span>Jalonnement</span>
              <JalBadge level={selected.j} />
              <span className="text-muted-foreground font-normal ml-1">— {selectedCell.count} topic{selectedCell.count > 1 ? 's' : ''}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedCell.topics.length > 0 ? (
              <TopicTable topics={selectedCell.topics} />
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">Aucun topic dans cette case</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
