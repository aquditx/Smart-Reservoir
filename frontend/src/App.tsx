import { Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import About from './pages/About'
import Benchmark from './pages/Benchmark'
import Forecast from './pages/Forecast'
import History from './pages/History'
import Overview from './pages/Overview'
import Simulate from './pages/Simulate'
import Srisailam from './pages/Srisailam'

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Overview />} />
        <Route path="/simulate" element={<Simulate />} />
        <Route path="/forecast" element={<Forecast />} />
        <Route path="/history" element={<History />} />
        <Route path="/benchmark" element={<Benchmark />} />
        <Route path="/srisailam" element={<Srisailam />} />
        <Route path="/about" element={<About />} />
        <Route path="*" element={<Overview />} />
      </Routes>
    </Layout>
  )
}
