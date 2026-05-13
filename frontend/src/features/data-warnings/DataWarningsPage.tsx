import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, XCircle, Filter } from 'lucide-react'
import { fetchDataWarnings } from '@/lib/api'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import type { DataWarningItem } from '@/lib/types'

const SEVERITY_STYLE: Record<string, string> = {
  ERROR:   'bg-red-100 text-red-700 border border-red-200',
  WARNING: 'bg-amber-100 text-amber-700 border border-amber-200',
}

const CODE_LABEL: Record<string, string> = {
  INVERTED_DATES: 'Dates inversées',
  PARTIAL_DATES:  'Date manquante',
}

function SeverityBadge({ severity }: { severity: string }) {
  const cls = SEVERITY_STYLE[severity] ?? 'bg-gray-100 text-gray-700'
  const Icon = severity === 'ERROR' ? XCircle : AlertTriangle
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${cls}`}>
      <Icon className="h-3 w-3" />
      {severity}
    </span>
  )
}

function WarningsTable({ warnings }: { warnings: DataWarningItem[] }) {
  if (warnings.length === 0)
    return <p className="text-sm text-muted-foreground py-6 text-center">Aucun avertissement.</p>

  return (
    <div className="overflow-auto max-h-[600px]">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-28">Sévérité</TableHead>
            <TableHead className="w-36">Code</TableHead>
            <TableHead>CA</TableHead>
            <TableHead>Topic</TableHead>
            <TableHead>Projet</TableHead>
            <TableHead>Phase</TableHead>
            <TableHead>Détail</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {warnings.map((w, i) => (
            <TableRow key={i} className={w.severity === 'ERROR' ? 'bg-red-50/40' : ''}>
              <TableCell><SeverityBadge severity={w.severity} /></TableCell>
              <TableCell className="text-xs font-mono text-slate-600">
                {CODE_LABEL[w.code] ?? w.code}
              </TableCell>
              <TableCell className="text-sm font-medium">{w.ca_display}</TableCell>
              <TableCell className="text-sm max-w-[200px] truncate" title={w.topic}>{w.topic}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{w.project}</TableCell>
              <TableCell className="text-sm capitalize">{w.phase}</TableCell>
              <TableCell className="text-xs text-slate-500">{w.detail}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export function DataWarningsPage() {
  const [filter, setFilter] = useState<'ALL' | 'ERROR' | 'WARNING'>('ALL')

  const { data, isLoading, error } = useQuery({
    queryKey: ['data-warnings'],
    queryFn: fetchDataWarnings,
  })

  if (isLoading)
    return (
      <div className="p-8 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    )

  if (error) return <div className="p-8 text-sm text-red-600">{(error as Error).message}</div>
  if (!data) return null

  const warnings_count = data.total - data.errors
  const visible = filter === 'ALL' ? data.warnings : data.warnings.filter(w => w.severity === filter)

  return (
    <div className="p-8 space-y-6">
      <div className="border-l-4 border-red-500 pl-4">
        <h1 className="text-2xl font-bold text-slate-900">Avertissements données</h1>
        <p className="text-sm text-slate-500 mt-1">
          Problèmes structurels détectés dans les phases actives
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-slate-200">
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Total</p>
            <p className="text-3xl font-bold text-slate-800 mt-1">{data.total}</p>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50/50">
          <CardContent className="pt-5">
            <p className="text-xs text-red-500 uppercase tracking-wide">Erreurs</p>
            <p className="text-3xl font-bold text-red-700 mt-1">{data.errors}</p>
            <p className="text-[11px] text-red-400 mt-0.5">Dates inversées</p>
          </CardContent>
        </Card>
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="pt-5">
            <p className="text-xs text-amber-500 uppercase tracking-wide">Avertissements</p>
            <p className="text-3xl font-bold text-amber-700 mt-1">{warnings_count}</p>
            <p className="text-[11px] text-amber-400 mt-0.5">Dates partielles</p>
          </CardContent>
        </Card>
      </div>

      {/* Table with filter */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Filter className="h-4 w-4 text-slate-400" />
              {visible.length} entrée{visible.length !== 1 ? 's' : ''}
              {filter !== 'ALL' && <span className="text-muted-foreground">· filtre : {filter}</span>}
            </CardTitle>
            <div className="flex gap-1.5">
              {(['ALL', 'ERROR', 'WARNING'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    filter === f
                      ? 'bg-slate-800 text-white'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  {f === 'ALL' ? 'Tous' : f}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <WarningsTable warnings={visible} />
        </CardContent>
      </Card>
    </div>
  )
}
