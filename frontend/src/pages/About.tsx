import { motion } from 'framer-motion'
import { BarChart3, Calculator, ChevronRight, Database, LayoutDashboard, Sparkles } from 'lucide-react'
import { Callout, Card, PageHeader } from '../components/ui'
import { useThresholds } from '../lib/api'
import { fmt } from '../lib/sim'

const STAGES = [
  { icon: Database, title: 'Data', who: 'Person A', body: 'KRS bulletin 1990–2026, 7 catchment rain gauges, O&M manual thresholds' },
  { icon: BarChart3, title: 'Forecast', who: 'Person B', body: 'Random Forest, 3-day-ahead inflow with a P10–P90 range' },
  { icon: Calculator, title: 'Simulate', who: 'Person C', body: 'Daily water balance: S + In − Release − Canal − Evap' },
  { icon: Sparkles, title: 'Recommend', who: 'Person D', body: 'Minimum feasible release + three scenarios vs FRL/MDDL' },
  { icon: LayoutDashboard, title: 'Dashboard', who: 'Person D', body: 'FastAPI + SQLite backend, React operator interface' },
]

const TEAM = [
  { n: 'Maanya Agrawal', id: '24BCE5052' }, { n: 'Gloria Dolores Rodrigues', id: '24BCE5057' },
  { n: 'N Sadhanatamilarasi', id: '23BCE1019' }, { n: 'Krithikha N', id: '23BCE1393' },
]

export default function About() {
  const t = useThresholds().data
  return (
    <>
      <PageHeader eyebrow="Methodology" title="How the Decision Support System works">
        A transparent pipeline from public data to an operator decision. Every step can be inspected, and nothing is a black box.
      </PageHeader>

      <div className="grid gap-3 md:grid-cols-5">
        {STAGES.map((s, i) => (
          <motion.div key={s.title} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} className="relative">
            <div className="card h-full p-4">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-s1 to-s3 text-white"><s.icon size={20} /></div>
              <div className="mt-3 font-semibold">{s.title}</div>
              <div className="text-xs font-medium text-accent">{s.who}</div>
              <p className="mt-2 text-[13px] leading-relaxed text-ink-2">{s.body}</p>
            </div>
            {i < STAGES.length - 1 && <ChevronRight className="absolute -right-3 top-1/2 z-10 hidden -translate-y-1/2 text-muted md:block" size={20} />}
          </motion.div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Water balance">
          <div className="rounded-xl bg-surface-2/70 p-4 text-center font-mono text-[15px] text-ink">
            S<sub>t+1</sub> = S<sub>t</sub> + Inflow − Release − Canal − Evaporation
          </div>
          <ul className="mt-4 space-y-2 text-sm text-ink-2">
            <li>• Volumes in TMC; 1 TMC per day = 11,574 cusecs.</li>
            <li>• Storage is <b className="text-ink">gross</b>, so it compares directly with the FRL capacity (49.452 TMC).</li>
            <li>• Inflow: Person B's forecast (P10 / median / P90) or the actual record for back-testing.</li>
            <li>• Canal withdrawal and evaporation are held at the decision-day value: what an operator knows that morning.</li>
          </ul>
        </Card>
        <Card title="Operating thresholds">
          {t && (
            <table className="w-full text-sm">
              <thead><tr className="border-b border-line text-left text-xs text-muted"><th className="py-2 font-medium">Level</th><th className="py-2 text-right font-medium">Gauge</th><th className="py-2 text-right font-medium">Bulletin datum</th><th className="py-2 text-right font-medium">Gross storage</th></tr></thead>
              <tbody className="tabular">
                <tr className="border-b border-line/60"><td className="py-2.5 font-medium" style={{ color: 'var(--critical)' }}>FRL</td><td className="text-right">{t.frl.gauge_ft} ft</td><td className="text-right">{fmt(t.frl.datum_ft, 1)} ft</td><td className="text-right">{t.frl.gross_tmc} TMC</td></tr>
                <tr className="border-b border-line/60"><td className="py-2.5 font-medium" style={{ color: 'var(--warning)' }}>Flood cushion</td><td className="text-right">–</td><td className="text-right">–</td><td className="text-right">{fmt(t.caution_tmc, 2)} TMC</td></tr>
                <tr className="border-b border-line/60"><td className="py-2.5 font-medium" style={{ color: 'var(--warning)' }}>MDDL</td><td className="text-right">{t.mddl.gauge_ft.toFixed(2)} ft</td><td className="text-right">{fmt(t.mddl.datum_ft, 1)} ft</td><td className="text-right">{t.mddl.gross_tmc} TMC</td></tr>
                <tr><td className="py-2.5 font-medium text-ink-2">Dead storage</td><td className="text-right">–</td><td className="text-right">–</td><td className="text-right">{t.dead_storage_tmc} TMC</td></tr>
              </tbody>
            </table>
          )}
          <p className="mt-3 text-xs leading-relaxed text-muted">
            FRL and MDDL from the KRS O&M manual. Cross-check: the bulletin's highest recorded level, 2,468.8 ft, is exactly FRL + 2,344 ft datum offset, where gross
            storage equals the design capacity 49.452 TMC; at 2,418 ft (MDDL), live storage reaches 0.
          </p>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Callout title="Scenario design">Conservative uses the median forecast, Recommended the P90 forecast, Aggressive targets the 95% flood cushion. All are capped so storage never drops below MDDL.</Callout>
        <Callout title="Fix to the simulation hand-off">Person C's prototype started from live storage (41.07 TMC) but checked it against gross capacity. That start was already at FRL, so all three of its release cases actually rose above FRL. The DSS uses gross storage throughout.</Callout>
        <Callout tone="warning" title="Known limitations">Rainfall data ends in 2019 (back-testing only); the 80% band covers ~67%; gate capacities and inter-state release obligations are not modelled.</Callout>
      </div>

      <Card className="mt-6" title="Team">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {TEAM.map((m) => (
            <div key={m.id} className="rounded-xl bg-surface-2/60 p-3">
              <div className="font-semibold">{m.n}</div>
              <div className="text-xs text-muted">{m.id}</div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-muted">Data: Karnataka WRD reservoir bulletins, India-WRIS / NWIC, IMD, CWC. Stack: React · Recharts · FastAPI · SQLite.</p>
      </Card>
    </>
  )
}
