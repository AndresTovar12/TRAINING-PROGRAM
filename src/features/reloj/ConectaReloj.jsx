import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, ArrowDown, ArrowUp, BedDouble, Check, ExternalLink, Eye, Heart, Loader2, Watch, X, Zap } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { FONT, KP } from '@/lib/theme';
import { botonPrimario, botonSecundario, enlace, subtitulo, titulo } from '@/features/inicio/estilos';
import { pideSalud, revisaPermiso, saludDisponible } from '@/lib/saludDelTelefono';
import { conectaEnLaCuenta, useReloj } from '@/lib/relojConectado';
import { traeDelReloj, traeLoDeAntes } from '@/lib/sincronizaSalud';
import {
  Beneficio, Beneficios, Consejo, EstilosDelReloj, IconoGrande, PASOS_DE_LA_APP_WATCH, PASOS_DE_SALUD, PasosApp, Pista, RelojDibujado,
} from './piezas';
import ConectandoSalud, { CuadroDeSalud } from './ConectandoSalud';

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
   `alTerminar(como)`: 'conectado' | 'no' (cerró sin conectar).

   `enInicio` (1 nov 2026, maqueta LLmh1vBB4MNjVHYvzVA3ym): lo abre el inicio de cuenta, donde Salud y el Apple Watch van en pantallas aparte. Entonces «Conectando
   Apple Salud…» es siempre el corazón y trae una barra y cuatro renglones. REGLA: ninguno avanza por tiempo; cada uno se marca cuando termina la llamada real:
     1. «Permiso del iPhone»                    `pideSalud()`                                  → «Dado»
     2. «Leer y escribir en Salud»              `revisaPermiso()` con `ok` + `conectaEnLaCuenta()` → «Revisado» (si `ok` es falso: «No pudimos leer nada»)
     3. «Tus entrenos de los últimos 12 meses»  `traeLoDeAntes` (a la vista, con su `alAvance`)  → «12 de 48», luego «48 entrenos» o «No hay»
     4. «Tu sueño y tu pulso en reposo»          leer la recuperación + `guardaPrevias`         → «N días» o «No hay»
   Si ya se había traído antes (`detalle.previas`), el 3 y el 4 dicen «Ya estaban»; si fallan, «Se intenta después» y el flujo sigue. La barra es la suma real
   (renglones hechos + la fracción del 3) ÷ 4. Si el 3 y el 4 tardan más de 8 s sale «Continuar»: la lectura sigue en segundo plano (`traeLoDeAntes` no depende de
   esta pantalla). Al terminar, 1.5 s en verde («Apple Salud conectada») y pasa sola. Las ÚNICAS esperas son esas dos. No hay pantalla «Listo» ni «Falta un paso»:
   el reloj tiene su propio paso en el inicio (`TuReloj`). `traeDelReloj` (lo nuevo desde que conecta) sigue callado, en segundo plano. */

const VERDE_MS = 1500;   // la pantalla verde antes de pasar sola
const CONTINUAR_MS = 8000; // tras esto, si el 3 y el 4 siguen, aparece «Continuar»
const TITULOS = ['Permiso del iPhone', 'Leer y escribir en Salud', 'Tus entrenos de los últimos 12 meses', 'Tu sueño y tu pulso en reposo'];
const FILAS_NUEVAS = () => TITULOS.map((t, i) => ({ t, estado: i === 0 ? 'va' : 'espera', der: '' }));
const entrenosDicho = (n) => (n > 0 ? `${n} ${n === 1 ? 'entreno' : 'entrenos'}` : 'No hay');
const diasDicho = (n) => (n > 0 ? `${n} ${n === 1 ? 'día' : 'días'}` : 'No hay');

/** Lo de arriba de «Conecta tu Apple Watch» / «Conecta Apple Salud»: dibujo, título, beneficios, la pista de qué tocar y la leyenda. También lo usa el inicio de cuenta.

    SIN APPLE WATCH (inicio nuevo, 30 oct 2026): Salud para todos. Aunque no tenga reloj, Salud trae lo que guardan sus otros aparatos y apps (un anillo, un
    Garmin, Strava) y su sueño y pulso en reposo. Y una tarjeta oscura con el reloj dibujado le cuenta que la app funciona con Apple Watch, sin venderle nada:
    si un día tiene uno, entra solo. Antes, sin reloj, el inicio enseñaba una pantalla que solo explicaba el reloj y no conectaba nada. */
