import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from '@/contexts/AuthContext'
import { MensajesProvider } from '@/contexts/MensajesContext'
import { ConfirmacionProvider } from '@/components/Confirmacion'
import { AvisoProvider } from '@/components/AvisoPasajero'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <MensajesProvider>
        <ConfirmacionProvider>
          <AvisoProvider>
            <App />
          </AvisoProvider>
        </ConfirmacionProvider>
      </MensajesProvider>
    </AuthProvider>
  </StrictMode>,
)
