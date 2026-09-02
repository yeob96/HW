import { Route, Routes } from 'react-router-dom'
import { InputPage } from './pages/InputPage'
import { RegionDetailPage } from './pages/RegionDetailPage'
import { ResultsPage } from './pages/ResultsPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<InputPage />} />
      <Route path="/results" element={<ResultsPage />} />
      <Route path="/results/:dongCode" element={<RegionDetailPage />} />
    </Routes>
  )
}

export default App
