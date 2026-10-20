import { useState } from 'react'
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { axisProps, compact, gridProps, makeTooltip } from '../components/ChartTooltip'
import { Callout, Card, ErrorNote, Legend, LegendItem, PageHeader, Segmented, Stat } from '../components/ui'
import { useBenchmark } from '../lib/api'
import { fmt, fmtDate } from '../lib/sim'

export default function Benchmark() {
  const { data: b, isLoading, error } = useBenchmark()
  const [caseIdx, setCaseIdx] = useState(0)
  const cs = b?.case_studies[caseIdx]

  const monthlyTip = makeTooltip([
    { key: 'actual_inflow_cusecs', name: 'Inflow', color: 'var(--series-1)', unit: 'cusecs' },
    { key: 'actual_release_cusecs', name: 'Operators released', color: 'var(--series-3)', unit: 'cusecs' },
    { key: 'recommended_cusecs', name: 'DSS recommended', color: 'var(--series-2)', unit: 'cusecs' },
  ])
  const caseTip = makeTooltip([
    { key: 'inflow', name: 'Inflow (actual)', color: 'var(--series-1)', unit: 'cusecs' },
    { key: 'actual_release', name: 'Operators released', color: 'var(--series-3)', unit: 'cusecs' },
    { key: 'recommended', name: 'DSS recommended', color: 'var(--series-2)', unit: 'cusecs' },
    { key: 'storage', name: 'Storage', color: 'var(--ink-2)', unit: 'TMC', digits: 2 },
  ])

  return (
    <>
      <PageHeader eyebrow="Real-world comparison" title="How would the DSS have done?">
        For every day from 2014 to 2019, we computed the Recommended release from that day's forecast, then replayed the next 3 days with the
        inflow that actually arrived. We compare that with what KRS operators actually released.
      </PageHeader>
      {error && <ErrorNote error={error} />}
      {isLoading && <Callout title="Running the back-test…">Computing about 1,865 daily recommendations. This takes a few seconds on first load.</Callout>}

      {b && (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="Days back-tested" value={b.days} hint={`${fmtDate(b.period[0])} – ${fmtDate(b.period[1])}`} />
            <Stat label="Days kept below FRL" value={b.pct_days_safe} digits={1} unit="%" tone="var(--good)" hint={`${b.replay_days_over_frl} windows breached with actual inflow`} />
            <Stat label="Total volume released" value={b.total_recommended_tmc} digits={0} unit="TMC" hint={`Operators: ${fmt(b.total_actual_tmc, 0)} TMC`} />
            <Stat label="Agreement with operators" value={b.correlation} digits={2} hint="correlation of daily releases" />
          </div>

          <Card className="mt-6" title="Monthly average release: DSS vs operators" subtitle="Cusecs, monthly mean of daily values">
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={b.monthly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="date" {...axisProps} minTickGap={40} tickFormatter={(v) => fmtDate(v + '-01', { month: 'short', year: '2-digit' })} />
                <YAxis {...axisProps} width={44} tickFormatter={compact} />
                <Area dataKey="actual_inflow_cusecs" stroke="none" fill="var(--series-1)" fillOpacity={0.14} />
                <Line dataKey="actual_release_cusecs" stroke="var(--series-3)" strokeWidth={2} dot={false} />
                <Line dataKey="recommended_cusecs" stroke="var(--series-2)" strokeWidth={2} dot={false} />
                <Tooltip content={monthlyTip} cursor={{ stroke: 'var(--axis)' }} />
              </ComposedChart>
            </ResponsiveContainer>
            <div className="mt-2"><Legend>
              <LegendItem color="color-mix(in srgb, var(--series-1) 35%, transparent)" kind="band" label="Inflow" />
              <LegendItem color="var(--series-3)" label="Operators released" />
              <LegendItem color="var(--series-2)" label="DSS recommended" />
            </Legend></div>
          </Card>

          {cs && (
            <Card className="mt-6" title={`Case study: ${cs.title}`} subtitle={cs.note}
              right={<Segmented value={caseIdx} onChange={setCaseIdx} options={b.case_studies.map((c, i) => ({ value: i, label: c.title.slice(0, 4) }))} />}>
              <div className="mb-4 grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-surface-2/60 p-3"><div className="text-xs text-muted">Peak inflow</div><div className="tabular text-lg font-bold">{fmt(cs.peak_inflow)}</div></div>
                <div className="rounded-xl bg-surface-2/60 p-3"><div className="text-xs text-muted">Peak operator release</div><div className="tabular text-lg font-bold">{fmt(cs.peak_actual_release)}</div></div>
                <div className="rounded-xl bg-surface-2/60 p-3"><div className="text-xs text-muted">Peak DSS recommendation</div><div className="tabular text-lg font-bold">{fmt(cs.peak_recommended)}</div></div>
              </div>
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={cs.series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="date" {...axisProps} minTickGap={40} tickFormatter={(v) => fmtDate(v, { day: 'numeric', month: 'short' })} />
                  <YAxis {...axisProps} width={44} tickFormatter={compact} />
                  <Area dataKey="inflow" stroke="var(--series-1)" strokeWidth={1.5} fill="var(--series-1)" fillOpacity={0.12} />
                  <Line dataKey="actual_release" stroke="var(--series-3)" strokeWidth={2} dot={false} />
                  <Line dataKey="recommended" stroke="var(--series-2)" strokeWidth={2} dot={false} />
                  <Tooltip content={caseTip} cursor={{ stroke: 'var(--axis)' }} />
                </ComposedChart>
              </ResponsiveContainer>
              <div className="mt-2"><Legend>
                <LegendItem color="var(--series-1)" label="Inflow (actual)" />
                <LegendItem color="var(--series-3)" label="Operators released" />
                <LegendItem color="var(--series-2)" label="DSS recommended" />
              </Legend></div>
            </Card>
          )}

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <Callout title="Reading the result">
              The DSS releases a similar total volume to the operators, but times it from the forecast. All {b.replay_days_over_frl} breach windows fall in the
              July–Sept 2018 and Aug–Sept 2019 floods, when actual inflow exceeded even the P90 forecast (e.g. 2.04 lakh cusecs on 9 Aug 2019 vs a
              P90 of 42k). Better flood-peak forecasting is the main lever for improvement.
            </Callout>
            <Callout tone="warning" title="Limits of this comparison">
              Operators also follow downstream obligations (e.g. Cauvery tribunal releases to Tamil Nadu) and gate constraints that the DSS
              doesn't model. Matching their releases is not the goal; staying safe while explaining the decision is.
            </Callout>
          </div>
        </>
      )}
    </>
  )
}
