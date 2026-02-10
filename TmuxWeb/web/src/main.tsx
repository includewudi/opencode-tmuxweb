import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App'
import MobileApp from './mobile/MobileApp'
import './styles/global.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<App />} />
      <Route path="/m" element={<MobileApp />} />
    </Routes>
  </BrowserRouter>
)
