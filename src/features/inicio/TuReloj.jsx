import { Check, HeartPulse, Timer } from 'lucide-react';
import { KP } from '@/lib/theme';
import { GRIS, subtitulo, titulo } from '@/features/inicio/estilos';
import { EstilosDelReloj, PasosApp, RelojDibujado } from '@/features/reloj/piezas';

/* «TU APPLE WATCH» (paso `tu-reloj` del inicio, 1 nov 2026; maqueta LLmh1vBB4MNjVHYvzVA3ym). Va después de Salud y antes de la bienvenida, solo en la app del
   iPhone. Salud y el reloj ya no se mezclan: Salud (paso `reloj`) es igual para todos y aquí, y solo aquí, se explica que el reloj funciona POR Salud.

   Cuatro casos, que decide `casoDelReloj` con lo que dice `useReloj()`:
     a) sin reloj                              «Todo funciona con tu iPhone.» (el reloj es opcional)
     b) con reloj, sin conectar Salud          «Tu Apple Watch funciona por Salud»: conectar ahora o después
     c) con reloj y la app, Salud conectada    «Tu Apple Watch ya quedó conectado»: cómo se entrena con él
     d) con reloj sin la app, Salud conectada  «Falta un paso en tu reloj»: instalar Training Lab en el reloj
   Los botones los pone `Inicio` (guardan el paso y navegan); aquí solo se dibuja el cuerpo. Qué caso toca lo dice `casoDelReloj` (`lib/relojConectado.js`). */

const Tarjeta = ({ children }) => <div style={{ background: GRIS, borderRadius: 20, padding: '16px 16px 14px', marginBottom: 12 }}>{children}</div>;
const letraDeTarjeta = { margin: '12px 0 0', fontSize: 13, color: KP.ink2, lineHeight: 1.45 };

/** El iPhone con su palomita y, al lado, el reloj apagado con la pastilla «Opcional». */
function IphoneYRelojOpcional() {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 18, margin: '6px 0 4px' }}>
      <div role="img" aria-label="iPhone listo" style={{ position: 'relative', width: 92, height: 184, borderRadius: 22, background: '#0A0B0F', padding: 5, flex: 'none' }}>
        <div style={{ width: '100%', height: '100%', borderRadius: 18, background: KP.blue, display: 'grid', placeItems: 'center', color: '#fff' }}><Check size={30} strokeWidth={3} /></div>
        <span aria-hidden="true" style={{ position: 'absolute', right: -10, top: -10, width: 30, height: 30, borderRadius: '50%', background: KP.mint, color: '#fff', display: 'grid', placeItems: 'center', boxShadow: '0 0 0 3px #fff' }}>
          <Check size={16} strokeWidth={3.4} />
        </span>
      </div>
      <div style={{ position: 'relative', flex: 'none' }}>
        <div style={{ opacity: 0.45 }}><RelojDibujado modo="entreno" titulo="Back Squat" tiempo="12:41" detalle="Serie 2 de 4 · 100 kg" pulso={128} /></div>
        <span style={{ position: 'absolute', left: '50%', bottom: -6, transform: 'translateX(-50%)', whiteSpace: 'nowrap', background: GRIS, color: KP.ink2, borderRadius: 99, padding: '3px 9px', fontSize: 11, fontWeight: 800 }}>Opcional</span>
      </div>
    </div>
  );
}

const Reloj = () => <div style={{ display: 'grid', placeItems: 'center', margin: '4px 0 6px' }}><RelojDibujado modo="entreno" titulo="Back Squat" tiempo="12:41" detalle="Serie 2 de 4 · 100 kg" pulso={128} /></div>;

export default function TuReloj({ caso, conecto = false, compu = false }) {
  if (caso === 'a') {
    const ganas = [[Timer, 'El descanso, en tu muñeca'], [HeartPulse, 'Tu pulso en vivo, en tus stickers'], [Check, '“Listo” sin sacar el teléfono']];
    return (
      <>
        <EstilosDelReloj />
        <IphoneYRelojOpcional />
        <h1 style={titulo(compu)}>Todo funciona con tu iPhone.</h1>
        <p style={subtitulo}>No necesitas nada más para entrenar, registrar y compartir.</p>
        <Tarjeta>
          <h2 style={{ margin: '0 0 10px', fontSize: 15.5, fontWeight: 800, color: KP.ink }}>¿Y si un día tienes Apple Watch?</h2>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 8 }}>
            {ganas.map(([Icono, t]) => (
              <li key={t} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 14, fontWeight: 500, color: KP.ink }}>
                <span aria-hidden="true" style={{ width: 26, height: 26, borderRadius: 8, background: '#fff', color: KP.blue, display: 'grid', placeItems: 'center', flex: 'none' }}><Icono size={15} /></span>
                {t}
              </li>
            ))}
          </ul>
          <p style={letraDeTarjeta}>
            {conecto ? 'Tu reloj manda todo por Salud, que ya conectaste. Al emparejarlo, entra solo.' : 'Tu reloj manda todo por Salud. Si un día tienes uno, conecta Salud en Mi perfil.'}
          </p>
        </Tarjeta>
      </>
    );
  }
  if (caso === 'b') {
    return (
      <>
        <EstilosDelReloj />
        <Reloj />
        <h1 style={titulo(compu)}>Tu Apple Watch funciona por Salud</h1>
        <p style={subtitulo}>Tu reloj manda su pulso y tus entrenos a Training Lab a través de Salud. Como no la conectaste, todavía no manda nada.</p>
        <Tarjeta>
          <p style={{ margin: 0, display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 14, fontWeight: 600, color: KP.ink, lineHeight: 1.4 }}>
            <HeartPulse size={18} color="#E5364F" style={{ flex: 'none', marginTop: 1 }} /> {/* estilo-ok: el rosa de Apple Salud */}
            Sin Salud: tu reloj no se abre al entrenar ni mide tu pulso en la app.
          </p>
          <p style={letraDeTarjeta}>La puedes conectar ahora o después, en Mi perfil.</p>
        </Tarjeta>
      </>
    );
  }
  if (caso === 'c') {
    return (
      <>
        <EstilosDelReloj />
        <Reloj />
        <h1 style={titulo(compu)}>Tu Apple Watch ya quedó conectado</h1>
        <p style={subtitulo}>Tu reloj manda su pulso y tus entrenos por Salud. No hay nada más que hacer. Así entrenas con él:</p>
        <PasosApp pasos={[
          ['Empieza el entreno en tu iPhone', 'Tu reloj se abre solo.'],
          ['Marca cada serie en tu muñeca', 'Con “Listo”, sin sacar el teléfono.'],
          ['Al terminar, tu pulso va a tu sticker', 'Y tu coach lo ve en tu entreno.'],
        ]} />
      </>
    );
  }
  return (
    <>
      <EstilosDelReloj />
      <Reloj />
      <h1 style={titulo(compu)}>Falta un paso en tu reloj</h1>
      <p style={subtitulo}>Salud ya quedó conectada. Para que tu reloj se abra solo y mida tu pulso en vivo, instala Training Lab en él:</p>
      <PasosApp pasos={[
        ['Abre la app Watch del iPhone', 'La del ícono del reloj.'],
        ['Busca Training Lab', 'Abajo, en “Apps disponibles”.'],
        ['Toca “Instalar”', 'Tarda menos de un minuto.'],
      ]} />
    </>
  );
}
