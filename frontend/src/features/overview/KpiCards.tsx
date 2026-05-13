import { BookOpen, Users, TrendingUp, Zap } from 'lucide-react'
import type { KpisOut } from '@/lib/types'

function pct(v: number) { return `${(v * 100).toFixed(0)}%` }

interface KpiCardProps {
  label: string
  value: string
  sub?: string
  icon: React.ElementType
  iconBg: string
  iconColor: string
  valueColor?: string
}

function KpiCard({ label, value, sub, icon: Icon, iconBg, iconColor, valueColor }: KpiCardProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 px-5 py-4 flex items-start gap-4 shadow-sm hover:shadow-md transition-shadow">
      <div className={`w-10 h-10 rounded-lg ${iconBg} flex items-center justify-center shrink-0`}>
        <Icon className={`w-5 h-5 ${iconColor}`} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide truncate">{label}</p>
        <p className={`text-2xl font-bold tabular-nums mt-0.5 ${valueColor ?? 'text-slate-900'}`}>{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5 truncate">{sub}</p>}
      </div>
    </div>
  )
}

export function KpiCards({ kpis }: { kpis: KpisOut }) {
  const avgColor = kpis.avg_workload > 1.0 ? 'text-red-600'
    : kpis.avg_workload > 0.85 ? 'text-amber-600'
    : 'text-emerald-600'

  const maxColor = kpis.max_workload > 1.0 ? 'text-red-600'
    : kpis.max_workload > 0.85 ? 'text-amber-600'
    : 'text-slate-900'

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <KpiCard
        label="Topics actifs"
        value={String(kpis.total_active_topics)}
        icon={BookOpen}
        iconBg="bg-blue-50"
        iconColor="text-blue-600"
      />
      <KpiCard
        label="CAs actifs"
        value={String(kpis.total_active_cas)}
        icon={Users}
        iconBg="bg-violet-50"
        iconColor="text-violet-600"
      />
      <KpiCard
        label="Charge moyenne"
        value={pct(kpis.avg_workload)}
        icon={TrendingUp}
        iconBg="bg-amber-50"
        iconColor="text-amber-600"
        valueColor={avgColor}
      />
      <KpiCard
        label="Charge maximale"
        value={pct(kpis.max_workload)}
        sub={kpis.max_workload_ca}
        icon={Zap}
        iconBg="bg-red-50"
        iconColor="text-red-500"
        valueColor={maxColor}
      />
    </div>
  )
}
