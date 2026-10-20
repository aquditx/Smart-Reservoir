import { useMemo, useState } from 'react'
import { Area, Brush, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ReferenceLine } from 'recharts'
import { TooltipBox, axisProps, compact, gridProps, makeTooltip } from '../components/ChartTooltip'
import { Callout, Card, ErrorNote, Legend, LegendItem, Loading, PageHeader, Segmented, Stat } from '../components/ui'
import { useForecast, useMetrics } from '../lib/api'
import { fmt, fmtDate } from '../lib/sim'

export default function Forecast() {
  const fc = useForecast()
  const m = useMetrics()
  const [scale, setScale] = useState<'linear' | 'log'>('log')
  const [year, setYear] = useState<string>('all')

  const data = useMemo(() => (fc.data ?? [])
    .filter((r) => year === 'all' || r.target_date.startsWith(year))
    .map((r) => ({
      date: r.target_date,
      predicted: Math.max(r.predicted_inflow_cusecs, 1),
      actual: r.actual_inflow_cusecs == null ? null : Math.max(r.actual_inflow_cusecs, 1),
      band: [Math.max(r.lower_bound_cusecs, 1), Math.max(r.upper_bound_cusecs, 1)] as [number, number],
      lower: r.lower_bound_cusecs, upper: r.upper_bound_cusecs,
    })), [fc.data, year])

  const scatter = useMemo(() => (fc.data ?? []).filter((r) => r.actual_inflow_cusecs != null)
    .map((r) => ({ date: r.target_date, actual: Math.max(r.actual_inflow_cusecs!, 1), predicted: Math.max(r.predicted_inflow_cusecs, 1) })), [fc.data])

  const rf = m.data?.metrics.random_forest
  const Tip = makeTooltip([
    { key: 'actual', name: 'Actual', color: 'var(--series-1)', unit: 'cusecs' },
    { key: 'predicted', name: 'Forecast', color: 'var(--series-2)', unit: 'cusecs' },
    { key: 'lower', name: 'P10', color: 'var(--series-2)', unit: 'cusecs' },
    { key: 'upper', name: 'P90', color: 'var(--series-2)', unit: 'cusecs' },
  ])
  const years = ['all', '2015', '2016', '2017', '2018', '2019']

  return (
    <>
      <PageHeader eyebrow="Module 1 · Person B" title="3-day-ahead inflow forecast">
        A Random Forest trained on 1994–2014 rainfall and storage history, tested on 1,867 unseen days (2014–2019). Quantile models give a
        10th–90th percentile range so the uncertainty is shown, not hidden.
      </PageHeader>

      {m.error && <ErrorNote error={m.error} />}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Stat label="R²" value={rf?.r2} digits={3} hint="share of variance explained" />
        <Stat label="RMSE" value={rf?.rmse} unit="cusecs" hint="dominated by flood peaks" />
        <Stat label="MAE" value={rf?.mae} unit="cusecs" hint="typical daily error" />
        <Stat label="log-RMSE" value={rf?.log_rmse} digits={3} hint="error on log scale" />
        <Stat label="80% band coverage" value={m.data?.coverage_80_band_pct} digits={1} unit="%" hint="target 80%: band is too narrow" tone="var(--warning)" />
      </div>

      <Card className="mt-6" title="Forecast vs actual inflow" subtitle="Test period; drag the handles below the chart to zoom"
        right={<div className="flex flex-wrap gap-2">
          <Segmented value={year} onChange={setYear} options={years.map((y) => ({ value: y, label: y === 'all' ? 'All' : y }))} />
          <Segmented value={scale} onChange={setScale} options={[{ value: 'log', label: 'Log' }, { value: 'linear', label: 'Linear' }]} />
        </div>}>
        {fc.isLoading ? <Loading h={380} /> : (
          <ResponsiveContainer width="100%" height={380}>
            <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="date" {...axisProps} minTickGap={60} tickFormatter={(v) => fmtDate(v, { month: 'short', year: '2-digit' })} />
              <YAxis {...axisProps} width={48} scale={scale} domain={scale === 'log' ? [100, 'auto'] : [0, 'auto']} allowDataOverflow tickFormatter={compact} />
              <Area dataKey="band" stroke="none" fill="var(--band)" isAnimationActive={false} />
              <Line dataKey="actual" stroke="var(--series-1)" strokeWidth={1.5} dot={false} isAnimationActive={false} />
              <Line dataKey="predicted" stroke="var(--series-2)" strokeWidth={1.5} dot={false} isAnimationActive={false} />
              <Tooltip content={<Tip />} cursor={{ stroke: 'var(--axis)' }} />
              <Brush dataKey="date" height={26} stroke="var(--axis)" fill="var(--surface-2)" travellerWidth={10} tickFormatter={(v) => fmtDate(v, { month: 'short', year: '2-digit' })} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
        <div className="mt-2"><Legend>
          <LegendItem color="var(--series-1)" label="Actual inflow" />
          <LegendItem color="var(--series-2)" label="Forecast (Random Forest)" />
          <LegendItem color="var(--band)" kind="band" label="80% range (P10–P90)" />
        </Legend></div>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Predicted vs actual" subtitle="Each dot is one test day; dots on the diagonal are perfect forecasts (log–log)">
          {fc.isLoading ? <Loading h={320} /> : (
            <ResponsiveContainer width="100%" height={320}>
              <ScatterChart margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid {...gridProps} vertical />
                <XAxis type="number" dataKey="actual" scale="log" domain={[100, 250000]} allowDataOverflow {...axisProps} tickFormatter={compact} name="Actual"
                  label={{ value: 'Actual (cusecs)', position: 'insideBottom', offset: -4, fill: 'var(--muted)', fontSize: 12 }} />
                <YAxis type="number" dataKey="predicted" scale="log" domain={[100, 250000]} allowDataOverflow {...axisProps} width={48} tickFormatter={compact} name="Forecast" />
                <ReferenceLine segment={[{ x: 100, y: 100 }, { x: 250000, y: 250000 }]} stroke="var(--muted)" strokeDasharray="4 4" />
                <Scatter data={scatter} fill="var(--series-1)" fillOpacity={0.45} shape="circle" isAnimationActive={false} />
                <Tooltip content={({ active, payload }) => active && payload?.length ? (
                  <TooltipBox title={fmtDate(payload[0].payload.date)} rows={[
                    { name: 'Actual', value: payload[0].payload.actual, color: 'var(--series-1)', unit: 'cusecs' },
                    { name: 'Forecast', value: payload[0].payload.predicted, color: 'var(--series-2)', unit: 'cusecs' },
                  ]} />) : null} />
              </ScatterChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card title="Model comparison & drivers">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-line text-left text-xs text-muted">
                <th className="py-2 font-medium">Model</th><th className="py-2 text-right font-medium">RMSE</th><th className="py-2 text-right font-medium">MAE</th>
                <th className="py-2 text-right font-medium">R²</th><th className="py-2 text-right font-medium">log-RMSE</th></tr></thead>
              <tbody className="tabular">
                {m.data && Object.entries(m.data.comparison).map(([k, v]) => (
                  <tr key={k} className="border-b border-line/60">
                    <td className="py-2.5 font-medium">{k === 'random_forest' ? 'Random Forest ★ used' : 'XGBoost'}</td>
                    <td className="py-2.5 text-right">{fmt(v.rmse)}</td><td className="py-2.5 text-right">{fmt(v.mae)}</td>
                    <td className="py-2.5 text-right">{fmt(v.r2, 3)}</td><td className="py-2.5 text-right">{fmt(v.log_rmse, 3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted">Random Forest is kept for its lower log-RMSE on the skewed, mostly low-flow data. XGBoost figures are from Person B's comparison run.</p>
          <h4 className="mt-5 text-sm font-semibold">Most important inputs</h4>
          <img src="/plots/krs/feature_importance.png" alt="Feature importance bar chart from the Random Forest" className="mt-2 w-full rounded-xl bg-white p-2" />
        </Card>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Callout tone="warning" title="Band is narrower than it should be">The 80% range contains the actual value about 67% of the time. Recalibrating the quantiles or using conformal prediction is the next step.</Callout>
        <Callout title="Why R² is moderate">Inflow is dominated by rare monsoon flood days. Accuracy on normal days is much better than RMSE suggests.</Callout>
        <Callout title="Back-testing, not live">Rainfall data ends in Nov 2019, so all forecasts are historical back-tests on unseen years.</Callout>
      </div>
    </>
  )
}
