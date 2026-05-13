import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, TrendingUp, CheckCircle2, Users } from 'lucide-react'
import { fetchDecisions } from '@/lib/api'
import { Skeleton } from '@/components/ui/skeleton'
import type { DecisionOut } from '@/lib/types'

type Priority = 'HIGH' | 'MEDIUM' | 'LOW'

function pct(v: number | null) {
  if (v === null) return '—'
  return `${(v * 100).toFixed(0)}%`
}

function LoadBar({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted-foreground text-xs">—</span>
  const capped = Math.min(value, 2.0)
  const fill = (capped / 2.0) * 100
  const color =
    value > 1.0 ? 'bg-red-500' : value > 0.85 ? 'bg-amber-400' : 'bg-emerald-500'
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 rounded-full bg-muted overflow-hidden shrink-0">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${fill}%` }} />
      </div>
      <span
        className={`tabular-nums text-sm font-semibold w-10 ${
          value > 1.0
            ? 'text-red-600'
            : value > 0.85
            ? 'text-amber-600'
            : 'text-emerald-700'
        }`}
      >
        {pct(value)}
      </span>
    </div>
  )
}

const STATUS_CONFIG: Record<
  Priority,
  { label: string; classes: string; rowClasses: string }
> = {
  HIGH: {
    label: 'Surcharge',
    classes: 'text-red-700 bg-red-50 border-red-200',
    rowClasses: 'bg-red-50/40',
  },
  MEDIUM: {
    label: 'Pic à venir',
    classes: 'text-amber-700 bg-amber-50 border-amber-200',
    rowClasses: 'bg-amber-50/30',
  },
  LOW: {
    label: 'OK',
    classes: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    rowClasses: '',
  },
}

const ACTION_LABEL: Record<Priority, string> = {
  HIGH: 'Transférer dossiers',
  MEDIUM: 'Anticiper pic',
  LOW: '—',
}

function StatusBadge({ priority }: { priority: Priority }) {
  const cfg = STATUS_CONFIG[priority]
  return (
    <span
      className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded border ${cfg.classes}`}
    >
      {cfg.label}
    </span>
  )
}

function TeamBanner({ d }: { d: DecisionOut }) {
  const isHigh = d.priority === 'HIGH'
  return (
    <div
      className={`flex items-start gap-3 rounded-lg border px-4 py-3 ${
        isHigh
          ? 'bg-red-50 border-red-200 text-red-800'
          : 'bg-amber-50 border-amber-200 text-amber-800'
      }`}
    >
      <Users className="h-4 w-4 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">Équipe — {isHigh ? 'Surcharge globale' : 'Charge élevée'}</p>
        <p className="text-xs mt-0.5 opacity-80">{d.message}</p>
      </div>
      <div className="text-right shrink-0 space-y-0.5">
        <p className="text-xs opacity-70">Charge actuelle</p>
        <p className="text-lg font-bold tabular-nums">{pct(d.current_load)}</p>
      </div>
    </div>
  )
}

function SummaryCard({
  count,
  label,
  icon,
  color,
}: {
  count: number
  label: string
  icon: React.ReactNode
  color: string
}) {
  return (
    <div className={`flex items-center gap-3 rounded-lg border px-4 py-3 ${color}`}>
      {icon}
      <div>
        <p className="text-2xl font-bold tabular-nums leading-none">{count}</p>
        <p className="text-xs mt-0.5 opacity-70">{label}</p>
      </div>
    </div>
  )
}

export function DecisionsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['decisions'],
    queryFn: fetchDecisions,
  })

  if (isLoading)
    return (
      <div className="p-8 space-y-3">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )

  if (error) return <div className="p-8 text-sm text-red-600">{(error as Error).message}</div>
  if (!data) return null

  const teamAlert = data.find((d) => d.ca_id === null)
  const perCa = data.filter((d) => d.ca_id !== null)

  const high = perCa.filter((d) => d.priority === 'HIGH')
  const medium = perCa.filter((d) => d.priority === 'MEDIUM')
  const low = perCa.filter((d) => d.priority === 'LOW')

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold">Décisions</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          État de charge par CA — actions recommandées
        </p>
      </div>

      {/* Summary KPIs */}
      <div className="flex flex-wrap gap-3">
        <SummaryCard
          count={high.length}
          label="en surcharge"
          icon={<AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />}
          color="border-red-200 bg-red-50 text-red-800"
        />
        <SummaryCard
          count={medium.length}
          label="pic à venir"
          icon={<TrendingUp className="h-5 w-5 text-amber-500 shrink-0" />}
          color="border-amber-200 bg-amber-50 text-amber-800"
        />
        <SummaryCard
          count={low.length}
          label="charge nominale"
          icon={<CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />}
          color="border-emerald-200 bg-emerald-50 text-emerald-800"
        />
      </div>

      {/* Team-level banner */}
      {teamAlert && <TeamBanner d={teamAlert} />}

      {/* Per-CA table */}
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                CA
              </th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Charge actuelle
              </th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Pic prévu
              </th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Semaine pic
              </th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Statut
              </th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {perCa.map((d) => {
              const cfg = STATUS_CONFIG[d.priority]
              return (
                <tr key={d.ca_id} className={`${cfg.rowClasses} hover:bg-muted/30 transition-colors`}>
                  <td className="px-4 py-3 font-medium whitespace-nowrap">{d.ca_display}</td>
                  <td className="px-4 py-3">
                    <LoadBar value={d.current_load} />
                  </td>
                  <td className="px-4 py-3">
                    <LoadBar value={d.peak_load} />
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                    {d.peak_week ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge priority={d.priority} />
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {ACTION_LABEL[d.priority]}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