export function CuerpoDeConectar({ emparejado, compu = false }) {
  return (
    <>
      <EstilosDelReloj />
      <div style={{ display: 'grid', placeItems: 'center', margin: '4px 0 6px' }}>
        {emparejado
          ? <RelojDibujado modo="entreno" titulo="Back Squat" tiempo="12:41" detalle="Serie 2 de 4 · 100 kg" pulso={128} />
          : <CuadroDeSalud />}
      </div>
      <h1 style={titulo(compu)}>{emparejado ? 'Conecta tu Apple Watch' : 'Conecta Apple Salud'}</h1>
      <p style={subtitulo}>{emparejado ? 'Lo que haces con tu reloj entra solo a Training Lab.' : 'No vemos un Apple Watch en este iPhone. Igual traemos lo que guardan en Salud tus otros aparatos y apps.'}</p>
      <Beneficios>
        {emparejado ? (
          <>
            <Beneficio Icono={Watch} titulo="Te sigue mientras entrenas" texto="El descanso, tu ritmo y tu pulso en tu muñeca." />
            <Beneficio Icono={Zap} titulo="Desde hoy, tus entrenos entran solos" texto="Con tu pulso y tu ruta, a tus stickers." />
            <Beneficio Icono={Eye} titulo="Tu coach ve cómo entrenas" texto="Tu pulso, tu carga y tu recuperación." />
          </>
        ) : (
          <>
            <Beneficio Icono={Zap} titulo="Desde hoy, tus entrenos entran solos" texto="Los de tu anillo, tu Garmin o apps como Strava." />
            <Beneficio Icono={BedDouble} titulo="Tu sueño y tu pulso en reposo" texto="Para ver cómo te recuperas." />
          </>
        )}
      </Beneficios>
      {!emparejado && (
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', borderRadius: 20, background: '#111318', color: '#fff', padding: '12px 16px 12px 12px', margin: '2px 0 14px' }}>
          <div style={{ flex: 'none', width: 64, height: 104, overflow: 'hidden' }}>
            <RelojDibujado modo="descanso" titulo="Descanso" tiempo="0:45" detalle="Sigue: Back Squat" pulso={126} escala={0.36} />
          </div>
          <div style={{ minWidth: 0 }}>
            <b style={{ display: 'block', fontSize: 15.5, fontWeight: 800, lineHeight: 1.25 }}>Training Lab funciona con Apple Watch</b>
            <span style={{ display: 'block', fontSize: 13, lineHeight: 1.4, color: 'rgba(255,255,255,0.75)', marginTop: 3 }}>El descanso en tu muñeca, tu pulso en vivo y «Listo» sin sacar el teléfono. Si un día tienes uno, entra solo.</span>
          </div>
        </div>
      )}
      <Pista>El iPhone te va a preguntar qué compartir. Toca <b style={{ color: KP.ink }}>«Activar todas»</b> y luego <b style={{ color: KP.ink }}>«Permitir»</b>.</Pista>
      <p style={{ fontSize: 12.5, color: KP.ink3, textAlign: 'center', margin: '12px 0 0', lineHeight: 1.4 }}>Lo cambias cuando quieras en la app Salud.</p>
    </>
  );
}

/** «Conecta Apple Salud» DEL INICIO (1 nov 2026): igual para quien tiene Apple Watch y quien no. Solo habla de Salud (qué entra y qué sale); el reloj tiene su
    propio paso después (`TuReloj`). Fuera del inicio se sigue usando `CuerpoDeConectar`. */
export function CuerpoDeSalud({ compu = false }) {
  return (
    <>
      <div style={{ display: 'grid', placeItems: 'center', margin: '4px 0 6px' }}><CuadroDeSalud /></div>
      <h1 style={titulo(compu)}>Conecta Apple Salud</h1>
      <p style={subtitulo}>Salud es donde tu iPhone guarda la información de tu cuerpo.</p>
      <Beneficios>
        <Beneficio Icono={ArrowDown} titulo="Entra a Training Lab" texto="Tus entrenos de otras apps, como Strava o Garmin, y tu sueño y tu pulso en reposo." />
        <Beneficio Icono={ArrowUp} titulo="Sale de Training Lab" texto="Tus entrenos, para que queden junto con todo lo demás." />
      </Beneficios>
      <Pista>El iPhone te va a preguntar qué compartir. Toca <b style={{ color: KP.ink }}>«Activar todas»</b> y luego <b style={{ color: KP.ink }}>«Permitir»</b>.</Pista>
      <p style={{ fontSize: 12.5, color: KP.ink3, textAlign: 'center', margin: '12px 0 0', lineHeight: 1.4 }}>Lo cambias cuando quieras en la app Salud.</p>
    </>
  );
}

