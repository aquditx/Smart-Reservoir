import { motion } from 'framer-motion'
import { ArrowDown, CalendarDays, Check, Droplet, ShieldCheck, Sparkles, Sprout, Waves } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
  Area, Bar, CartesianGrid, ComposedChart, ErrorBar, LabelList, Line, ReferenceArea, ReferenceLine, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis,
} from 'recharts'
import { TooltipBox, axisProps, compact, gridProps, makeTooltip } from '../components/ChartTooltip'
import { useDecisionDate } from '../components/Layout'
import { ReservoirGauge } from '../components/ReservoirGauge'
import { AnimatedNumber, Callout, Card, ErrorNote, Legend, LegendItem, Loading, PageHeader, Segmented, ZoneBadge } from '../components/ui'
import { useRecommendation, useReservoirs, type Recommendation, type Scenario, type Series } from '../lib/api'
import { CAUTION_TMC, FRL_TMC, MDDL_TMC, fmt, fmtDate, shortDate, simulate, worstZone } from '../lib/sim'

const SCEN_COLOR: Record<Scenario['key'], string> = {
  conservative: 'var(--series-1)', recommended: 'var(--series-2)', aggressive: 'var(--series-3)',
}
const SCEN_ICON = { conservative: Sprout, recommended: Sparkles, aggressive: ShieldCheck }

export function DateControls({ horizon, setHorizon }: { horizon?: number; setHorizon?: (h: number) => void }) {
  const { date, setDate } = useDecisionDate()
  const { data: res } = useReservoirs()
  const range = res?.[0].decision_range
  const presets = [
    { d: '2018-08-10', label: 'Aug 2018 flood' },
    { d: '2019-08-09', label: 'Aug 2019 flood' },
    { d: '2016-04-15', label: 'Dry summer 2016' },
    { d: '2017-10-10', label: 'Post-monsoon 2017' },
  ]
  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="flex items-center gap-2 text-sm text-ink-2">
        <CalendarDays size={16} className="text-accent" />
        Decision date
        <input type="date" value={date} min={range?.[0]} max={range?.[1]} onChange={(e) => e.target.value && setDate(e.target.value)} />
      </label>
      <select aria-label="Jump to an event" value="" onChange={(e) => e.target.value && setDate(e.target.value)}>
        <option value="">Jump to event…</option>
        {presets.map((p) => <option key={p.d} value={p.d}>{p.label}</option>)}
      </select>
      {setHorizon && horizon && (
        <Segmented value={horizon} onChange={setHorizon} options={[3, 5, 7].map((h) => ({ value: h, label: `${h} days` }))} />
      )}
    </div>
  )
}

function ScenarioCard({ s, active, onApply }: { s: Scenario; active: boolean; onApply: () => void }) {
  const Icon = SCEN_ICON[s.key]
  const color = SCEN_COLOR[s.key]
  const featured = s.key === 'recommended'
  return (
    <motion.button
      layout whileHover={{ y: -3 }} whileTap={{ scale: 0.98 }} onClick={onApply}
      className="card relative flex h-full flex-col p-5 text-left transition-shadow"
      style={{
        borderColor: active ? color : featured ? `color-mix(in srgb, ${color} 40%, transparent)` : undefined,
        boxShadow: active ? `0 0 0 1px ${color}, 0 18px 40px -20px ${color}` : undefined,
      }}
    >
      {featured && (
        <span className="absolute -top-2.5 right-4 rounded-full px-2.5 py-0.5 text-[11px] font-bold text-white" style={{ background: color }}>
          Our suggestion
        </span>
      )}
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl" style={{ background: `color-mix(in srgb, ${color} 16%, transparent)`, color }}>
          <Icon size={20} />
        </div>
        <div>
          <div className="font-semibold text-ink">{s.label}</div>
          <div className="text-xs text-muted">{s.purpose}</div>
        </div>
      </div>
      <div className="mt-4 flex items-baseline gap-1.5">
        <span className="text-[30px] font-bold tracking-tight text-ink"><AnimatedNumber value={s.release_cusecs} /></span>
        <span className="text-sm text-muted">cusecs</span>
      </div>
      <div className="text-xs text-muted">{fmt(s.release_tmc_total, 2)} TMC released over the horizon</div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div><dt className="text-xs text-muted">Final storage</dt><dd className="tabular font-semibold text-ink">{fmt(s.final_storage_tmc, 2)} TMC</dd></div>
        <div><dt className="text-xs text-muted">Peak if inflow is high</dt><dd className="tabular font-semibold text-ink">{fmt(s.max_storage_upper_tmc, 2)} TMC</dd></div>
      </dl>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <ZoneBadge zone={s.status} />
        {s.status_if_upper_inflow !== s.status && (
          <span className="flex items-center gap-1 text-xs text-muted">high inflow: <ZoneBadge zone={s.status_if_upper_inflow} /></span>
        )}
      </div>
      <p className="mt-3 text-[13px] leading-relaxed text-ink-2">{s.explanation}</p>
      <div className="mt-auto pt-4 text-xs font-semibold" style={{ color }}>
        {active ? <span className="flex items-center gap-1"><Check size={14} /> Applied to the simulator</span> : 'Click to apply to the simulator →'}
      </div>
    </motion.button>
  )
}

