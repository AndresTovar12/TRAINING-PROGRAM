import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Check, ExternalLink, Eye, Heart, Loader2, Watch, X, Zap } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { FONT, KP } from '@/lib/theme';
import { botonPrimario, botonSecundario, enlace, subtitulo, titulo } from '@/features/inicio/estilos';
import { pideSalud, revisaPermiso, saludDisponible } from '@/lib/saludDelTelefono';
import { conectaEnLaCuenta, useReloj } from '@/lib/relojConectado';
import { traeDelReloj, traeLoDeAntes } from '@/lib/sincronizaSalud';
import {
  Beneficio, Beneficios, Consejo, EstilosDelReloj, IconoGrande, PASOS_DE_LA_APP_WATCH, PASOS_DE_SALUD, PasosApp, Pista, RelojDibujado,
} from './piezas';

/* CONECTAR EL APPLE WATCH (fase 5, 29 oct 2026; textos y recorrido del prototipo aprobado, artifact 1kttQGTS8apYoeDH2JVcoo).

   Un solo «Conectar Apple Watch» que pide TODO junto, una vez, en el iPhone (leer y escribir: el reloj ya no pregunta). La pantalla dice antes qué va a
   preguntar el iPhone y qué tocar. Después, «Conectando tu Apple Watch…» dura lo que tardan las dos revisiones de `revisaPermiso`, y sale:
     · «Listo, {Nombre}»: se guarda la conexión en la cuenta (`conectado_en` = ahora) y, en segundo plano, se trae lo nuevo y lo de antes (solo para las cuentas).
       Nunca se dice «Conectado» si no se pudo leer nada.
     · «No pudimos leer nada»: cómo encenderlo en Salud, «Abrir Salud» y «Ya lo encendí, revisar otra vez» (repite solo las dos revisiones).
     · «Falta un paso»: solo con reloj emparejado y SIN la app del reloj instalada.
   Sin reloj emparejado la misma pantalla se llama «Conecta Apple Salud», con otros beneficios.

   Quien la abre decide qué decir al terminar (`ConectaRelojGlobal`, el inicio de cuenta). `reconectar`: la conexión ya está en la cuenta y falta este
   iPhone (solo se pide el permiso otra vez; la fecha no cambia). `empezar`: 'intro' (la pantalla de arriba) o 'pedir' (el inicio de cuenta ya la enseñó).
   `alTerminar(como)`: 'conectado' | 'no' (cerró sin conectar). */

/** Lo de arriba de «Conecta tu Apple Watch» / «Conecta Apple Salud»: dibujo, título, beneficios, la pista de qué tocar y la leyenda. También lo usa el inicio de cuenta. */
export function CuerpoDeConectar({ emparejado, compu = false }) {
  return (
    <>
      <EstilosDelReloj />
      <div style={{ display: 'grid', placeItems: 'center', margin: '4px 0 6px' }}>
        {emparejado
          ? <RelojDibujado modo="entreno" titulo="Back Squat" tiempo="12:41" detalle="Serie 2 de 4 · 100 kg" pulso={128} />
          : <div role="img" aria-label="Apple Salud" style={{ width: 112, height: 112, borderRadius: 32, background: '#FDECEF', color: '#E5364F', display: 'grid', placeItems: 'center' }}><Heart size={54} fill="currentColor" /></div>}
      </div>
      <h1 style={titulo(compu)}>{emparejado ? 'Conecta tu Apple Watch' : 'Conecta Apple Salud'}</h1>
      <p style={subtitulo}>{emparejado ? 'Lo que haces con tu reloj entra solo a Training Lab.' : 'No vemos un Apple Watch en este iPhone. Igual traemos los entrenos que otras apps guardan en Salud.'}</p>
      <Beneficios>
        {emparejado ? (
          <>
            <Beneficio Icono={Watch} titulo="Te sigue mientras entrenas" texto="El descanso, tu ritmo y tu pulso en tu muñeca." />
            <Beneficio Icono={Zap} titulo="Desde hoy, tus entrenos entran solos" texto="Con tu pulso y tu ruta, a tus stickers." />
            <Beneficio Icono={Eye} titulo="Tu coach ve cómo entrenas" texto="Tu pulso, tu carga y tu recuperación." />
          </>
        ) : (
          <>
            <Beneficio Icono={Zap} titulo="Desde hoy, tus entrenos entran solos" texto="Los que otras apps guarden en Salud." />
            <Beneficio Icono={Watch} titulo="Si después compras un Apple Watch" texto="Sus entrenos entran solos, sin volver a conectar nada." />
            <Beneficio Icono={Eye} titulo="Tu coach ve cómo entrenas" texto="Lo que llegue de Salud también lo ve." />
          </>
        )}
      </Beneficios>
      <Pista>El iPhone te va a preguntar qué compartir. Toca <b style={{ color: KP.ink }}>«Activar todas»</b> y luego <b style={{ color: KP.ink }}>«Permitir»</b>.</Pista>
      <p style={{ fontSize: 12.5, color: KP.ink3, textAlign: 'center', margin: '12px 0 0', lineHeight: 1.4 }}>Lo cambias cuando quieras en la app Salud.</p>
    </>
  );
}

