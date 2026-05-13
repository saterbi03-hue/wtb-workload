import type { CaHeatmapRow } from '@/lib/types'

function workloadBg(v: number): string {
  if (v <= 0.25) return '#f0fdf4'
  if (v <= 0.5) return '#bbf7d0'
  if (v <= 0.75) return '#fef08a'
  if (v <= 0.9) return '#fdba74'
  if (v <= 1.0) return '#f97316'
  return '#ef4444'
}

function workloadFg(v: number): string {
  return v > 0.75 ? '#fff' : '#1a1a1a'
}


interface Props {
  heatmap: CaHeatmapRow[]
}

export function HeatmapChart({ heatmap }: Props) {
  if (!heatmap.length) return null
  const weeks = heatmap[0].weeks

  return (
    <div className="overflow-x-auto">
      <table className="text-xs border-collapse min-w-max">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-background px-3 py-2 text-left font-medium text-muted-foreground min-w-36 border-b">
              CA
            </th>
            {weeks.map((w) => (
              <th
                key={w.week}
                className="px-1 py-2 text-center font-normal text-muted-foreground border-b min-w-[3.5rem]"
              >
                {w.cw_label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {heatmap.map((row) => (
            <tr key={row.ca_id} className="group">
              <td className="sticky left-0 z-10 bg-background px-3 py-1 font-medium border-b group-hover:bg-muted/50">
                {row.ca_display}
              </td>
              {row.weeks.map((w) => (
                <td
                  key={w.week}
                  className="border-b border-r border-muted/30 text-center py-1"
                  style={{
                    backgroundColor: workloadBg(w.workload),
                    color: workloadFg(w.workload),
                    minWidth: '3.5rem',
                  }}
                  title={`${row.ca_display} · ${w.week} · ${(w.workload * 100).toFixed(0)}%`}
                >
                  {w.workload > 0 ? `${(w.workload * 100).toFixed(0)}%` : ''}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Legend */}
      <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
        <span>Charge&nbsp;:</span>
        {[
          { label: '< 25%', bg: '#f0fdf4', fg: '#1a1a1a' },
          { label: '25–50%', bg: '#bbf7d0', fg: '#1a1a1a' },
          { label: '50–75%', bg: '#fef08a', fg: '#1a1a1a' },
          { label: '75–90%', bg: '#fdba74', fg: '#fff' },
          { label: '90–100%', bg: '#f97316', fg: '#fff' },
          { label: '> 100%', bg: '#ef4444', fg: '#fff' },
        ].map(({ label, bg, fg }) => (
          <span
            key={label}
            className="px-2 py-0.5 rounded"
            style={{ backgroundColor: bg, color: fg }}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}
