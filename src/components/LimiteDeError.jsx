import { Component } from 'react';
import { Boton } from '@/components/ui';
import { FONT, KP } from '@/lib/theme';

/* La red de seguridad de toda la app (p86, 26 oct 2026). Antes, si una pieza de la app no cargaba o una pantalla fallaba al dibujarse, React desmontaba todo y la persona
   se quedaba con una pantalla en blanco, sin nada que tocar. Lo típico: se publica una versión nueva con la app ya abierta; las piezas viejas desaparecen del servidor y la
   siguiente pantalla que se abre no las encuentra. Aquí se avisa y se ofrece recargar. Las pantallas que ya tenían su propio aviso (métricas, botón del entreno) siguen
   atrapando lo suyo primero: este límite solo recoge lo que ellas no recogen. */

const ES_PIEZA_NUEVA = (error) => /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError|Loading chunk/i
  .test(String(error?.message ?? error));

export default class LimiteDeError extends Component {
  state = { fallo: null };

  static getDerivedStateFromError(error) { return { fallo: error }; }

  componentDidCatch(error, info) { console.error('La app se detuvo', error, info?.componentStack); }

  render() {
    const { fallo } = this.state;
    if (!fallo) return this.props.children;
    const nueva = ES_PIEZA_NUEVA(fallo);
    return (
      <div
        role="alert"
        style={{
          minHeight: '100svh', display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center', justifyContent: 'center', textAlign: 'center',
          padding: '24px 28px', fontFamily: FONT, background: KP.bg, color: KP.ink,
        }}
      >
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.4 }}>{nueva ? 'Hay una versión nueva' : 'Algo salió mal'}</div>
        <div style={{ maxWidth: 320, fontSize: 15, fontWeight: 500, lineHeight: 1.5, color: KP.ink2 }}>
          {nueva
            ? 'Training Lab se actualizó mientras lo tenías abierto. Recarga para seguir donde ibas.'
            : 'Esta pantalla no se pudo mostrar. Recarga para volver a intentarlo; lo que ya guardaste está a salvo.'}
        </div>
        <div style={{ width: '100%', maxWidth: 320, marginTop: 6 }}>
          <Boton ancho onClick={() => window.location.reload()}>Recargar</Boton>
        </div>
      </div>
    );
  }
}