function ProjectionChart({ rec, release, series }: { rec: Recommendation; release: number; series: Series }) {
  const main = simulate(rec, release, series)
  const lo = simulate(rec, release, 'lower')
  const hi = simulate(rec, release, 'upper')
  const none = rec.no_release_trajectory
  const data = [rec.decision_date, ...rec.dates].map((d, i) => ({
    date: d,
    label: i === 0 ? 'Today' : shortDate(d),
    projected: main[i], band: [lo[i], hi[i]] as [number, number],
    noRelease: none[i],
    actual: i === 0 ? rec.initial_storage_tmc : rec.actual_storage_tmc[i - 1],
  }))
  const vals = data.flatMap((r) => [r.projected, r.band[0], r.band[1], r.noRelease, r.actual ?? r.projected])
  const yMin = Math.floor(Math.min(...vals, FRL_TMC - 3) - 0.5)
  const yMax = Math.ceil(Math.max(...vals, FRL_TMC) + 0.8)

  return (
    <ResponsiveContainer width="100%" height={340}>
      <ComposedChart data={data} margin={{ top: 16, right: 64, left: 0, bottom: 0 }}>
        <CartesianGrid {...gridProps} />
        <ReferenceArea y1={FRL_TMC} y2={yMax} fill="var(--critical)" fillOpacity={0.07} />
        <ReferenceArea y1={CAUTION_TMC} y2={FRL_TMC} fill="var(--warning)" fillOpacity={0.06} />
        {yMin < MDDL_TMC + 1 && <ReferenceArea y1={yMin} y2={MDDL_TMC} fill="var(--critical)" fillOpacity={0.07} />}
        <XAxis dataKey="label" {...axisProps} />
        <YAxis domain={[yMin, yMax]} {...axisProps} width={52} tickFormatter={(v) => fmt(v, 0)}
          label={{ value: 'Gross storage (TMC)', angle: -90, position: 'insideLeft', offset: 12, fill: 'var(--muted)', fontSize: 12, style: { textAnchor: 'middle' } }} />
        <ReferenceLine y={FRL_TMC} stroke="var(--critical)" strokeWidth={1.5}
          label={{ value: `FRL ${FRL_TMC}`, position: 'right', fill: 'var(--critical)', fontSize: 11, fontWeight: 600 }} />
        <ReferenceLine y={CAUTION_TMC} stroke="var(--warning)" strokeWidth={1}
          label={{ value: 'Cushion', position: 'right', fill: 'var(--warning)', fontSize: 11 }} />
        {yMin < MDDL_TMC && <ReferenceLine y={MDDL_TMC} stroke="var(--warning)" label={{ value: 'MDDL', position: 'right', fill: 'var(--warning)', fontSize: 11 }} />}
        <Area dataKey="band" stroke="none" fill="var(--series-1)" fillOpacity={0.16} isAnimationActive={false} />
        <Line dataKey="noRelease" stroke="var(--muted)" strokeWidth={1.5} strokeDasharray="6 5" dot={false} isAnimationActive={false} />
        <Line dataKey="actual" stroke="var(--ink-2)" strokeWidth={0} dot={{ r: 5, fill: 'var(--surface)', stroke: 'var(--ink-2)', strokeWidth: 2 }} isAnimationActive={false} connectNulls />
        <Line dataKey="projected" stroke="var(--series-1)" strokeWidth={3} dot={{ r: 5, fill: 'var(--series-1)', stroke: 'var(--surface)', strokeWidth: 2 }}
          activeDot={{ r: 7 }} isAnimationActive={false} />
        <Tooltip
          cursor={{ stroke: 'var(--axis)' }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null
            const r = payload[0].payload
            return <TooltipBox title={r.label === 'Today' ? `Today · ${fmtDate(r.date)}` : fmtDate(r.date)} rows={[
              { name: 'Projected', value: r.projected, color: 'var(--series-1)', unit: 'TMC', digits: 2 },
              { name: 'Band low', value: r.band[0], color: 'var(--series-1)', unit: 'TMC', digits: 2 },
              { name: 'Band high', value: r.band[1], color: 'var(--series-1)', unit: 'TMC', digits: 2 },
              { name: 'No release', value: r.noRelease, color: 'var(--muted)', unit: 'TMC', digits: 2 },
              { name: 'Actually observed', value: r.actual, color: 'var(--ink-2)', unit: 'TMC', digits: 2 },
            ]} />
          }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

function ScenarioCompareChart({ rec }: { rec: Recommendation }) {
  const data = [rec.decision_date, ...rec.dates].map((d, i) => ({
    date: d, label: i === 0 ? 'Today' : shortDate(d),
    ...Object.fromEntries(rec.scenarios.map((s) => [s.key, s.trajectory[i]])),
  }))
  const vals = rec.scenarios.flatMap((s) => s.trajectory)
  const yMin = Math.floor(Math.min(...vals) - 0.5), yMax = Math.ceil(Math.max(...vals, FRL_TMC) + 0.5)
  const Tip = makeTooltip(rec.scenarios.map((s) => ({ key: s.key, name: s.label, color: SCEN_COLOR[s.key], unit: 'TMC', digits: 2 })))
  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={data} margin={{ top: 10, right: 100, left: 0, bottom: 0 }}>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="label" {...axisProps} />
        <YAxis domain={[yMin, yMax]} {...axisProps} width={44} tickFormatter={(v) => fmt(v, 0)} />
        <ReferenceLine y={FRL_TMC} stroke="var(--critical)" label={{ value: 'FRL', position: 'insideTopLeft', fill: 'var(--critical)', fontSize: 11 }} />
        {rec.scenarios.map((s) => (
          <Line key={s.key} dataKey={s.key} stroke={SCEN_COLOR[s.key]} strokeWidth={2} dot={{ r: 4, fill: SCEN_COLOR[s.key], stroke: 'var(--surface)', strokeWidth: 2 }} isAnimationActive>
            <LabelList dataKey={s.key} content={(p) => {
              const { x, y, index } = p as { x: number; y: number; index: number }
              if (index !== data.length - 1) return null
              return <text x={x + 10} y={y + 4} fontSize={12} fill="var(--ink-2)" fontWeight={600}>{s.label}</text>
            }} />
          </Line>
        ))}
        <Tooltip content={<Tip />} cursor={{ stroke: 'var(--axis)' }} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

function InflowWindowChart({ rec }: { rec: Recommendation }) {
  const data = rec.dates.map((d, i) => ({
    date: d, label: shortDate(d),
    predicted: rec.inflow_cusecs.predicted[i],
    err: [rec.inflow_cusecs.predicted[i] - rec.inflow_cusecs.lower[i], rec.inflow_cusecs.upper[i] - rec.inflow_cusecs.predicted[i]],
    lower: rec.inflow_cusecs.lower[i], upper: rec.inflow_cusecs.upper[i],
    actual: rec.inflow_cusecs.actual[i],
  }))
  const Tip = makeTooltip([
    { key: 'predicted', name: 'Forecast', color: 'var(--series-2)', unit: 'cusecs' },
    { key: 'lower', name: '10th pct', color: 'var(--series-2)', unit: 'cusecs' },
    { key: 'upper', name: '90th pct', color: 'var(--series-2)', unit: 'cusecs' },
    { key: 'actual', name: 'Actual', color: 'var(--ink-2)', unit: 'cusecs' },
  ])
  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="label" {...axisProps} />
        <YAxis {...axisProps} width={44} tickFormatter={compact} />
        <Bar dataKey="predicted" fill="var(--series-2)" radius={[4, 4, 0, 0]} maxBarSize={34}>
          <ErrorBar dataKey="err" stroke="var(--ink-2)" width={8} strokeWidth={1.5} />
        </Bar>
        <Scatter dataKey="actual" fill="var(--ink)" shape="diamond" />
        <Tooltip content={<Tip />} cursor={{ fill: 'var(--surface-2)', opacity: 0.5 }} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

function LogicSteps({ rec }: { rec: Recommendation }) {
  const rmin = Math.max(...rec.logic_steps.map((s) => s.required_release_cusecs))
  const flow = [
    { t: 'Current storage + forecast inflow (90th pct) − losses', v: `${fmt(rec.initial_storage_tmc, 2)} TMC today` },
    { t: 'Storage if we release nothing', v: `peaks at ${fmt(Math.max(...rec.logic_steps.map((s) => s.storage_if_no_release_tmc)), 2)} TMC` },
    { t: 'Release needed to stay below FRL, for each day', v: `${rec.logic_steps.length} days checked` },
    { t: 'Take the largest required release', v: `${fmt(rmin)} cusecs` },
    { t: 'Minimum feasible constant release', v: `${fmt(rec.scenarios[1].release_cusecs)} cusecs (capped at MDDL limit ${fmt(rec.max_safe_release_cusecs)})` },
  ]
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
      <ol className="space-y-1">
        {flow.map((f, i) => (
          <li key={i}>
            <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
              className="rounded-xl border border-line bg-surface-2/60 px-4 py-2.5">
              <div className="text-[13px] text-ink-2">{f.t}</div>
              <div className="tabular text-sm font-semibold text-ink">{f.v}</div>
            </motion.div>
            {i < flow.length - 1 && <ArrowDown size={14} className="mx-auto my-0.5 text-muted" />}
          </li>
        ))}
      </ol>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted">
              <th className="py-2 pr-3 font-medium">Day</th>
              <th className="py-2 pr-3 font-medium">Date</th>
              <th className="py-2 pr-3 text-right font-medium">Storage if no release</th>
              <th className="py-2 pr-3 text-right font-medium">Excess over FRL</th>
              <th className="py-2 text-right font-medium">Release needed</th>
            </tr>
          </thead>
          <tbody className="tabular">
            {rec.logic_steps.map((s) => {
              const isMax = s.required_release_cusecs === rmin && rmin > 0
              return (
                <tr key={s.day} className="border-b border-line/60" style={isMax ? { background: 'color-mix(in srgb, var(--series-2) 10%, transparent)' } : undefined}>
                  <td className="py-2 pr-3 text-ink-2">k = {s.day}</td>
                  <td className="py-2 pr-3 text-ink-2">{shortDate(s.date)}</td>
                  <td className="py-2 pr-3 text-right text-ink">{fmt(s.storage_if_no_release_tmc, 2)} TMC</td>
                  <td className="py-2 pr-3 text-right" style={{ color: s.excess_over_ceiling_tmc > 0 ? 'var(--critical)' : 'var(--muted)' }}>
                    {s.excess_over_ceiling_tmc > 0 ? '+' : ''}{fmt(s.excess_over_ceiling_tmc, 2)} TMC
                  </td>
                  <td className="py-2 text-right font-semibold text-ink">{fmt(s.required_release_cusecs)} {isMax && <span className="ml-1 text-xs" style={{ color: 'var(--series-2)' }}>◀ max</span>}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <p className="mt-3 text-xs leading-relaxed text-muted">
          Required release on day k = (storage if no release − FRL) ÷ k, converted with 1 TMC/day = 11,574 cusecs.
          Using the 90th-percentile inflow makes the suggestion robust to the forecast under-predicting.
        </p>
      </div>
    </div>
  )
}

export default function Simulate() {
  const { date } = useDecisionDate()
  const [horizon, setHorizon] = useState(3)
  const [series, setSeries] = useState<Series>('predicted')
  const { data: rec, error, isLoading, isFetching } = useRecommendation(date, horizon)
  const [release, setRelease] = useState(0)

  const key = rec ? `${rec.decision_date}-${rec.dates.length}` : ''
  useEffect(() => {
    if (rec) setRelease(rec.scenarios[1].release_cusecs)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const sliderMax = useMemo(() => {
    if (!rec) return 30000
    const top = Math.max(30000, rec.scenarios[2].release_cusecs * 1.3)
    return Math.min(150000, Math.ceil(top / 5000) * 5000)
  }, [rec])

  const traj = rec ? simulate(rec, release, series) : []
  const status = rec ? worstZone(traj) : 'normal'
  const spill = traj.slice(1).filter((s) => s > FRL_TMC).length
  const activeKey = rec?.scenarios.find((s) => Math.abs(s.release_cusecs - release) < 1)?.key

  return (
    <>
      <PageHeader eyebrow="Simulate & recommend" title="What should KRS release?"
        right={<DateControls horizon={horizon} setHorizon={setHorizon} />}>
        Pick any day in the 2014–2019 test period. The forecast inflow drives a day-by-day water balance, and the
        recommendation engine finds the smallest steady release that keeps storage below Full Reservoir Level.
      </PageHeader>

      {error && <ErrorNote error={error} />}
      {isLoading && <Loading h={420} />}

      {rec && (
        <div className={`space-y-6 transition-opacity ${isFetching ? 'opacity-60' : ''}`}>
          {horizon > 3 && (
            <Callout title="Back-test note for horizons beyond 3 days">
              Person B's model predicts 3 days ahead, so days 4–{horizon} use forecasts issued after the decision date. This shows what a
              longer-range forecast would enable; in live operation, only the 3-day window is available.
            </Callout>
          )}

          <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
            <Card title="Projected storage" subtitle={`Starting ${fmtDate(rec.decision_date)} at ${fmt(rec.initial_storage_tmc, 2)} TMC gross · release held constant`}
              right={<Segmented value={series} onChange={setSeries} options={[
                { value: 'predicted', label: 'Forecast' }, { value: 'upper', label: 'High (P90)' }, { value: 'lower', label: 'Low (P10)' }, { value: 'actual', label: 'Actual' },
              ]} />}>
              <ProjectionChart rec={rec} release={release} series={series} />
              <div className="mt-3"><Legend>
                <LegendItem color="var(--series-1)" label={`Projection at ${fmt(release)} cusecs`} />
                <LegendItem color="color-mix(in srgb, var(--series-1) 30%, transparent)" kind="band" label="Range from P10–P90 inflow" />
                <LegendItem color="var(--muted)" kind="dash" label="If nothing is released" />
                <LegendItem color="var(--ink-2)" kind="dot" label="Actually observed" />
              </Legend></div>
            </Card>

            <Card title="What-if release" subtitle="Drag to test a release rate; the chart updates live">
              <div className="flex items-baseline gap-2">
                <span className="text-[44px] font-extrabold leading-none tracking-tight text-ink tabular">{fmt(release)}</span>
                <span className="text-muted">cusecs</span>
              </div>
              <div className="mt-1 text-xs text-muted">= {fmt(release / 11574.07, 3)} TMC per day</div>
              <input type="range" className="slider mt-5" min={0} max={sliderMax} step={250} value={release} aria-label="Release in cusecs"
                onChange={(e) => setRelease(+e.target.value)} style={{ ['--pct' as string]: `${(100 * release) / sliderMax}%` }} />
              <div className="mt-1 flex justify-between text-[11px] text-muted"><span>0</span><span>{compact(sliderMax)}</span></div>

              <div className="mt-4 flex flex-wrap gap-2">
                {rec.scenarios.map((s) => (
                  <button key={s.key} onClick={() => setRelease(s.release_cusecs)}
                    className="rounded-full border px-3 py-1 text-xs font-semibold transition-colors"
                    style={{ borderColor: SCEN_COLOR[s.key], color: activeKey === s.key ? 'var(--surface)' : 'var(--ink-2)', background: activeKey === s.key ? SCEN_COLOR[s.key] : 'transparent' }}>
                    {s.label}
                  </button>
                ))}
              </div>

              <div className="mt-5 rounded-2xl border border-line bg-surface-2/50 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted">Outcome</span>
                  <ZoneBadge zone={status} size="md" />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div><div className="text-xs text-muted">Final storage</div><div className="tabular font-semibold">{fmt(traj.at(-1), 2)} TMC</div></div>
                  <div><div className="text-xs text-muted">Days above FRL</div><div className="tabular font-semibold" style={{ color: spill ? 'var(--critical)' : undefined }}>{spill} / {rec.dates.length}</div></div>
                  <div><div className="text-xs text-muted">Peak storage</div><div className="tabular font-semibold">{fmt(Math.max(...traj.slice(1)), 2)} TMC</div></div>
                  <div><div className="text-xs text-muted">Operators released</div><div className="tabular font-semibold">{fmt(rec.actual_release_cusecs.reduce<number>((a, b) => a + (b ?? 0), 0) / rec.dates.length)} <span className="text-xs font-normal text-muted">avg</span></div></div>
                </div>
              </div>
              <div className="mx-auto mt-4 max-w-[240px]"><ReservoirGauge storage={rec.initial_storage_tmc} projected={traj.at(-1)} height={190} /></div>
            </Card>
          </div>

          <div>
            <div className="mb-3 flex items-center gap-2">
              <Droplet size={16} className="text-accent" />
              <h2 className="text-lg font-semibold">Release scenarios</h2>
              {!rec.flood_pressure && <span className="text-sm text-muted">· no flood pressure in this window</span>}
            </div>
            <div className="grid gap-5 pt-2 md:grid-cols-3">
              {rec.scenarios.map((s) => <ScenarioCard key={s.key} s={s} active={activeKey === s.key} onApply={() => setRelease(s.release_cusecs)} />)}
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Scenarios side by side" subtitle="Storage trajectory under each scenario, forecast inflow">
              <ScenarioCompareChart rec={rec} />
              <div className="mt-2"><Legend>{rec.scenarios.map((s) => <LegendItem key={s.key} color={SCEN_COLOR[s.key]} label={`${s.label} · ${fmt(s.release_cusecs)} cusecs`} />)}</Legend></div>
            </Card>
            <Card title="Forecast inflow for this window" subtitle="Random Forest, 3-day-ahead, with 80% range (P10–P90)">
              <InflowWindowChart rec={rec} />
              <div className="mt-2"><Legend>
                <LegendItem color="var(--series-2)" kind="band" label="Forecast inflow" />
                <LegendItem color="var(--ink-2)" label="P10–P90 whisker" />
                <LegendItem color="var(--ink)" kind="dot" label="Actual inflow" />
              </Legend></div>
            </Card>
          </div>

          <Card title={<span className="flex items-center gap-2"><Waves size={16} className="text-accent" /> How the recommendation is calculated</span>}
            subtitle="Slide-25 logic with this window's real numbers">
            <LogicSteps rec={rec} />
          </Card>
        </div>
      )}
    </>
  )
}
