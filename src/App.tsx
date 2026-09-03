import { Link, Route, Routes } from 'react-router-dom'
import { InputPage } from './pages/InputPage'
import { RegionDetailPage } from './pages/RegionDetailPage'
import { ResultsPage } from './pages/ResultsPage'

function App() {
  return (
    <>
      <div className="border-b border-slate-100 px-6 py-3">
        <Link to="/" className="text-base font-bold tracking-tight text-slate-900 hover:text-slate-700">
          HW
        </Link>
      </div>
      <Routes>
        <Route path="/" element={<InputPage />} />
        <Route path="/results" element={<ResultsPage />} />
        <Route path="/results/:dongCode" element={<RegionDetailPage />} />
      </Routes>
    </>
  )
}

export default App
