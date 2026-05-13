import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { fetchCa } from '@/lib/api'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts'
import type { ActivePhaseOut, TopicOut, WeekWorkload } from '@/lib/types'

function pct(v: number) {
  return `${(v * 100).toFixed(0)}%`
}

const LEVEL_BG: Record<string, string> = {
  'Très faible': 'bg-green-100 text-green-800',
  'Faible':      'bg-lime-100 text-lime-800',
  'Moyen':       'bg-amber-100 text-amber-800',
  'Fort':        'bg-orange-100 text-orange-800',
  'Très fort':   'bg-red-100 text-red-800',
}

function ComplexityBadge({ level }: { level: string | null }) {
  if (!level) return null
  const cls = LEVEL_BG[level] ?? 'bg-gray-100 text-gray-700'
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded-full text-[10px] font-medium ${cls}`}>
      {level}
    </span>
  )
}

function ForecastCurve({ data }: { data: WeekWorkload[] }) {
  const chartData = data.map((d) => ({
    week: d.cw_label,
    workload: d.workload,
  }))
  // Sample every 2nd week for readability
  const sampled = chartData.filter((_, i) => i % 2 === 0)

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={sampled} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="wlGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="week" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
        <YAxis tickFormatter={pct} tick={{ fontSize: 10 }} domain={[0, 'auto']} />
        <Tooltip formatter={(v) => pct(Number(v))} labelFormatter={(l) => `${l}`} />
        <ReferenceLine y={1} stroke="#ef4444" strokeDasharray="4 4" />
        <Area
          type="monotone"
          dataKey="workload"
          stroke="#6366f1"
          fill="url(#wlGrad)"
          strokeWidth={2}
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

function ActivePhasesList({ phases }: { phases: ActivePhaseOut[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Topic</TableHead>
          <TableHead>Projet</TableHead>
          <TableHead>Phase</TableHead>
          <TableHead>Complexité</TableHead>
          <TableHead>Fin prevue</TableHead>
          <TableHead className="text-right">VH (h/sem)</TableHead>
          <TableHead className="text-right">% cap.</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {phases.map((p, i) => (
          <TableRow key={i}>
            <TableCell className="font-medium text-sm">{p.topic}</TableCell>
            <TableCell className="text-sm text-muted-foreground">{p.project}</TableCell>
            <TableCell className="text-sm capitalize">{p.phase}</TableCell>
            <TableCell><ComplexityBadge level={p.complexity_level} /></TableCell>
            <TableCell className="text-sm text-muted-foreground">{p.end ?? '—'}</TableCell>
            <TableCell className="text-right tabular-nums text-sm">{p.vh.toFixed(2)}</TableCell>
            <TableCell className="text-right tabular-nums text-sm text-slate-500">{(p.vh_pct * 100).toFixed(1)}%</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function TopicsList({ topics }: { topics: TopicOut[] }) {
  const [search, setSearch] = useState('')
  const filtered = search
    ? topics.filter(
        (t) =>
          t.topic.toLowerCase().includes(search.toLowerCase()) ||
          t.project.toLowerCase().includes(search.toLowerCase())
      )
    : topics

  return (
    <div className="space-y-3">
      <input
        type="text"
        placeholder="Rechercher..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full max-w-xs border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
      />
      <div className="max-h-80 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Topic</TableHead>
              <TableHead>Projet</TableHead>
              <TableHead>Complexité</TableHead>
              <TableHead>Fournisseur</TableHead>
              <TableHead>Statut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium text-sm">{t.topic}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{t.project}</TableCell>
                <TableCell><ComplexityBadge level={t.complexity_level} /></TableCell>
                <TableCell className="text-sm text-muted-foreground">{t.supplier ?? '—'}</TableCell>
                <TableCell className="text-sm">{t.global_status ?? '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {search && (
        <p className="text-xs text-muted-foreground">
          {filtered.length} / {topics.length} topics
        </p>
      )}
    </div>
  )
}

export function CaDetailPage() {
  const { caId } = useParams<{ caId: string }>()
  const navigate = useNavigate()

  const { data, isLoading, error } = useQuery({
    queryKey: ['ca', caId],
    queryFn: () => fetchCa(caId!),
    enabled: !!caId,
  })

  if (isLoading)
    return (
      <div className="p-8 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48" />
        <Skeleton className="h-64" />
      </div>
    )

  if (error) return <div className="p-8 text-sm text-red-600">{(error as Error).message}</div>
  if (!data) return null

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/team')} className="text-slate-500 hover:text-slate-900">
          <ArrowLeft className="h-4 w-4" />
          Équipe
        </Button>
        <div className="border-l-4 border-indigo-500 pl-4">
          <h1 className="text-2xl font-bold text-slate-900">{data.ca_display}</h1>
          <p className="text-sm text-slate-500">
            Charge actuelle&nbsp;: <span className={`font-semibold ${data.current_workload > 1 ? 'text-red-600' : 'text-slate-700'}`}>{(data.current_workload * 100).toFixed(0)}%</span>
            &nbsp;·&nbsp;{data.topics.length} topics
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Prevision de charge (78 semaines)</CardTitle>
        </CardHeader>
        <CardContent>
          <ForecastCurve data={data.weekly_forecast} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">
            Phases actives ({data.active_phases.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {data.active_phases.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Aucune phase active cette semaine
            </p>
          ) : (
            <ActivePhasesList phases={data.active_phases} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">
            Tous les topics ({data.topics.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <TopicsList topics={data.topics} />
        </CardContent>
      </Card>
    </div>
  )
}
