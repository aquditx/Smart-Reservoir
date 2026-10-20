import { useMemo, useState } from 'react'
import { Area, Bar, BarChart, Brush, CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { axisProps, compact, gridProps, makeTooltip } from '../components/ChartTooltip'
import { Card, ErrorNote, Legend, LegendItem, Loading, PageHeader, Segmented } from '../components/ui'
import { useHistory } from '../lib/api'
import { FRL_TMC, MDDL_TMC, fmtDate } from '../lib/sim'

const YEARS = Array.from({ length: 2026 - 1990 + 1 }, (_, i) => String(1990 + i))

export default function History() {
  const [year, setYear] = useState('all')
  const all = year === 'all'
  const h = useHistory(all ? undefined : `${year}-01-01`, all ? undefined : `${year}-12-31`, all ? 5 : 1)
  const full = useHistory(undefined, undefined, 1)
  const [metric, setMetric] = useState<'gross_tmc' | 'pct_full_calc'>('gross_tmc')

  const data = h.data ?? []
  const monsoons = useMemo(() => {
    if (all) return []
    return [{ x1: `${year}-06-01`, x2: `${year}-09-30` }]
  }, [all, year])

  const annual = useMemo(() => {
    const by: Record<string, { year: string; inflow: number; release: number; canal: number; n: number }> = {}
    for (const r of full.data ?? []) {
      const y = r.date.slice(0, 4)
      if (y === '2026') continue
      by[y] ??= { year: y, inflow: 0, release: 0, canal: 0, n: 0 }
      by[y].inflow += (r.inflow_cusecs ?? 0) / 11574.07
      by[y].release += (r.outflow_cusecs ?? 0) / 11574.07
      by[y].canal += (r.withdrawal_cusecs ?? 0) / 11574.07
    }
    return Object.values(by).map((v) => ({ year: v.year, inflow: +v.inflow.toFixed(1), release: +v.release.toFixed(1), canal: +v.canal.toFixed(1) }))
  }, [full.data])

  const storeTip = makeTooltip([
    { key: 'gross_tmc', name: 'Gross storage', color: 'var(--series-1)', unit: 'TMC', digits: 2 },
    { key: 'pct_full_calc', name: '% of FRL', color: 'var(--series-1)', unit: '%', digits: 1 },
    { key: 'gauge_ft', name: 'Gauge level', color: 'var(--series-1)', unit: 'ft', digits: 2 },
  ])
  const flowTip = makeTooltip([
    { key: 'inflow_cusecs', name: 'Inflow', color: 'var(--series-1)', unit: 'cusecs' },
    { key: 'outflow_cusecs', name: 'Release to river', color: 'var(--series-3)', unit: 'cusecs' },
    { key: 'withdrawal_cusecs', name: 'Canal withdrawal', color: 'var(--series-2)', unit: 'cusecs' },
  ])
  const annualTip = makeTooltip([
    { key: 'inflow', name: 'Total inflow', color: 'var(--series-1)', unit: 'TMC', digits: 1 },
    { key: 'release', name: 'River release', color: 'var(--series-3)', unit: 'TMC', digits: 1 },
    { key: 'canal', name: 'Canal withdrawal', color: 'var(--series-2)', unit: 'TMC', digits: 1 },
  ], 'year')
  const tick = (v: string) => all ? v.slice(0, 4) : fmtDate(v, { day: 'numeric', month: 'short' })

  return (
    <>
      <PageHeader eyebrow="Historical record · Person A" title="36 years of KRS operation"
        right={<select aria-label="Year" value={year} onChange={(e) => setYear(e.target.value)}>
          <option value="all">All years (1990–2026)</option>
          {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>}>
        Karnataka reservoir bulletin, 13,400 daily records. Pick a year to see the dry-season drawdown and the monsoon refill (June–September shaded).
      </PageHeader>
      {h.error && <ErrorNote error={h.error} />}

      <Card title="Reservoir storage" subtitle={all ? 'Every 5th day shown; pick a year for daily detail' : `Daily, ${year}`}
        right={<Segmented value={metric} onChange={setMetric} options={[{ value: 'gross_tmc', label: 'TMC' }, { value: 'pct_full_calc', label: '% of FRL' }]} />}>
        {h.isLoading ? <Loading h={320} /> : (
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="histFill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0" stopColor="var(--series-1)" stopOpacity={0.35} />
                  <stop offset="1" stopColor="var(--series-1)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid {...gridProps} />
              {monsoons.map((m) => <ReferenceArea key={m.x1} x1={m.x1} x2={m.x2} fill="var(--series-1)" fillOpacity={0.06} label={{ value: 'Monsoon', position: 'insideTop', fill: 'var(--muted)', fontSize: 11 }} />)}
              <XAxis dataKey="date" {...axisProps} minTickGap={40} tickFormatter={tick} />
              <YAxis {...axisProps} width={40} domain={metric === 'gross_tmc' ? [0, 55] : [0, 110]} />
              <ReferenceLine y={metric === 'gross_tmc' ? FRL_TMC : 100} stroke="var(--critical)" label={{ value: 'FRL', position: 'insideTopLeft', fill: 'var(--critical)', fontSize: 11 }} />
              <ReferenceLine y={metric === 'gross_tmc' ? MDDL_TMC : (100 * MDDL_TMC) / FRL_TMC} stroke="var(--warning)" label={{ value: 'MDDL', position: 'insideBottomLeft', fill: 'var(--warning)', fontSize: 11 }} />
              <Area dataKey={metric} stroke="var(--series-1)" strokeWidth={1.75} fill="url(#histFill)" isAnimationActive={false} />
              <Tooltip content={storeTip} cursor={{ stroke: 'var(--axis)' }} />
              {all && <Brush dataKey="date" height={26} stroke="var(--axis)" fill="var(--surface-2)" tickFormatter={(v) => v.slice(0, 4)} />}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </Card>

      <Card className="mt-6" title="Water balance flows" subtitle="Inflow vs what left the reservoir (cusecs)">
        {h.isLoading ? <Loading h={260} /> : (
          <>
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="date" {...axisProps} minTickGap={40} tickFormatter={tick} />
                <YAxis {...axisProps} width={44} tickFormatter={compact} />
                <Area dataKey="inflow_cusecs" stroke="var(--series-1)" strokeWidth={1.5} fill="var(--series-1)" fillOpacity={0.12} isAnimationActive={false} />
                <Line dataKey="outflow_cusecs" stroke="var(--series-3)" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                <Line dataKey="withdrawal_cusecs" stroke="var(--series-2)" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                <Tooltip content={flowTip} cursor={{ stroke: 'var(--axis)' }} />
              </ComposedChart>
            </ResponsiveContainer>
            <div className="mt-2"><Legend>
              <LegendItem color="var(--series-1)" label="Inflow" /><LegendItem color="var(--series-3)" label="Release to river" /><LegendItem color="var(--series-2)" label="Canal withdrawal" />
            </Legend></div>
          </>
        )}
      </Card>

      <Card className="mt-6" title="Annual water budget" subtitle="Total volume per year (TMC). Click-free: hover a year for numbers">
        {full.isLoading ? <Loading h={280} /> : (
          <>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={annual} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2} barCategoryGap="20%">
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="year" {...axisProps} minTickGap={10} tickFormatter={(v) => `'${v.slice(2)}`} />
                <YAxis {...axisProps} width={40} />
                <Bar dataKey="inflow" fill="var(--series-1)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="release" fill="var(--series-3)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="canal" fill="var(--series-2)" radius={[4, 4, 0, 0]} />
                <Tooltip content={annualTip} cursor={{ fill: 'var(--surface-2)', opacity: 0.5 }} />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-2"><Legend>
              <LegendItem color="var(--series-1)" kind="band" label="Total inflow" /><LegendItem color="var(--series-3)" kind="band" label="River release" /><LegendItem color="var(--series-2)" kind="band" label="Canal withdrawal" />
            </Legend></div>
          </>
        )}
      </Card>
    </>
  )
}
