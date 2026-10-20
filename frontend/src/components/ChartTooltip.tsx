import { fmt, fmtDate } from '../lib/sim'

interface Row { name: string; value: number | null | undefined; color: string; unit?: string; digits?: number }

/** Shared tooltip body: date heading + one row per series, values in ink (not series colour). */
export function TooltipBox({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <div className="min-w-[190px] rounded-xl border border-line bg-surface/95 px-3 py-2.5 text-xs shadow-2xl backdrop-blur">
      <div className="mb-1.5 font-semibold text-ink">{title}</div>
      {rows.map((r) => (
        <div key={r.name} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-2 text-ink-2">
            <span className="h-2 w-2 rounded-full" style={{ background: r.color }} />
            {r.name}
          </span>
          <span className="tabular font-semibold text-ink">
            {fmt(r.value, r.digits ?? 0)} {r.unit && <span className="font-normal text-muted">{r.unit}</span>}
          </span>
        </div>
      ))}
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function makeTooltip(spec: { key: string; name: string; color: string; unit?: string; digits?: number }[], dateKey = 'date') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function Tip({ active, payload }: any) {
    if (!active || !payload?.length) return null
    const row = payload[0].payload
    const d = row[dateKey]
    const title = typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) ? fmtDate(d) : typeof d === 'string' && /^\d{4}-\d{2}$/.test(d) ? fmtDate(d + '-01', { month: 'long', year: 'numeric' }) : String(d)
    return <TooltipBox title={title} rows={spec.filter((s) => row[s.key] !== undefined).map((s) => ({ ...s, value: row[s.key] }))} />
  }
}

export const axisProps = {
  stroke: 'var(--axis)',
  tickLine: false,
  axisLine: { stroke: 'var(--axis)' },
  tick: { fill: 'var(--muted)', fontSize: 12 },
} as const

export const gridProps = { stroke: 'var(--grid)', vertical: false } as const

export const compact = (v: number) =>
  Math.abs(v) >= 100000 ? `${(v / 100000).toFixed(v % 100000 === 0 ? 0 : 1)}L` : Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}k` : String(v)
