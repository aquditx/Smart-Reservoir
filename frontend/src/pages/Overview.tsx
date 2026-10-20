import { ArrowDownToLine, ArrowRight, ArrowUpFromLine, Database, Droplets, Gauge, Sparkles, TrendingDown, TrendingUp } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Area, AreaChart, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { axisProps, compact, gridProps, makeTooltip } from '../components/ChartTooltip'
import { useDecisionDate } from '../components/Layout'
import { ReservoirGauge } from '../components/ReservoirGauge'
import { Card, ErrorNote, Legend, LegendItem, Loading, PageHeader, Stat, ZONE, ZoneBadge } from '../components/ui'
import { useDay, useHistory, useRecommendation } from '../lib/api'
import { FRL_TMC, MDDL_TMC, fmt, fmtDate } from '../lib/sim'
import { DateControls } from './Simulate'

const shift = (d: string, days: number) => {
  const t = new Date(d + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + days); return t.toISOString().slice(0, 10)
}

export default function Overview() {
  const { date } = useDecisionDate()
  const day = useDay(date)
  const year = useHistory(shift(date, -365), date)
  const rec = useRecommendation(date, 3)
  const d = day.data
  const r = rec.data?.scenarios[1]

  const yearData = (year.data ?? []).map((x) => ({ ...x }))
  const recent = yearData.slice(-60)
  const flowTip = makeTooltip([
    { key: 'inflow_cusecs', name: 'Inflow', color: 'var(--series-1)', unit: 'cusecs' },
    { key: 'outflow_cusecs', name: 'Release to river', color: 'var(--series-3)', unit: 'cusecs' },
  ])
  const storeTip = makeTooltip([{ key: 'gross_tmc', name: 'Gross storage', color: 'var(--series-1)', unit: 'TMC', digits: 2 }])

  return (
    <>
      <PageHeader eyebrow="Control room" title="K.R. Sagara Dam at a glance" right={<DateControls />}>
        Replay any day of the 2014–2019 test period as if you were the operator. Live bulletin feeds aren't available, so the dashboard runs on
        historical data; everything below is what was known on <b className="text-ink">{fmtDate(date)}</b>.
      </PageHeader>

      {day.error && <ErrorNote error={day.error} />}

      <div className="grid gap-6 xl:grid-cols-[340px_1fr]">
        <Card title="Reservoir status" right={d?.zone && <ZoneBadge zone={d.zone} size="md" />}>
          {d ? <ReservoirGauge storage={d.gross_tmc ?? 0} /> : <Loading h={260} />}
          {d?.zone && <p className="mt-2 text-center text-sm text-ink-2">{ZONE[d.zone].text}</p>}
          <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4 text-sm">
            <div><dt className="text-xs text-muted">Gauge level</dt><dd className="tabular font-semibold">{fmt(d?.gauge_ft, 2)} ft</dd></div>
            <div><dt className="text-xs text-muted">Live storage</dt><dd className="tabular font-semibold">{fmt(d?.live_tmc, 2)} TMC</dd></div>
            <div><dt className="text-xs text-muted">FRL</dt><dd className="tabular font-semibold">124.80 ft · {FRL_TMC} TMC</dd></div>
            <div><dt className="text-xs text-muted">MDDL</dt><dd className="tabular font-semibold">74.00 ft · {MDDL_TMC} TMC</dd></div>
          </dl>
        </Card>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="Gross storage" value={d?.gross_tmc} digits={2} unit="TMC" icon={<Database size={15} />}
              hint={d && <span className="flex items-center gap-1">{d.storage_change_7d_tmc >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}{d.storage_change_7d_tmc >= 0 ? '+' : ''}{fmt(d.storage_change_7d_tmc, 2)} TMC in 7 days</span>} />
            <Stat label="% of FRL capacity" value={d?.pct_full_calc} digits={1} unit="%" icon={<Gauge size={15} />} hint={`of ${FRL_TMC} TMC gross`} />
            <Stat label="Inflow" value={d?.inflow_cusecs} unit="cusecs" icon={<ArrowDownToLine size={15} />} hint={d && `${fmt((d.inflow_cusecs ?? 0) / 11574.07, 2)} TMC/day`} />
            <Stat label="Release to river" value={d?.outflow_cusecs} unit="cusecs" icon={<ArrowUpFromLine size={15} />} hint={d && `+ canal ${fmt(d.withdrawal_cusecs)} cusecs`} />
          </div>

          <Card title="Storage over the past year" subtitle="Gross storage (TMC) with Full Reservoir Level">
            {year.isLoading ? <Loading h={220} /> : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={yearData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="storeFill" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0" stopColor="var(--series-1)" stopOpacity={0.35} />
                      <stop offset="1" stopColor="var(--series-1)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="date" {...axisProps} minTickGap={50} tickFormatter={(v) => fmtDate(v, { month: 'short', year: '2-digit' })} />
                  <YAxis domain={[0, 55]} {...axisProps} width={36} />
                  <ReferenceLine y={FRL_TMC} stroke="var(--critical)" label={{ value: 'FRL', position: 'insideTopLeft', fill: 'var(--critical)', fontSize: 11 }} />
                  <ReferenceLine y={MDDL_TMC} stroke="var(--warning)" label={{ value: 'MDDL', position: 'insideBottomLeft', fill: 'var(--warning)', fontSize: 11 }} />
                  <Area dataKey="gross_tmc" stroke="var(--series-1)" strokeWidth={2} fill="url(#storeFill)" />
                  <Tooltip content={storeTip} cursor={{ stroke: 'var(--axis)' }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </Card>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_420px]">
        <Card title="Inflow and release, last 60 days" subtitle="Daily flows in cusecs">
          {year.isLoading ? <Loading h={240} /> : (
            <>
              <ResponsiveContainer width="100%" height={240}>
                <ComposedChart data={recent} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="date" {...axisProps} minTickGap={40} tickFormatter={(v) => fmtDate(v, { day: 'numeric', month: 'short' })} />
                  <YAxis {...axisProps} width={44} tickFormatter={compact} />
                  <Area dataKey="inflow_cusecs" stroke="var(--series-1)" strokeWidth={2} fill="var(--series-1)" fillOpacity={0.12} />
                  <Line dataKey="outflow_cusecs" stroke="var(--series-3)" strokeWidth={2} dot={false} />
                  <Tooltip content={flowTip} cursor={{ stroke: 'var(--axis)' }} />
                </ComposedChart>
              </ResponsiveContainer>
              <div className="mt-2"><Legend><LegendItem color="var(--series-1)" label="Inflow" /><LegendItem color="var(--series-3)" label="Release to river" /></Legend></div>
            </>
          )}
        </Card>

        <Card className="relative overflow-hidden" title={<span className="flex items-center gap-2"><Sparkles size={16} style={{ color: 'var(--series-2)' }} /> Next 3 days: recommended release</span>}
          subtitle="Robust to high-end (P90) inflow forecast">
          {rec.isLoading && <Loading h={200} />}
          {rec.error && <ErrorNote error={rec.error} />}
          {r && rec.data && (
            <>
              <div className="flex items-baseline gap-2">
                <span className="text-[48px] font-extrabold leading-none tracking-tight">{fmt(r.release_cusecs)}</span>
                <span className="text-muted">cusecs</span>
              </div>
              <div className="mt-3 flex items-center gap-2"><ZoneBadge zone={r.status} /><span className="text-sm text-ink-2">final storage {fmt(r.final_storage_tmc, 2)} TMC</span></div>
              <p className="mt-3 text-sm leading-relaxed text-ink-2">{r.explanation}</p>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                {rec.data.scenarios.map((s) => (
                  <div key={s.key} className="rounded-xl bg-surface-2/70 p-2">
                    <div className="text-[11px] text-muted">{s.label}</div>
                    <div className="tabular text-sm font-semibold">{compact(s.release_cusecs)}</div>
                  </div>
                ))}
              </div>
              <Link to="/simulate" className="mt-5 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
                style={{ background: 'linear-gradient(135deg, var(--series-1), var(--series-3))' }}>
                <Droplets size={16} /> Open the simulator <ArrowRight size={16} />
              </Link>
            </>
          )}
        </Card>
      </div>
    </>
  )
}
