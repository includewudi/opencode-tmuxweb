import { lazy, Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './styles/global.css'

const App = lazy(() => import('./desktop/App'))
const MobileApp = lazy(() => import('./mobile/MobileApp'))

ReactDOM.createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <Suspense fallback={<div className="loading">Loading...</div>}>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/m" element={<MobileApp />} />
      </Routes>
    </Suspense>
  </BrowserRouter>
)
