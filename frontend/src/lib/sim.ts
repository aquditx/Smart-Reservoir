import type { Recommendation, Series, Zone } from './api'

/** 1 TMC = 1e9 ft^3; one cusec flowing for a day = 86,400 ft^3. */
export const CUSECS_PER_TMC_DAY = 1e9 / 86400

export const FRL_TMC = 49.452
export const MDDL_TMC = 8.39
export const CAUTION_TMC = 0.95 * FRL_TMC
export const LOW_TMC = MDDL_TMC + 5

/** Client-side mirror of the backend water balance, so the slider updates instantly. */
export function simulate(rec: Recommendation, releaseCusecs: number, series: Series = 'predicted'): number[] {
  let s = rec.initial_storage_tmc
  const out = [s]
  rec.inflow_cusecs[series].forEach((inflow, i) => {
    s += (inflow - releaseCusecs - rec.withdrawal_cusecs[i] - rec.evaporation_cusecs[i]) / CUSECS_PER_TMC_DAY
    out.push(s)
  })
  return out
}

export function classify(s: number): Zone {
  if (s > FRL_TMC) return 'flood_risk'
  if (s > CAUTION_TMC) return 'caution'
  if (s < MDDL_TMC) return 'below_mddl'
  if (s < LOW_TMC) return 'low'
  return 'normal'
}

const SEVERITY: Record<Zone, number> = { normal: 0, caution: 1, low: 1, flood_risk: 3, below_mddl: 3 }
export const worstZone = (traj: number[]) =>
  traj.slice(1).map(classify).reduce<Zone>((a, z) => (SEVERITY[z] > SEVERITY[a] ? z : a), 'normal')

export const fmt = (n: number | null | undefined, digits = 0) =>
  n == null || Number.isNaN(n) ? '–' : n.toLocaleString('en-IN', { maximumFractionDigits: digits, minimumFractionDigits: digits })

export const fmtDate = (d: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) =>
  new Date(d + 'T00:00:00').toLocaleDateString('en-GB', opts)

export const shortDate = (d: string) => fmtDate(d, { day: 'numeric', month: 'short' })