const nombreDe = (perfil) => (perfil?.full_name || '').trim().split(/\s+/)[0] || '';
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

export default function ConectaReloj({ reconectar = false, empezar = 'intro', alTerminar }) {
  const { profile } = useAuth();
  const { reloj } = useReloj();
  const emparejado = !!reloj.emparejado;
  const [paso, setPaso] = useState(empezar === 'intro' ? 'intro' : 'pidiendo');
  const [rapido, setRapido] = useState(false); // «Revisando el permiso…» (al revisar otra vez o al volver a conectar)
  const [avance, setAvance] = useState({ texto: 'Un momento', pct: 0 });
  const [reintentos, setReintentos] = useState(0);
  const [error, setError] = useState('');
  const vivo = useRef(true);
  useEffect(() => () => { vivo.current = false; }, []);

  const termina = (como) => alTerminar?.(como);

  // Las dos revisiones (escribir entrenos y leer al menos un paso) y, si salieron bien, la conexión en la cuenta. `pedir`: antes sale la hoja del iPhone.
  async function revisa({ pedir }) {
    setError('');
    try {
      if (pedir) await pideSalud();
      if (!vivo.current) return;
      setPaso('buscando');
      setAvance({ texto: 'Revisando que el iPhone dio permiso', pct: 45 });
      const [r] = await Promise.all([revisaPermiso(), espera(pedir && !reconectar ? 900 : 700)]);
      if (!vivo.current) return;
      setAvance({ texto: 'Listo', pct: 100 });
      await espera(300);
      if (!r.ok) { setPaso('no'); return; }
      await conectaEnLaCuenta();
      // Lo nuevo y, después, lo de antes (solo para las cuentas), en segundo plano: la persona ya ve «Listo».
      traeDelReloj().catch(() => {}).finally(() => traeLoDeAntes());
      if (reconectar) { termina('conectado'); return; }
      setPaso('listo');
    } catch (e) {
      if (!vivo.current) return;
      setError(e?.message || 'No se pudo conectar. Inténtalo otra vez.');
      setPaso('no');
    }
  }

  // El inicio de cuenta ya enseñó la pantalla de arriba: se pide en cuanto se abre. Volver a conectar también va directo.
  const arrancado = useRef(false);
  useEffect(() => {
    if (paso !== 'pidiendo' || arrancado.current) return;
    arrancado.current = true;
    setRapido(reconectar);
    revisa({ pedir: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const conectar = () => { setPaso('pidiendo'); revisa({ pedir: true }); };
  const otraVez = () => { setReintentos((n) => n + 1); setRapido(true); revisa({ pedir: false }); };
  const fin = () => {
    // Con reloj emparejado y sin la app del reloj: «Falta un paso». Con el modo de prueba nunca (no hay reloj de verdad).
    if (paso === 'listo' && emparejado && !reloj.instalada && !reloj.prueba) { setPaso('instala'); return; }
    termina('conectado');
  };

  let cuerpo;
  let pie;
  let conCerrar = false;
  if (paso === 'intro' || paso === 'pidiendo') {
    conCerrar = true;
    cuerpo = <CuerpoDeConectar emparejado={emparejado} />;
    pie = (
      <>
        <button type="button" className="kp-press" onClick={conectar} disabled={paso === 'pidiendo' || !saludDisponible()} style={botonPrimario(paso === 'pidiendo')}>
          {paso === 'pidiendo' ? <Loader2 size={18} className="spin" /> : emparejado ? 'Conectar Apple Watch' : 'Conectar Apple Salud'}
        </button>
        <button type="button" onClick={() => termina('no')} style={enlace}>Ahora no</button>
      </>
    );
  } else if (paso === 'buscando') {
    cuerpo = (
      <div role="status" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 6px 40px' }}>
        <EstilosDelReloj />
        <RelojDibujado modo="sync" />
        <h2 style={{ margin: '26px 0 6px', font: `800 22px/1.2 ${FONT}`, letterSpacing: -0.3, color: KP.ink }}>{rapido ? 'Revisando el permiso…' : emparejado ? 'Conectando tu Apple Watch…' : 'Conectando Apple Salud…'}</h2>
        <p style={{ margin: 0, fontSize: 15, color: KP.ink2, fontWeight: 500 }}>{avance.texto}</p>
        <div aria-hidden="true" style={{ width: 200, height: 6, borderRadius: 9, background: '#EBEDF1', overflow: 'hidden', marginTop: 20 }}>
          <i style={{ display: 'block', height: '100%', width: `${avance.pct}%`, borderRadius: 9, background: KP.blue, transition: 'width .25s linear' }} />
        </div>
      </div>
    );
  } else if (paso === 'no') {
    cuerpo = (
      <>
        <IconoGrande tono="ambar" Icono={AlertTriangle} />
        <h1 style={titulo(false)}>No pudimos leer nada</h1>
        <p style={subtitulo}>Casi siempre es un permiso apagado. El iPhone ya no vuelve a preguntar, así que se enciende en Salud:</p>
        <PasosApp pasos={PASOS_DE_SALUD('Toca «Activar todas»')} />
        {reintentos > 0 && <Consejo><b style={{ color: KP.ink }}>Seguimos sin poder leer.</b> Revisa que Training Lab tenga todo encendido en Salud.</Consejo>}
        {error && <p role="alert" style={{ color: KP.danger, fontSize: 13.5, fontWeight: 700, margin: '0 0 8px' }}>{error}</p>}
      </>
    );
    pie = (
      <>
        <button type="button" className="kp-press" onClick={() => { window.location.href = 'x-apple-health://'; }} style={botonPrimario()}><ExternalLink size={19} />Abrir Salud</button>
        <button type="button" className="kp-press" onClick={otraVez} style={{ ...botonSecundario, border: 'none', background: '#EBEDF1', marginTop: 6 }}>Ya lo encendí, revisar otra vez</button>
        <button type="button" onClick={() => termina('no')} style={enlace}>Ahora no</button>
      </>
    );
  } else if (paso === 'listo') {
    const nom = nombreDe(profile);
    cuerpo = emparejado ? (
      <>
        <IconoGrande tono="ok" Icono={Check} />
        <h1 style={titulo(false)}>Listo{nom ? `, ${nom}` : ''}</h1>
        <p style={subtitulo}>Tu Apple Watch quedó conectado. Desde hoy, cada entreno que hagas con él entra solo.</p>
        <Consejo><b style={{ color: KP.ink }}>Empieza tu próximo entreno en Training Lab</b> y tu reloj se abre solo para medir tu pulso.</Consejo>
        <LoQueVaALlegar />
      </>
    ) : (
      <>
        <IconoGrande tono="azul" Icono={Heart} />
        <h1 style={titulo(false)}>Listo{nom ? `, ${nom}` : ''}</h1>
        <p style={subtitulo}>Conectamos Apple Salud. Desde hoy, los entrenos que otras apps guarden ahí entran solos.</p>
        <Consejo><b style={{ color: KP.ink }}>¿Compras un Apple Watch después?</b> Sus entrenos entran solos, sin volver a conectar nada.</Consejo>
      </>
    );
    pie = <button type="button" className="kp-press" onClick={fin} style={botonPrimario()}>Listo</button>;
  } else if (paso === 'instala') {
    cuerpo = (
      <>
        <IconoGrande tono="azul" Icono={Watch} />
        <h1 style={titulo(false)}>Falta un paso</h1>
        <p style={subtitulo}>Training Lab no está en tu reloj. Sin ella, tu reloj no se abre solo al entrenar ni mide tu pulso en vivo.</p>
        <PasosApp pasos={[['Abre la app Watch del iPhone'], ...PASOS_DE_LA_APP_WATCH.slice(1)]} />
        <Consejo>Tus entrenos de Salud ya están conectados. Esto es solo para el reloj.</Consejo>
      </>
    );
    pie = (
      <>
        <button type="button" className="kp-press" onClick={() => { window.location.href = 'itms-watchs://'; }} style={botonPrimario()}><ExternalLink size={19} />Abrir la app Watch</button>
        <button type="button" onClick={() => termina('conectado')} style={enlace}>Después</button>
      </>
    );
  }

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={emparejado ? 'Conecta tu Apple Watch' : 'Conecta Apple Salud'} style={{ position: 'fixed', inset: 0, zIndex: 3500, background: KP.surface, fontFamily: FONT, display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        <div style={{ width: '100%', maxWidth: 520, margin: '0 auto', flex: 1, display: 'flex', flexDirection: 'column', padding: 'calc(10px + env(safe-area-inset-top)) 20px 0', boxSizing: 'border-box' }}>
          <div style={{ minHeight: 44, display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
            {conCerrar && (
              <button type="button" onClick={() => termina('no')} aria-label="Cerrar" style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', background: '#EBEDF1', color: KP.ink2, display: 'grid', placeItems: 'center', cursor: 'pointer' }}><X size={19} /></button>
            )}
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>{cuerpo}</div>
          {pie && <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '18px 0 calc(16px + env(safe-area-inset-bottom))' }}>{pie}</div>}
        </div>
      </div>
      <style>{'.spin{animation:spin .8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}'}</style>
    </div>,
    document.body,
  );
}

/** «Lo que va a llegar desde hoy»: lo que se sabe que sí llega (todo, si dio «Activar todas»; de la lectura iOS no dice nada, así que no se pinta apagado). */
function LoQueVaALlegar() {
  const filas = [
    ['Entrenos', 'Desde que conectaste, en cuanto haya uno'],
    ['Pulso', 'En cada entreno'],
    ['Ruta', 'En los entrenos al aire libre'],
    ['Recuperación', 'Pulso en reposo y variabilidad, cada día'],
    ['Sueño', 'Cada noche que duermas con él'],
    ['Tu reloj guarda tus entrenos', 'Así mide tu pulso cuando entrenas aquí'],
  ];
  return (
    <>
      <h2 style={{ margin: '4px 4px 8px', fontSize: 16, fontWeight: 700, color: KP.ink }}>Lo que va a llegar desde hoy</h2>
      <div style={{ background: '#fff', borderRadius: 18, boxShadow: `0 0 0 1.5px ${KP.lineHi}`, overflow: 'hidden', marginBottom: 6 }}>
        {filas.map(([t, d]) => (
          <div key={t} className="ui-fila" style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 58, padding: '10px 16px' }}>
            <span style={{ width: 26, height: 26, borderRadius: '50%', background: KP.mintSoft, color: KP.mint, display: 'grid', placeItems: 'center', flex: 'none' }}><Check size={15} strokeWidth={2.6} /></span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 15.5, fontWeight: 600, color: KP.ink }}>{t}</span>
              <span style={{ display: 'block', fontSize: 13, fontWeight: 500, color: KP.ink2, marginTop: 2 }}>{d}</span>
            </span>
          </div>
        ))}
      </div>
    </>
  );
}
