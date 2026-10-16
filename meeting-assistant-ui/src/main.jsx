import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MotionConfig } from 'framer-motion'
import './styles/index.css'
import './styles/clarion.css'
import './styles/visual-story.css'
import './styles/connector-sheet.css'
import AuthGate from './features/auth/AuthGate.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <MotionConfig reducedMotion="user"><AuthGate /></MotionConfig>
  </StrictMode>,
)
