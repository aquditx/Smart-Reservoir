import { useQuery } from '@tanstack/react-query'

async function get<T>(url: string): Promise<T> {
  const r = await fetch(url)
  if (!r.ok) {
    const body = await r.json().catch(() => ({}))
    throw new Error(body.detail ?? `${r.status} ${r.statusText}`)
  }
  return r.json()
}

export type Zone = 'normal' | 'caution' | 'low' | 'flood_risk' | 'below_mddl'
export type Series = 'predicted' | 'lower' | 'upper' | 'actual'

export interface Reservoir {
  id: string; name: string; river: string; state: string; role: string
  decision_range?: [string, string]; history_range?: [string, string]
}

export interface Thresholds {
  frl: { gauge_ft: number; datum_ft: number; gross_tmc: number }
  mddl: { gauge_ft: number; datum_ft: number; gross_tmc: number }
  dead_storage_tmc: number; caution_tmc: number; low_tmc: number
  cusecs_per_tmc_day: number; max_release_cusecs: number
  level_curve: { gauge_ft: number; gross_tmc: number }[]
  source: string
}

export interface HistoryRow {
  date: string; gross_tmc: number | null; live_tmc: number | null; gauge_ft: number | null
  pct_full_calc: number | null; inflow_cusecs: number | null; outflow_cusecs: number | null
  withdrawal_cusecs: number | null; evaporation_cusecs: number | null
}

export interface DayInfo extends Omit<HistoryRow, 'date'> {
  date: string; zone: Zone | null; storage_change_7d_tmc: number
}

export interface ForecastRow {
  target_date: string; origin_date: string; predicted_inflow_cusecs: number
  lower_bound_cusecs: number; upper_bound_cusecs: number; actual_inflow_cusecs: number | null
}

export interface Metrics {
  reservoir: string; forecast_horizon_days: number; data_window: string
  train_rows: number; test_rows: number; best_model: string
  metrics: Record<string, { rmse: number; mae: number; r2: number; log_rmse: number }>
  coverage_80_band_pct: number
  comparison: Record<string, { rmse: number; mae: number; r2: number; log_rmse: number }>
  top_features: string[]; notes: string[]
}

export interface Scenario {
  key: 'conservative' | 'recommended' | 'aggressive'; label: string; purpose: string
  release_cusecs: number; release_tmc_total: number
  trajectory: number[]; trajectory_lower: number[]; trajectory_upper: number[]
  min_storage_tmc: number; max_storage_tmc: number; final_storage_tmc: number; max_storage_upper_tmc: number
  status: Zone; status_if_upper_inflow: Zone; explanation: string
}

export interface Recommendation {
  decision_date: string; dates: string[]; initial_storage_tmc: number; initial_zone: Zone
  inflow_cusecs: Record<Series, number[]>
  withdrawal_cusecs: number[]; evaporation_cusecs: number[]
  actual_release_cusecs: (number | null)[]; actual_storage_tmc: (number | null)[]
  no_release_trajectory: number[]; max_safe_release_cusecs: number; flood_pressure: boolean
  logic_steps: { date: string; day: number; storage_if_no_release_tmc: number; excess_over_ceiling_tmc: number; required_release_cusecs: number }[]
  scenarios: Scenario[]
}

export interface CaseStudy {
  title: string; note: string; peak_inflow: number; peak_actual_release: number; peak_recommended: number
  series: { date: string; recommended: number; actual_release: number; inflow: number; storage: number }[]
}

export interface Benchmark {
  days: number; period: [string, string]
  replay_days_over_frl: number; actual_days_over_frl: number; pct_days_safe: number
  total_recommended_tmc: number; total_actual_tmc: number; correlation: number
  monthly: { date: string; recommended_cusecs: number; actual_release_cusecs: number; actual_inflow_cusecs: number; storage_tmc: number }[]
  case_studies: CaseStudy[]
}

export interface SriRow { date: string; predicted_inflow_mcm: number; actual_inflow_mcm: number }
export interface SriMetrics {
  reservoir: string; horizon_days: number; unit: string; window: string
  train_rows: number; test_rows: number; rmse: number; mae: number; r2: number; r2_without_rainfall: number; notes: string[]
}

const forever = { staleTime: Infinity }

export const useReservoirs = () => useQuery({ queryKey: ['reservoirs'], queryFn: () => get<Reservoir[]>('/api/reservoirs'), ...forever })
export const useThresholds = () => useQuery({ queryKey: ['thresholds'], queryFn: () => get<Thresholds>('/api/krs/thresholds'), ...forever })
export const useHistory = (from?: string, to?: string, step = 1) =>
  useQuery({
    queryKey: ['history', from, to, step],
    queryFn: () => get<HistoryRow[]>(`/api/krs/history?${new URLSearchParams({ ...(from && { from }), ...(to && { to }), step: String(step) })}`),
    ...forever,
  })
export const useDay = (date: string) => useQuery({ queryKey: ['day', date], queryFn: () => get<DayInfo>(`/api/krs/day/${date}`), ...forever })
export const useForecast = () => useQuery({ queryKey: ['forecast'], queryFn: () => get<ForecastRow[]>('/api/krs/forecast'), ...forever })
export const useMetrics = () => useQuery({ queryKey: ['metrics'], queryFn: () => get<Metrics>('/api/krs/metrics'), ...forever })
export const useRecommendation = (date: string, horizon: number) =>
  useQuery({
    queryKey: ['recommend', date, horizon],
    queryFn: () => get<Recommendation>(`/api/krs/recommend?date=${date}&horizon=${horizon}`),
    ...forever, retry: false, placeholderData: (prev) => prev,
  })
export const useBenchmark = () => useQuery({ queryKey: ['benchmark'], queryFn: () => get<Benchmark>('/api/krs/benchmark'), ...forever })
export const useSrisailam = () => useQuery({ queryKey: ['sri'], queryFn: () => get<SriRow[]>('/api/srisailam/forecast'), ...forever })
export const useSriMetrics = () => useQuery({ queryKey: ['sri-m'], queryFn: () => get<SriMetrics>('/api/srisailam/metrics'), ...forever })
