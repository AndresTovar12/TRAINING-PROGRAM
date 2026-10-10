import { Component, Suspense, lazy } from 'react';
import HojaFlotante from '@/components/HojaFlotante';
import { LT } from '@/lib/theme';

/* Abre las métricas de un atleta SIN meterlas al paquete principal: las gráficas, los lectores de archivos y las pantallas pesan, y casi nadie las abre en cada
   sesión. Se bajan al primer toque. Si la descarga falla (sin señal), se dice con claridad y el resto de la app sigue como estaba. */

const MetricasDelAtleta = lazy(() => import('./MetricasDelAtleta'));

class Limite extends Component {
  state = { fallo: false };

  static getDerivedStateFromError() { return { fallo: true }; }

  componentDidCatch(error) { console.error('Las métricas no se pudieron abrir', error); }

  render() {
    if (!this.state.fallo) return this.props.children;
    return (
      <HojaFlotante titulo="Métricas" onCerrar={this.props.onCerrar}>
        <div role="alert" style={{ padding: '28px 6px', color: LT.text2, fontSize: 15, fontWeight: 600, lineHeight: 1.5 }}>
          No se pudieron abrir las métricas. Revisa tu conexión y vuelve a intentarlo.
        </div>
      </HojaFlotante>
    );
  }
}

/** `atleta`: `{ id, full_name, username }`. `esAtleta`: lo abre el propio atleta. `abrirEn`: `'importar'` para llegar directo a la importación. */
export default function AbreMetricas({ atleta, esAtleta = false, abrirEn = null, onCerrar }) {
  return (
    <Limite onCerrar={onCerrar}>
      <Suspense fallback={null}>
        <MetricasDelAtleta atleta={atleta} esAtleta={esAtleta} abrirEn={abrirEn} onCerrar={onCerrar} />
      </Suspense>
    </Limite>
  );
}
