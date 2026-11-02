import { useEffect, useRef, useState } from 'react';
import { App as AppNativa } from '@capacitor/app';
import { Watch } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useAppState } from '@/contexts/AppStateContext';
import { usePlan } from '@/contexts/PlanContext';
import { usePalabras } from '@/contexts/PalabrasContext';
import { FONT, KP, LT } from '@/lib/theme';
import { saludDisponible } from '@/lib/saludDelTelefono';
import { alSubirDeLaCola, pendientesAhora, useCola } from '@/lib/colaDelTelefono';
import { avisaAlRelojQueSubio, escuchaLoQueLlega, mandaPlanAlReloj, revisaEnCursoDelReloj, useRelojEnCurso } from '@/lib/relojApple';
import { recibeLoDelReloj } from '@/lib/relojSinTelefonoApi';
import {
  TIPO_PULSO_DEL_RELOJ, TIPO_SESION_DEL_RELOJ, catalogoParaElReloj, diaParaEntrenar, fechasDelReloj, planParaElReloj, sesionParaElReloj,
} from '@/lib/relojSinTelefono';
import { claveDeRegistro, entradasDeHoy, nombreCorto, rolDelPrograma } from '@/lib/programas';
import { minutosDelNombre } from '@/lib/sesiones';
import { deporteDelTipo } from '@/lib/entreno';
import { propiasDe, tusActividades } from '@/lib/actividades';
import { useDiaDeHoy } from '@/lib/useDiaDeHoy';
import { useEntrenosRecientes } from '@/features/libre/useEntrenoLibre';
import { permisoDelRecorrido } from '@/features/training/useRecorrido';

/* EL APPLE WATCH SIN EL IPHONE, en la app (1 nov 2026, encargo «inicio, sin conexión y reloj», parte 3; ver `lib/relojSinTelefono.js` y `docs/entreno-y-reloj.md`).
   Dos piezas que no dibujan nada y una tarjeta:
     · `RecibeDelReloj` (para toda cuenta, en `App.jsx`): lo que el reloj terminó y el plugin guardó pasa a la cola del teléfono al abrir la app, al volver a
       ella y en cuanto llega. Cuando sube, se le avisa al reloj («{quien} ya lo ve»).
     · `PlanAlReloj` (en la app del atleta): le manda al reloj las sesiones de hoy y de los 2 días siguientes, sus actividades y el catálogo. Se manda al abrir
       la app y cada vez que algo de eso cambia (el plan, una sesión que se terminó, un entreno libre nuevo).
     · `EntrenoEnElReloj`: «Entreno en curso en tu reloj» (Home y el botón de la sesión): mientras el reloj tiene un entreno suyo, aquí no se empieza otro.
   Solo en la app de iPhone: en la web no hay reloj. */

const ESPERA_DEL_PLAN_MS = 1500; // se juntan los cambios seguidos (cada «Listo» de un entreno en el iPhone cambia el estado) antes de armar el plan otra vez

export function RecibeDelReloj() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  useEffect(() => {
    if (!saludDisponible()) return undefined;
    recibeLoDelReloj();
    revisaEnCursoDelReloj();
    const deja = escuchaLoQueLlega({ alResultado: () => recibeLoDelReloj() });
    const oyente = AppNativa.addListener('appStateChange', ({ isActive }) => { if (isActive) { recibeLoDelReloj(); revisaEnCursoDelReloj(); } });
    return () => {
      deja();
      oyente.then((o) => o.remove()).catch(() => {});
    };
  }, [userId]);

  /* «{quien} ya lo ve» solo cuando de verdad ya lo ve: un entreno libre o el pulso, al subir su fila; una sesión del plan, al subir su fila Y quedar
     guardado su estado (sus series viajan con el resto del estado: `delEstado` llega a 0). */
  const { delEstado } = useCola();
  const esperanEstado = useRef(new Set());
  useEffect(() => alSubirDeLaCola((cosa) => {
    const delReloj = cosa.tipo === TIPO_SESION_DEL_RELOJ || cosa.tipo === TIPO_PULSO_DEL_RELOJ || !!cosa.datos?.delReloj;
    if (!delReloj) return;
    if (cosa.tipo === TIPO_SESION_DEL_RELOJ && pendientesAhora().delEstado > 0) esperanEstado.current.add(cosa.id);
    else avisaAlRelojQueSubio(cosa.id);
  }), []);
  useEffect(() => {
    if (delEstado > 0 || !esperanEstado.current.size) return;
    esperanEstado.current.forEach((id) => avisaAlRelojQueSubio(id));
    esperanEstado.current.clear();
  }, [delEstado]);
  return null;
}

/** Las sesiones de una fecha, como las lee el reloj (`sesionParaElReloj`): las de todos los programas (el del coach, el del fisio, uno comprado). */
function sesionesDelDia(programas, store, fecha, opciones) {
  return entradasDeHoy(programas, store, fecha).map((e) => sesionParaElReloj({
    almacen: claveDeRegistro('wr:sessions', e.programa),
    llave: e.programa?.llaveEstable ? e.programa.llaveEstable(e.id) : e.id,
    nombre: e.day?.name || e.titulo,
    de: nombreCorto(e.programa?.profesional?.full_name) || null,
    rol: rolDelPrograma(e.programa),
    color: e.programa?.color ?? KP.blue,
    minutos: minutosDelNombre(e.day?.name || ''),
    deporte: deporteDelTipo(e.day),
    dia: diaParaEntrenar(e),
    hecha: !!e.hecha,
  }, opciones));
}

