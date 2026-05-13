import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { fetchTeam } from '@/lib/api'
import { Skeleton } from '@/components/ui/skeleton'
import type { TeamRow } from '@/lib/types'

function pct(v: number) { return `${(v * 100).toFixed(0)}%` }

function WorkloadBar({ value }: { value: number }) {
  const fill = Math.min(value / 1.5, 1)
  const color = value > 1.0
    ? 'bg-red-500'
    : value > 0.85
    ? 'bg-amber-400'
    : 'bg-emerald-500'
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <div className="h-2 w-28 rounded-full bg-slate-100 overflow-hidden shrink-0">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${fill * 100}%` }} />
      </div>
      <span className={`tabular-nums text-sm font-semibold w-10 shrink-0 ${
        value > 1.0 ? 'text-red-600' : value > 0.85 ? 'text-amber-600' : 'text-slate-700'
      }`}>{pct(value)}</span>
    </div>
  )
}

type SortKey = 'ca_display' | 'current_workload' | 'peak_workload' | 'n_active_topics'
type SortDir = 'asc' | 'desc'

function SortIcon({ col, active, dir }: { col: string; active: string; dir: SortDir }) {
  if (col !== active) return <ArrowUpDown className="h-3 w-3 opacity-30" />
  return dir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
}

export function TeamPage() {
  const navigate = useNavigate()
  const [sortKey, setSortKey] = useState<SortKey>('current_workload')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const { data, isLoading, error } = useQuery({
    queryKey: ['team'],
    queryFn: fetchTeam,
  })

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  if (isLoading)
    return (
      <div className="p-8 space-y-3">
        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
      </div>
    )

  if (error) return <div className="p-8 text-sm text-red-600">{(error as Error).message}</div>
  if (!data) return null

  const sorted = [...data].sort((a: TeamRow, b: TeamRow) => {
    const av = a[sortKey] as number | string
    const bv = b[sortKey] as number | string
    const cmp = typeof av === 'string' ? av.localeCompare(bv as string) : (av as number) - (bv as number)
    return sortDir === 'asc' ? cmp : -cmp
  })

  const COLS: { key: SortKey; label: string; right?: boolean }[] = [
    { key: 'ca_display',        label: 'CA' },
    { key: 'current_workload',  label: 'Charge actuelle' },
    { key: 'peak_workload',     label: 'Charge pic' },
    { key: 'n_active_topics',   label: 'Topics actifs', right: true },
  ]

  return (
    <div className="p-8 space-y-6">
      <div className="border-l-4 border-indigo-500 pl-4">
        <h1 className="text-2xl font-bold text-slate-900">Équipe</h1>
        <p className="text-sm text-slate-500 mt-0.5">Charge actuelle et pic prévu pour chaque CA</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              {COLS.map(({ key, label, right }) => (
                <th
                  key={key}
                  className={`px-5 py-3.5 font-medium text-slate-500 ${right ? 'text-right' : 'text-left'}`}
                >
                  <button
                    onClick={() => handleSort(key)}
                    className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors"
                  >
                    {label}
                    <SortIcon col={key} active={sortKey} dir={sortDir} />
                  </button>
                </th>
              ))}
              <th className="px-5 py-3.5 text-left font-medium text-slate-500">Semaine pic</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, idx) => (
              <tr
                key={row.ca_id}
                onClick={() => navigate(`/ca/${row.ca_id}`)}
                className={`cursor-pointer border-b border-slate-100 last:border-0 hover:bg-indigo-50/50 transition-colors ${
                  idx % 2 === 0 ? '' : 'bg-slate-50/40'
                }`}
              >
                <td className="px-5 py-3.5">
                  <span className="font-semibold text-slate-800">{row.ca_display}</span>
                </td>
                <td className="px-5 py-3.5">
                  <WorkloadBar value={row.current_workload} />
                </td>
                <td className="px-5 py-3.5">
                  <WorkloadBar value={row.peak_workload} />
                </td>
                <td className="px-5 py-3.5 text-right">
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 text-slate-700 font-semibold text-xs">
                    {row.n_active_topics}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-slate-400 text-xs">{row.peak_week}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
