import { animate, motion, useMotionValue, useTransform } from 'framer-motion'
import { AlertOctagon, AlertTriangle, CheckCircle2, Info, Loader2, TrendingDown } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import type { Zone } from '../lib/api'

export function Card({ children, className = '', title, subtitle, right }: {
  children: ReactNode; className?: string; title?: ReactNode; subtitle?: ReactNode; right?: ReactNode
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: 'easeOut' }}
      className={`card p-5 ${className}`}
    >
      {(title || right) && (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title && <h3 className="text-[15px] font-semibold text-ink">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p>}
          </div>
          {right}
        </header>
      )}
      {children}
    </motion.section>
  )
}

export function AnimatedNumber({ value, digits = 0 }: { value: number; digits?: number }) {
  const mv = useMotionValue(value)
  const text = useTransform(mv, (v) => v.toLocaleString('en-IN', { maximumFractionDigits: digits, minimumFractionDigits: digits }))
  useEffect(() => {
    const c = animate(mv, value, { duration: 0.6, ease: 'easeOut' })
    return c.stop
  }, [value, mv])
  return <motion.span>{text}</motion.span>
}

export function Stat({ label, value, unit, digits = 0, icon, hint, tone }: {
  label: string; value: number | null | undefined; unit?: string; digits?: number; icon?: ReactNode; hint?: ReactNode
  tone?: string
}) {
  return (
    <div className="card relative overflow-hidden p-4">
      <div className="flex items-center gap-2 text-[13px] font-medium text-muted">
        {icon && <span className="text-accent">{icon}</span>}
        {label}
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="text-[28px] font-bold tracking-tight text-ink" style={tone ? { color: tone } : undefined}>
          {value == null || Number.isNaN(value) ? '–' : <AnimatedNumber value={value} digits={digits} />}
        </span>
        {unit && <span className="text-sm text-muted">{unit}</span>}
      </div>
      {hint && <div className="mt-1 text-xs text-ink-2">{hint}</div>}
    </div>
  )
}

export const ZONE: Record<Zone, { label: string; color: string; icon: typeof Info; text: string }> = {
  normal: { label: 'Normal', color: 'var(--good)', icon: CheckCircle2, text: 'Storage within the safe operating band.' },
  caution: { label: 'Flood cushion', color: 'var(--warning)', icon: AlertTriangle, text: 'Above 95% of FRL storage: little room left to absorb a flood.' },
  low: { label: 'Low storage', color: 'var(--serious)', icon: TrendingDown, text: 'Within 5 TMC of MDDL: protect supply.' },
  flood_risk: { label: 'Above FRL', color: 'var(--critical)', icon: AlertOctagon, text: 'Projected storage exceeds Full Reservoir Level.' },
  below_mddl: { label: 'Below MDDL', color: 'var(--critical)', icon: AlertOctagon, text: 'Projected storage drops under the minimum drawdown level.' },
}

export function ZoneBadge({ zone, size = 'sm' }: { zone: Zone; size?: 'sm' | 'md' }) {
  const z = ZONE[zone]
  const Icon = z.icon
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${size === 'md' ? 'px-3 py-1 text-sm' : 'px-2.5 py-0.5 text-xs'}`}
      style={{ color: z.color, background: `color-mix(in srgb, ${z.color} 14%, transparent)`, border: `1px solid color-mix(in srgb, ${z.color} 35%, transparent)` }}
    >
      <Icon size={size === 'md' ? 15 : 13} strokeWidth={2.4} />
      {z.label}
    </span>
  )
}

export function PageHeader({ eyebrow, title, children, right }: { eyebrow: string; title: string; children?: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-3xl">
        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">{eyebrow}</div>
        <h1 className="mt-1 text-[28px] font-bold tracking-tight text-ink sm:text-[32px]">{title}</h1>
        {children && <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{children}</p>}
      </div>
      {right}
    </div>
  )
}

export function Callout({ tone = 'info', title, children }: { tone?: 'info' | 'warning'; title: string; children: ReactNode }) {
  const color = tone === 'warning' ? 'var(--warning)' : 'var(--accent)'
  const Icon = tone === 'warning' ? AlertTriangle : Info
  return (
    <div className="flex gap-3 rounded-2xl p-4 text-sm" style={{ background: `color-mix(in srgb, ${color} 9%, transparent)`, border: `1px solid color-mix(in srgb, ${color} 30%, transparent)` }}>
      <Icon size={18} style={{ color }} className="mt-0.5 shrink-0" />
      <div>
        <div className="font-semibold text-ink">{title}</div>
        <div className="mt-1 leading-relaxed text-ink-2">{children}</div>
      </div>
    </div>
  )
}

export function Loading({ h = 300 }: { h?: number }) {
  return (
    <div className="flex items-center justify-center text-muted" style={{ height: h }}>
      <Loader2 className="animate-spin" size={22} />
    </div>
  )
}

export function ErrorNote({ error }: { error: unknown }) {
  return <Callout tone="warning" title="Couldn't load this data">{error instanceof Error ? error.message : String(error)}</Callout>
}

/** Legend chip: a line/area swatch + text label (identity is never colour alone). */
export function LegendItem({ color, label, kind = 'line' }: { color: string; label: string; kind?: 'line' | 'band' | 'dash' | 'dot' }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs text-ink-2">
      {kind === 'line' && <span className="h-[3px] w-5 rounded-full" style={{ background: color }} />}
      {kind === 'dash' && <span className="w-5 border-t-2 border-dashed" style={{ borderColor: color }} />}
      {kind === 'band' && <span className="h-3 w-5 rounded-sm" style={{ background: color }} />}
      {kind === 'dot' && <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />}
      {label}
    </span>
  )
}

export function Legend({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">{children}</div>
}

export function Segmented<T extends string | number>({ value, onChange, options }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: string }[]
}) {
  return (
    <div className="inline-flex rounded-xl bg-surface-2 p-1 text-[13px]" role="radiogroup">
      {options.map((o) => (
        <button
          key={String(o.value)} role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}
          className={`relative rounded-lg px-3 py-1.5 font-medium transition-colors ${value === o.value ? 'text-ink' : 'text-muted hover:text-ink-2'}`}
        >
          {value === o.value && (
            <motion.span layoutId={`seg-${options.map((x) => x.value).join()}`} className="absolute inset-0 rounded-lg bg-surface shadow" transition={{ type: 'spring', duration: 0.35 }} />
          )}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  )
}