/** Le manda al reloj su plan. `oneRMs`: los máximos del atleta (para pasar «78 %» a kilos); `unidad`: 'kg' | 'lb'. Va dentro de la app del atleta. */
export function PlanAlReloj({ oneRMs = {}, unidad = 'kg' }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  // Mientras se hace un demo workout, el plan de verdad no se ve: no se le manda al reloj la demo como «lo de hoy» (se queda el último plan).
  const { programas, planLoading, demoActiva } = usePlan();
  const { store, loaded } = useAppState();
  const { salud } = usePalabras();
  const hoy = useDiaDeHoy();
  const { filas } = useEntrenosRecientes(saludDisponible() ? userId : null, 12);
  const propiasGuardadas = store?.['actividades:propias'];
  const [plan, setPlan] = useState(null);

  // Se arma un momento después del último cambio (no en cada «Listo»): hoy y los 2 días siguientes, con lo hecho, «Tus actividades» y el catálogo.
  useEffect(() => {
    if (!saludDisponible() || !userId || !loaded || planLoading || demoActiva) return undefined;
    const t = setTimeout(() => {
      try {
        const opciones = { oneRMs, unidad, salud };
        const conPlan = (programas ?? []).some((p) => p?.hasPlan && !p.altaEn);
        const propias = propiasDe(propiasGuardadas);
        setPlan(planParaElReloj({
          usuario: userId,
          unidad,
          sinPlan: !conPlan,
          recorrido: permisoDelRecorrido() === 'si',
          dias: fechasDelReloj(hoy).map(({ fecha, clave }) => ({ fecha: clave, sesiones: conPlan ? sesionesDelDia(programas, store, fecha, opciones) : [] })),
          actividades: tusActividades(filas ?? [], propias),
          catalogo: catalogoParaElReloj(propias),
        }));
      } catch (e) {
        console.error('reloj: no se pudo armar el plan', e?.message ?? e);
      }
    }, ESPERA_DEL_PLAN_MS);
    return () => clearTimeout(t);
  }, [userId, loaded, planLoading, demoActiva, programas, store, propiasGuardadas, filas, oneRMs, unidad, salud, hoy]);

  // Al abrir la app (y al volver a ella) se manda aunque no haya cambiado: así el reloj sabe a qué hora llegó. Mientras tanto, solo si algo cambió.
  const forzar = useRef(true);
  useEffect(() => {
    if (!plan) return;
    const quiere = forzar.current;
    mandaPlanAlReloj(plan, { forzar: quiere }).then((ok) => { if (ok && quiere) forzar.current = false; });
  }, [plan]);
  useEffect(() => {
    if (!saludDisponible()) return undefined;
    const oyente = AppNativa.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) return;
      forzar.current = true;
      setPlan((p) => (p ? { ...p, enviadoEn: Date.now() } : p));
    });
    return () => { oyente.then((o) => o.remove()).catch(() => {}); };
  }, []);
  return null;
}

/**
 * Para una cuenta sin app de atleta (un coach, en `AdminApp`): no tiene plan que mandar, pero su reloj tiene que saber de quién es y que no hay plan. Así su
 * inicio ofrece «Entreno libre» como lo principal (no «Tu plan de hoy no está en el reloj») y lo que entrene ahí llega a su cuenta.
 */
export function SinPlanAlReloj() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  useEffect(() => {
    if (!saludDisponible() || !userId) return;
    mandaPlanAlReloj(planParaElReloj({ usuario: userId, sinPlan: true, dias: [], actividades: tusActividades([], []), catalogo: catalogoParaElReloj([]) }), { forzar: true });
  }, [userId]);
  return null;
}

/** «Entreno en curso en tu reloj» (parte 3.6): empezó en el reloj y el iPhone está cerca. El reloj sigue mandando; aquí no se empieza otro. `compacta`: dentro del botón de la sesión. */
export function EntrenoEnElReloj({ compacta = false }) {
  const enCurso = useRelojEnCurso();
  if (!enCurso) return null;
  const hora = new Date(enCurso.desde).toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' });
  return (
    <div
      role="status"
      style={{
        display: 'flex', alignItems: 'center', gap: 12, background: compacta ? LT.surface : KP.blueSoft, borderRadius: compacta ? 16 : 20, padding: compacta ? '13px 14px' : 14,
        fontFamily: FONT, marginBottom: compacta ? 14 : 0, boxShadow: compacta ? '0 1px 2px rgba(17,19,24,0.06), 0 2px 10px rgba(17,19,24,0.07)' : 'none',
      }}
    >
      <span aria-hidden="true" style={{ width: 36, height: 36, borderRadius: 11, background: compacta ? KP.blueSoft : '#fff', color: KP.blue, display: 'grid', placeItems: 'center', flex: 'none' }}><Watch size={18} /></span>
      <span style={{ minWidth: 0 }}>
        <b style={{ display: 'block', fontSize: 15, lineHeight: 1.3, color: KP.ink }}>Entreno en curso en tu reloj</b>
        {/* La hora va sola en su renglón: «7:06 p. m.» ya termina en punto. */}
        <span style={{ display: 'block', fontSize: 13, color: KP.ink2, marginTop: 2, lineHeight: 1.35 }}>{`${enCurso.titulo} · desde las ${hora}`}</span>
        <span style={{ display: 'block', fontSize: 13, color: KP.ink2, lineHeight: 1.35 }}>Termínalo en tu reloj: aquí aparece solo.</span>
      </span>
    </div>
  );
}
