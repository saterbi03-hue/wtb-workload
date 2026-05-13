import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchOverview } from '@/lib/api'
import { KpiCards } from './KpiCards'
import { HeatmapChart } from './HeatmapChart'
import { Skeleton } from '@/components/ui/skeleton'

function PageSkeleton() {
  return (
    <div className="p-8 space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  )
}

export function OverviewPage() {
  const [weeks, setWeeks] = useState(26)

  const { data, isLoading, error } = useQuery({
    queryKey: ['overview', weeks],
    queryFn: () => fetchOverview(weeks),
  })

  if (isLoading) return <PageSkeleton />
  if (error) return (
    <div className="p-8 text-sm text-red-600">{(error as Error).message}</div>
  )
  if (!data) return null

  return (
    <div className="p-8 space-y-8">
      {/* Page header */}
      <div className="border-l-4 border-indigo-500 pl-4">
        <h1 className="text-2xl font-bold text-slate-900">Vue globale</h1>
        <p className="text-sm text-slate-500 mt-0.5">Charge actuelle et heatmap par semaine</p>
      </div>

      <KpiCards kpis={data.kpis} />

      {/* Heatmap section */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Heatmap CA × Semaines</h2>
            <p className="text-xs text-slate-400 mt-0.5">Charge hebdomadaire par collaborateur</p>
          </div>
          <div className="flex gap-1.5">
            {[12, 26, 52].map((w) => (
              <button
                key={w}
                onClick={() => setWeeks(w)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  weeks === w
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {w} sem.
              </button>
            ))}
          </div>
        </div>
        <div className="p-4">
          <HeatmapChart heatmap={data.heatmap} />
        </div>
      </div>
    </div>
  )
}
