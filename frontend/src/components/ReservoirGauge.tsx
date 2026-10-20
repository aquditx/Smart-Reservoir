import { motion } from 'framer-motion'
import { FRL_TMC, MDDL_TMC, fmt } from '../lib/sim'

/** Animated cross-section of the reservoir: water height ∝ gross storage, FRL/MDDL marked. */
export function ReservoirGauge({ storage, projected, height = 260 }: { storage: number; projected?: number; height?: number }) {
  const W = 300, H = height, top = 28, bottom = H - 26
  const cap = FRL_TMC * 1.06
  const y = (s: number) => bottom - (Math.max(0, Math.min(s, cap)) / cap) * (bottom - top)
  const waterY = y(storage)
  const pct = (100 * storage) / FRL_TMC
  // Dam valley polygon (trapezoid) used as clip path
  const valley = `M30 ${top} L270 ${top} L235 ${bottom} L65 ${bottom} Z`

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Reservoir at ${fmt(pct, 1)}% of FRL storage`}>
      <defs>
        <linearGradient id="water" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="var(--water-top)" stopOpacity="0.95" />
          <stop offset="1" stopColor="var(--water-bottom)" stopOpacity="0.95" />
        </linearGradient>
        <clipPath id="valley"><path d={valley} /></clipPath>
      </defs>

      <path d={valley} fill="var(--surface-2)" stroke="var(--axis)" strokeWidth="1.5" />

      <g clipPath="url(#valley)">
        <motion.g initial={false} animate={{ y: waterY }} transition={{ type: 'spring', stiffness: 60, damping: 16 }}>
          <rect x="0" y="0" width={W} height={H} fill="url(#water)" />
          <g style={{ animation: 'wave 6s linear infinite' }}>
            <path d={`M0 0 ${Array.from({ length: 12 }, (_, i) => `Q ${i * 50 + 25} ${i % 2 ? 6 : -6} ${i * 50 + 50} 0`).join(' ')} V 14 H 0 Z`}
              fill="var(--water-top)" opacity="0.55" />
          </g>
        </motion.g>
      </g>

      {/* Projected level ghost line */}
      {projected != null && (
        <motion.line initial={false} animate={{ y1: y(projected), y2: y(projected) }} x1="40" x2="260"
          stroke="var(--ink)" strokeWidth="2" strokeDasharray="5 4" opacity="0.7" />
      )}

      {/* Threshold markers */}
      {[{ s: FRL_TMC, label: 'FRL', c: 'var(--critical)' }, { s: MDDL_TMC, label: 'MDDL', c: 'var(--warning)' }].map((t) => (
        <g key={t.label}>
          <line x1="22" x2="278" y1={y(t.s)} y2={y(t.s)} stroke={t.c} strokeWidth="1.5" />
          <text x="278" y={y(t.s) - 5} textAnchor="end" fontSize="11" fontWeight="600" fill={t.c}>{t.label} · {fmt(t.s, 1)} TMC</text>
        </g>
      ))}

      <text x={W / 2} y={Math.min(waterY + 34, bottom - 8)} textAnchor="middle" fontSize="26" fontWeight="800" fill="#fff" style={{ paintOrder: 'stroke' }} stroke="rgba(0,0,0,0.25)" strokeWidth="3">
        {fmt(pct, 1)}%
      </text>
      <text x={W / 2} y={H - 6} textAnchor="middle" fontSize="11" fill="var(--muted)">gross storage as % of FRL capacity</text>
    </svg>
  )
}
