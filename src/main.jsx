import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from '@/contexts/AuthContext'
import { ConfirmacionProvider } from '@/components/Confirmacion'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <ConfirmacionProvider>
        <App />
      </ConfirmacionProvider>
    </AuthProvider>
  </StrictMode>,
)
