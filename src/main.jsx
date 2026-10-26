import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from '@/contexts/AuthContext'
import { MensajesProvider } from '@/contexts/MensajesContext'
import { ConfirmacionProvider } from '@/components/Confirmacion'
import { AvisoProvider } from '@/components/AvisoPasajero'
import { iniciaNativo } from '@/lib/nativo'
import LimiteDeError from '@/components/LimiteDeError'

// Dentro de la app de iPhone: barra de estado, GPS del teléfono, links que abren la app… (en la web no hace nada).
iniciaNativo()

/* Se publicó una versión nueva con la app abierta: las piezas viejas ya no existen en el servidor y Vite avisa con este evento cuando una no baja. Se recarga UNA vez para
   traer la versión nueva sin que la persona haga nada (p86). El seguro evita un bucle si el fallo fuera otro (sin internet): la segunda vez se deja que `LimiteDeError` avise. */
window.addEventListener('vite:preloadError', (evento) => {
  try {
    const ultima = Number(sessionStorage.getItem('tl:recarga-por-version') || 0);
    if (Date.now() - ultima < 60_000) return;
    sessionStorage.setItem('tl:recarga-por-version', String(Date.now()));
    evento.preventDefault();
    window.location.reload();
  } catch { /* sin almacenamiento: no se recarga solo; el aviso de LimiteDeError ofrece el botón */ }
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <LimiteDeError>
      <AuthProvider>
        <MensajesProvider>
          <ConfirmacionProvider>
            <AvisoProvider>
              <App />
            </AvisoProvider>
          </ConfirmacionProvider>
        </MensajesProvider>
      </AuthProvider>
    </LimiteDeError>
  </StrictMode>,
)
