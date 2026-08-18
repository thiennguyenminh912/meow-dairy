import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { installGestureGuards } from './lib/mobile'
import './styles/app.css'

installGestureGuards()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
