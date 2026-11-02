/* eslint-disable */
/* LA PARTE DEL IPHONE DEL «APPLE WATCH SIN EL IPHONE», en WebKit con un plugin FALSO (lo carga `scripts/prueba-reloj-webkit.mjs`; solo con `npm run dev`).
   El puente falso (`window.Capacitor`, puesto por la prueba antes de cargar) se hace pasar por la app de iPhone y contesta como `EntrenoWatchPlugin.swift`.
   Aquí se exponen las piezas de verdad para que la prueba las mueva: la cola, recibir lo del reloj, mandar el plan, y las dos pantallas («Entreno en curso
   en tu reloj» y «Llegó de tu Apple Watch»). */
import { createRoot } from 'react-dom/client';
import '@/index.css';
import { pendientesAhora, usaCuenta, useCola } from '@/lib/colaDelTelefono';
import '@/lib/tiposDeLaCola';
import { escuchaLoQueLlega, mandaPlanAlReloj, revisaEnCursoDelReloj } from '@/lib/relojApple';
import { llegadosDelReloj, recibeLoDelReloj } from '@/lib/relojSinTelefonoApi';
import { catalogoParaElReloj, fechasDelReloj, planParaElReloj, sesionParaElReloj } from '@/lib/relojSinTelefono';
import { conPendientes } from '@/lib/entrenoLibreApi';
import { EntrenoEnElReloj } from '@/features/reloj/RelojSinTelefono';
import TusEntrenos from '@/features/libre/TusEntrenos';

function Pantalla({ usuario }) {
  const { cosas } = useCola();
  const filas = conPendientes([], cosas, usuario, 10) ?? [];
  const entrenos = filas.map((f) => ({ clave: `a:${f.id}`, ms: Date.parse(f.inicio), actividad: f }));
  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14, background: '#F2F3F7', minHeight: '100vh' }}>
      <EntrenoEnElReloj />
      <TusEntrenos entrenos={entrenos} alAbrir={() => {}} />
    </div>
  );
}

window.__reloj = {
  usaCuenta, recibeLoDelReloj, mandaPlanAlReloj, revisaEnCursoDelReloj, llegadosDelReloj, pendientesAhora,
  planDePrueba: (usuario) => planParaElReloj({
    usuario,
    dias: fechasDelReloj().map(({ clave }, i) => ({
      fecha: clave,
      sesiones: i ? [] : [sesionParaElReloj({
        almacen: 'wr:sessions', llave: 'f1-w1-d6', nombre: 'Fuerza · tren inferior', de: 'Carlos', rol: 'coach', color: '#1E40E0', minutos: '50 min', deporte: 'fuerza', hecha: false,
        dia: { cat: 'gym', exercises: [{ name: 'Sentadilla', sets: '4', reps: '8', intensity: '60 kg', descanso: '90 seg' }] },
      })],
    })),
    actividades: [],
    catalogo: catalogoParaElReloj([]),
  }),
  pinta: (usuario) => createRoot(document.getElementById('raiz')).render(<Pantalla usuario={usuario} />),
  escucha: () => escuchaLoQueLlega({ alResultado: () => recibeLoDelReloj() }),
};
window.__listo = true;
