import { AnimatePresence, motion } from 'framer-motion'
import { BarChart3, Droplets, Gauge, History, Info, Menu, Moon, Scale, SlidersHorizontal, Sun, Waves, X } from 'lucide-react'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'

const NAV = [
  { to: '/', label: 'Control room', icon: Gauge },
  { to: '/simulate', label: 'Simulate & recommend', icon: SlidersHorizontal },
  { to: '/forecast', label: 'Inflow forecast', icon: BarChart3 },
  { to: '/history', label: 'History', icon: History },
  { to: '/benchmark', label: 'Benchmark', icon: Scale },
  { to: '/srisailam', label: 'Srisailam', icon: Waves },
  { to: '/about', label: 'Methodology', icon: Info },
]

/* Decision date shared between the control room and the simulator */
const DateCtx = createContext<{ date: string; setDate: (d: string) => void }>({ date: '', setDate: () => {} })
export const useDecisionDate = () => useContext(DateCtx)

function useTheme() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try { return (localStorage.getItem('theme') as 'dark' | 'light') ?? 'dark' } catch { return 'dark' }
  })
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try { localStorage.setItem('theme', theme) } catch { /* private mode */ }
  }, [theme])
  return [theme, () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))] as const
}

function Brand() {
  return (
    <div className="flex items-center gap-3 px-2">
      <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-s1 to-s3 text-white shadow-lg">
        <Droplets size={22} />
      </div>
      <div className="leading-tight">
        <div className="text-[15px] font-bold text-ink">Smart Reservoir</div>
        <div className="text-xs text-muted">Decision Support System</div>
      </div>
    </div>
  )
}

function Nav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="mt-8 flex flex-col gap-1">
      {NAV.map(({ to, label, icon: Icon }) => (
        <NavLink key={to} to={to} end={to === '/'} onClick={onNavigate}
          className={({ isActive }) => `relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${isActive ? 'text-ink' : 'text-muted hover:bg-surface-2/60 hover:text-ink-2'}`}>
          {({ isActive }) => (
            <>
              {isActive && <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-xl bg-surface-2" transition={{ type: 'spring', duration: 0.4 }} />}
              {isActive && <motion.span layoutId="nav-bar" className="absolute left-0 top-2 bottom-2 w-1 rounded-full bg-accent" />}
              <Icon size={18} className="relative" />
              <span className="relative">{label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

export function Layout({ children }: { children: ReactNode }) {
  const [theme, toggle] = useTheme()
  const [date, setDate] = useState('2018-08-10')
  const [open, setOpen] = useState(false)
  const loc = useLocation()

  const footer = (
    <div className="mt-auto space-y-3 px-2 pt-6">
      <button onClick={toggle} className="flex w-full items-center gap-3 rounded-xl border border-line px-3 py-2 text-sm text-ink-2 hover:text-ink">
        {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        {theme === 'dark' ? 'Light mode' : 'Dark mode'}
      </button>
      <p className="text-[11px] leading-relaxed text-muted">K.R. Sagara Dam, Cauvery · Water Resources Management project, Review 3</p>
    </div>
  )

  return (
    <DateCtx.Provider value={{ date, setDate }}>
      <div className="flex min-h-screen">
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-line bg-surface/50 p-4 backdrop-blur-xl lg:flex">
          <Brand />
          <Nav />
          {footer}
        </aside>

        {/* Mobile top bar + drawer */}
        <div className="fixed inset-x-0 top-0 z-30 flex items-center justify-between border-b border-line bg-page/80 px-4 py-3 backdrop-blur-xl lg:hidden">
          <Brand />
          <button aria-label="Open menu" onClick={() => setOpen(true)} className="rounded-lg p-2 text-ink"><Menu /></button>
        </div>
        <AnimatePresence>
          {open && (
            <motion.div className="fixed inset-0 z-40 bg-black/50 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)}>
              <motion.aside initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }} transition={{ type: 'spring', damping: 26 }}
                className="flex h-full w-72 flex-col bg-surface p-4" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between"><Brand /><button aria-label="Close menu" onClick={() => setOpen(false)}><X className="text-muted" /></button></div>
                <Nav onNavigate={() => setOpen(false)} />
                {footer}
              </motion.aside>
            </motion.div>
          )}
        </AnimatePresence>

        <main className="min-w-0 flex-1 px-4 pb-16 pt-20 sm:px-6 lg:px-10 lg:pt-8">
          <AnimatePresence mode="wait">
            <motion.div key={loc.pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}
              className="mx-auto max-w-[1400px]">
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </DateCtx.Provider>
  )
}