const nombreDe = (perfil) => (perfil?.full_name || '').trim().split(/\s+/)[0] || '';
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

export default function ConectaReloj({ reconectar = false, empezar = 'intro', enInicio = false, alTerminar }) {
  const { profile } = useAuth();
  const { reloj } = useReloj();
  const emparejado = !!reloj.emparejado;
  // En el inicio de cuenta no hay pantalla de arriba (ya la enseñó el paso) ni «pidiendo»: el «Conectando» con sus renglones es lo primero que se ve, y el renglón
  // «Permiso del iPhone» gira mientras sale la hoja del iPhone.
  const [paso, setPaso] = useState(empezar === 'intro' ? 'intro' : enInicio ? 'buscando' : 'pidiendo');
  const [rapido, setRapido] = useState(false); // «Revisando el permiso…» (al revisar otra vez o al volver a conectar)
  const [avance, setAvance] = useState({ texto: 'Un momento', pct: 0 });
  const [reintentos, setReintentos] = useState(0);
  const [error, setError] = useState('');
  // Solo en el inicio: los cuatro renglones, cuánto lleva el 3 (0 a 1), si ya terminó todo (verde), cuántos entrenos encontró y si ya toca «Continuar».
  const [filas, setFilas] = useState(FILAS_NUEVAS);
  const [fraccion, setFraccion] = useState(0);
  const [verde, setVerde] = useState(false);
  const [encontrados, setEncontrados] = useState(0);
  const [puedeSeguir, setPuedeSeguir] = useState(false);
  const vivo = useRef(true);
  const cerrada = useRef(false);   // «Continuar» ya cerró esta pantalla: lo que termine después no vuelve a avisar
  const pidioListo = useRef(false); // `pideSalud()` ya terminó una vez (al revisar otra vez no se vuelve a pedir)
  const temporizadores = useRef([]);
  useEffect(() => () => { vivo.current = false; temporizadores.current.forEach(clearTimeout); }, []);

  const termina = (como) => { if (cerrada.current) return; cerrada.current = true; alTerminar?.(como); };
  const marca = (i, parche) => setFilas((fs) => fs.map((f, k) => (k === i ? { ...f, ...parche } : f)));

  /* EL «CONECTANDO» DEL INICIO: cada renglón se marca cuando termina su llamada, nunca por tiempo (ver el comentario de arriba). */
  async function revisaEnInicio({ pedir }) {
    setError('');
    setFilas(FILAS_NUEVAS());
    setFraccion(0);
    setPuedeSeguir(false);
    setPaso('buscando');
    try {
      if (pedir) { await pideSalud(); pidioListo.current = true; }
      if (!vivo.current) return;
      marca(0, { estado: 'hecho', der: 'Dado' });
      marca(1, { estado: 'va' });
      const r = await revisaPermiso();
      if (!vivo.current) return;
      if (!r.ok) { setPaso('no'); return; }
      await conectaEnLaCuenta();
      if (!vivo.current) return;
      marca(1, { estado: 'hecho', der: 'Revisado' });
      // Lo nuevo (desde que conecta), callado y a la vez: no tiene renglón.
      traeDelReloj().catch(() => {});
      marca(2, { estado: 'va' });
      // Si el 3 y el 4 tardan, a los 8 s aparece «Continuar». La lectura NO depende de esta pantalla: sigue sola en segundo plano.
      const aviso = setTimeout(() => { if (vivo.current) setPuedeSeguir(true); }, CONTINUAR_MS);
      temporizadores.current.push(aviso);
      const lectura = await traeLoDeAntes({
        alAvance: (v) => {
          if (!vivo.current) return;
          if (v.fase === 'entrenos') { marca(2, { estado: 'va', der: v.total ? `${v.hechos} de ${v.total}` : '' }); setFraccion(v.total ? v.hechos / v.total : 0); return; }
          // Ya se leyeron todos los entrenos: el 3 está hecho y empieza el 4 (sueño y pulso en reposo).
          marca(2, { estado: 'hecho', der: entrenosDicho(v.hechos) });
          marca(3, { estado: 'va' });
          setFraccion(0);
          setEncontrados(v.hechos);
        },
      });
      clearTimeout(aviso);
      if (!vivo.current) return;
      setFraccion(0);
      setPuedeSeguir(false);
      if (lectura.estado === 'ya') {
        marca(2, { estado: 'hecho', der: 'Ya estaban' });
        marca(3, { estado: 'hecho', der: 'Ya estaban' });
      } else if (lectura.estado === 'listo') {
        marca(2, { estado: 'hecho', der: entrenosDicho(lectura.entrenos) });
        marca(3, { estado: 'hecho', der: diasDicho(lectura.dias) });
        setEncontrados(lectura.entrenos);
      } else {
        // No bloquea: el renglón que no terminó dice «Se intenta después» y `traeLoDeAntes` vuelve a intentar la próxima vez que se abra la app.
        if (lectura.entrenos != null) { marca(2, { estado: 'hecho', der: entrenosDicho(lectura.entrenos) }); setEncontrados(lectura.entrenos); } else marca(2, { estado: 'despues', der: 'Se intenta después' });
        marca(3, { estado: 'despues', der: 'Se intenta después' });
      }
      setVerde(true);
      const pasa = setTimeout(() => { if (vivo.current) termina('conectado'); }, VERDE_MS);
      temporizadores.current.push(pasa);
    } catch (e) {
      if (!vivo.current) return;
      setError(e?.message || 'No se pudo conectar. Inténtalo otra vez.');
      setPaso('no');
    }
  }

  // Las dos revisiones (escribir entrenos y leer al menos un paso) y, si salieron bien, la conexión en la cuenta. `pedir`: antes sale la hoja del iPhone.
  async function revisa({ pedir }) {
    if (enInicio) { await revisaEnInicio({ pedir }); return; }
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
    if (empezar === 'intro' || arrancado.current) return;
    arrancado.current = true;
    setRapido(reconectar);
    revisa({ pedir: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const conectar = () => { setPaso('pidiendo'); revisa({ pedir: true }); };
  // En el inicio, si la hoja del iPhone nunca llegó a contestarse (`pideSalud` falló), «revisar otra vez» la vuelve a pedir; fuera del inicio solo revisa.
  const otraVez = () => { setReintentos((n) => n + 1); setRapido(true); revisa({ pedir: enInicio && !pidioListo.current }); };
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
  } else if (paso === 'buscando' && enInicio) {
    // La barra es la suma real: los renglones hechos (o que se dejaron para después) más la fracción del 3, entre 4.
    const hechas = filas.filter((f) => f.estado === 'hecho' || f.estado === 'despues').length;
    const sumado = verde ? 100 : Math.min(100, ((hechas + (filas[2].estado === 'va' ? fraccion : 0)) / filas.length) * 100);
    cuerpo = (
      <ConectandoSalud
        titulo={verde ? 'Apple Salud conectada' : 'Conectando Apple Salud…'}
        sub={verde ? (encontrados > 0 ? `Encontramos ${encontrados} ${encontrados === 1 ? 'entreno' : 'entrenos'} de los últimos 12 meses.` : 'Desde hoy, tus entrenos nuevos entran solos.') : 'Cada paso se marca cuando de verdad termina.'}
        filas={filas} avance={sumado} verde={verde}
        nota={puedeSeguir && !verde ? 'Sigue leyendo mientras usas la app.' : ''}
      />
    );
    if (puedeSeguir && !verde) pie = <button type="button" className="kp-press" onClick={() => termina('conectado')} style={botonPrimario()}>Continuar</button>;
  } else if (paso === 'buscando') {
    cuerpo = (
      <div role="status" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 6px 40px' }}>
        <EstilosDelReloj />
        {/* El reloj girando solo si hay un Apple Watch; sin reloj, el corazón de Salud (antes salía el reloj aunque no hubiera ninguno). */}
        {emparejado ? <RelojDibujado modo="sync" /> : <CuadroDeSalud />}
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
    <div role="dialog" aria-modal="true" aria-label={emparejado && !enInicio ? 'Conecta tu Apple Watch' : 'Conecta Apple Salud'} style={{ position: 'fixed', inset: 0, zIndex: 3500, background: KP.surface, fontFamily: FONT, display: 'flex', flexDirection: 'column' }}>
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
