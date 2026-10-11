import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { aplicarAparencia } from './utils/aparencia'

// Aplica tema e cor antes de desenhar a página (evita piscar)
aplicarAparencia()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
