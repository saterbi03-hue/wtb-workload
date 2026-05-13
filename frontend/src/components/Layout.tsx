import { NavLink, Outlet } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
  BarChart3,
  TrendingUp,
  Users,
  ArrowLeftRight,
  ClipboardList,
  Upload,
  Layers,
  Activity,
  AlertTriangle,
} from 'lucide-react'
import { useApp } from '@/lib/context'

const NAV_ITEMS = [
  { to: '/upload',     label: 'Upload',      icon: Upload },
  { to: '/overview',   label: 'Vue globale',  icon: BarChart3 },
  { to: '/team',       label: 'Équipe',       icon: Users },
  { to: '/forecast',   label: 'Prévisions',   icon: TrendingUp },
  { to: '/smoothing',  label: 'Lissage',      icon: ArrowLeftRight },
  { to: '/complexity', label: 'Complexité',   icon: Layers },
  { to: '/decisions',    label: 'Décisions',      icon: ClipboardList },
  { to: '/data-warnings', label: 'Avertissements', icon: AlertTriangle },
]

export function Layout() {
  const { uploadData } = useApp()

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 flex flex-col bg-slate-900 text-slate-100">
        {/* Brand */}
        <div className="px-5 py-5 border-b border-slate-700/60">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-500 flex items-center justify-center shrink-0">
              <Activity className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="font-semibold text-sm tracking-tight text-white">WTB Workload</p>
              {uploadData && (
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {uploadData.n_topics} topics · {uploadData.n_active_cas} CAs
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                  isActive
                    ? 'bg-indigo-600 text-white font-medium shadow-sm'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        {uploadData && (
          <div className="px-5 py-4 border-t border-slate-700/60">
            <p className="text-[11px] text-slate-500">Ancre · {uploadData.config.today}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Capacité · {uploadData.config.weekly_capacity_hrs} h/sem
            </p>
          </div>
        )}
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
