import { Dumbbell, MessageCircle, Share, Star, Video } from 'lucide-react';
import { FONT, KP, UI, oficioCorto } from '@/lib/theme';
import { nombreDeDeporte } from '@/lib/explorar';
import { EQUIPOS } from '@/lib/paraQuien';
import { ligaPublica } from '@/lib/vitrinaDatos';
import { Pastilla } from '@/components/ui';

/* LO QUE COMPARTEN la página del coach, la del plan, Explorar y el pago (encargo «Compra y dinero», 26 nov 2026). En la app y en la web se ven igual; lo único que cambia
   es el botón de compra (ver `PaginaDelPlan`). */

export const pesosMXN = (n) => `$${Number(n ?? 0).toLocaleString('es-MX')} MXN`;
/** «pago único» · «al mes». */
export const textoDeCobro = (tipo) => (tipo === 'membresia' ? 'al mes' : 'pago único');
/** «$500 MXN · pago único» · «$500 MXN al mes». */
export const precioCompleto = (plan) => (plan.tipo === 'membresia' ? `${pesosMXN(plan.precio)} al mes` : `${pesosMXN(plan.precio)} · pago único`);
export const primerNombre = (nombre) => String(nombre ?? '').trim().split(/\s+/)[0] || 'tu coach';

/** «Coach de Fuerza y Hyrox»: su oficio y sus disciplinas (salen solas de Mi perfil). */
export function oficioConDisciplinas(coach) {
  const oficio = oficioCorto(coach?.profesion) || 'Coach';
  const d = (coach?.disciplinas ?? []).slice(0, 3).map(nombreDeDeporte);
  return d.length ? `${oficio} de ${d.length > 1 ? `${d.slice(0, -1).join(', ')} y ${d[d.length - 1]}` : d[0]}` : oficio;
}
export const especialidad = (coach) => {
  const d = (coach?.disciplinas ?? []).slice(0, 3).map(nombreDeDeporte);
  return d.length > 1 ? `${d.slice(0, -1).join(', ')} y ${d[d.length - 1]}` : d[0] ?? null;
};

/** Qué incluye: chat, técnica o, sin los dos, «Entrenas por tu cuenta». */
export function loQueIncluye(plan, nombreCoach) {
  const xs = [];
  if (plan.chat) xs.push({ id: 'chat', Icono: MessageCircle, texto: `Chat con ${primerNombre(nombreCoach)}`, detalle: 'Te contesta en la app' });
  if (plan.tecnica) xs.push({ id: 'tecnica', Icono: Video, texto: 'Revisión de técnica', detalle: 'Mandas tu video y te corrige' });
  if (!xs.length) xs.push({ id: 'solo', Icono: Dumbbell, texto: 'Entrenas por tu cuenta', detalle: 'Con el plan completo en la app', gris: true });
  return xs;
}

/** Las chips chiquitas de una tarjeta («Chat con Carlos», «Revisión de técnica»). */
export function IncluyeEnLinea({ plan, nombreCoach }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px' }}>
      {loQueIncluye(plan, nombreCoach).map(({ id, Icono, texto, gris }) => (
        <span key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14.5, fontWeight: 600, color: gris ? KP.ink2 : KP.ink }}>
          <span style={{ width: 28, height: 28, borderRadius: 9, background: gris ? UI.relleno : KP.blueSoft, color: gris ? KP.ink2 : KP.blue, display: 'grid', placeItems: 'center' }}><Icono size={15} /></span>
          {texto}
        </span>
      ))}
    </div>
  );
}

/** «★ Empieza aquí»: la pastilla del plan recomendado (azul, nunca negra). */
export const EmpiezaAqui = () => (
  <Pastilla tono="azul"><Star size={11} fill="currentColor" style={{ marginRight: 4 }} />Empieza aquí</Pastilla>
);

/** Cuántos días de entrenamiento trae una semana típica: lo más común entre las semanas de la hoja (dos sesiones el mismo día son un día). */
export function diasPorSemana(hoja) {
  const cuentas = new Map();
  (hoja ?? []).forEach((f) => (f.weekData ?? []).forEach((w) => {
    const n = new Set((w.days ?? []).filter((d) => d.cat !== 'off').map((d) => d.day)).size;
    cuentas.set(n, (cuentas.get(n) ?? 0) + 1);
  }));
  let mejor = 0;
  let veces = 0;
  cuentas.forEach((v, n) => { if (v > veces && n > 0) { mejor = n; veces = v; } });
  return mejor;
}

/** Las chips de la página del plan: «12 semanas · 4 días por semana · Gym». */
export function chipsDelPlan(plan, total) {
  const xs = [];
  if (total > 0 && plan.kind !== 'weekly') xs.push(`${total} ${total === 1 ? 'semana' : 'semanas'}`);
  const dias = diasPorSemana(plan.hoja);
  if (dias > 0) xs.push(`${dias} ${dias === 1 ? 'día' : 'días'} por semana`);
  (plan.equipo ?? []).slice(0, 1).forEach((id) => { const e = EQUIPOS.find((x) => x.id === id); if (e) xs.push(e.id === 'gym' ? 'Gym' : e.nombre); });
  return xs;
}

/** Compartir la página: el menú de compartir del teléfono (también en la app); si no hay, copia la liga https. Devuelve 'copiada' si la copió. */
export async function compartirPagina(titulo, usuario, slug = '') {
  const url = ligaPublica(usuario, slug);
  try {
    if (navigator.share) { await navigator.share({ title: titulo, url }); return null; }
    await navigator.clipboard.writeText(url);
    return 'copiada';
  } catch { return null; }
}

export function BotonCompartir({ titulo, usuario, slug, claro = false }) {
  return (
    <button
      type="button" aria-label="Compartir" onClick={() => compartirPagina(titulo, usuario, slug)} className="kp-press"
      style={{ width: 44, height: 44, borderRadius: 14, border: 'none', cursor: 'pointer', display: 'grid', placeItems: 'center', background: claro ? 'rgba(255,255,255,0.88)' : UI.relleno, color: KP.ink, fontFamily: FONT }}
    >
      <Share size={19} />
    </button>
  );
}
