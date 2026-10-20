import { Brush, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { axisProps, gridProps, makeTooltip } from '../components/ChartTooltip'
import { Callout, Card, ErrorNote, Legend, LegendItem, Loading, PageHeader, Stat } from '../components/ui'
import { useSriMetrics, useSrisailam } from '../lib/api'
import { fmtDate } from '../lib/sim'

export default function Srisailam() {
  const f = useSrisailam()
  const m = useSriMetrics()
  const Tip = makeTooltip([
    { key: 'actual_inflow_mcm', name: 'Actual net storage change', color: 'var(--series-1)', unit: 'mcm/day', digits: 1 },
    { key: 'predicted_inflow_mcm', name: 'Forecast', color: 'var(--series-2)', unit: 'mcm/day', digits: 1 },
  ])
  return (
    <>
      <PageHeader eyebrow="Second case · limited" title="Srisailam (Krishna basin)">
        A contrast case using India-WRIS telemetry. With no inflow or release records, the forecast target is the daily <b className="text-ink">net storage change</b>,
        not true inflow, so this reservoir is shown for forecasting only.
      </PageHeader>

      <Callout tone="warning" title="Why there's no simulation or recommendation here">
        The water balance needs inflow, release and losses separately. Srisailam's data has only storage, so the net storage rise (with falls set to 0)
        stands in as a proxy target. Storage above 7,000 mcm was removed as bad entries.
      </Callout>

      {m.error && <ErrorNote error={m.error} />}
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="R²" value={m.data?.r2} digits={3} hint="with rainfall features" />
        <Stat label="R² without rainfall" value={m.data?.r2_without_rainfall} digits={3} hint="rainfall added no skill" />
        <Stat label="RMSE" value={m.data?.rmse} digits={1} unit="mcm/day" />
        <Stat label="Test days" value={m.data?.test_rows} hint={m.data?.window} />
      </div>

      <Card className="mt-6" title="Net storage change: forecast vs actual" subtitle="3-day-ahead, test period Feb 2024 – Mar 2025 (mcm per day)">
        {f.isLoading ? <Loading h={340} /> : (
          <ResponsiveContainer width="100%" height={340}>
            <ComposedChart data={f.data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="date" {...axisProps} minTickGap={50} tickFormatter={(v) => fmtDate(v, { month: 'short', year: '2-digit' })} />
              <YAxis {...axisProps} width={44} />
              <Line dataKey="actual_inflow_mcm" stroke="var(--series-1)" strokeWidth={1.75} dot={false} isAnimationActive={false} />
              <Line dataKey="predicted_inflow_mcm" stroke="var(--series-2)" strokeWidth={1.75} dot={false} isAnimationActive={false} />
              <Tooltip content={<Tip />} cursor={{ stroke: 'var(--axis)' }} />
              <Brush dataKey="date" height={26} stroke="var(--axis)" fill="var(--surface-2)" tickFormatter={(v) => fmtDate(v, { month: 'short', year: '2-digit' })} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
        <div className="mt-2"><Legend>
          <LegendItem color="var(--series-1)" label="Actual net storage change" />
          <LegendItem color="var(--series-2)" label="Forecast (Random Forest)" />
        </Legend></div>
      </Card>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Callout title="What this case shows">The same pipeline transfers to another basin, but its value depends on the data: without release records, a reservoir can be forecast but not operated.</Callout>
        <Callout title="Units differ from KRS">Srisailam is in million cubic metres per day; KRS is in cusecs. Only R² is comparable between the two.</Callout>
      </div>
    </>
  )
}
