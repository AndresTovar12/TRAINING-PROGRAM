import { useCallback, useEffect, useState } from 'react';
import { Check, Loader2, Plus, UserMinus, Users, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePalabras } from '@/contexts/PalabrasContext';
import { useConfirmacion } from '@/components/Confirmacion';
import {
  nombresDelEquipo, profesionalPorReferencia, agregarAMiEquipo, quitarDeMiEquipo,
  aceptarInvitacionDeEquipo, rechazarInvitacionDeEquipo,
} from '@/lib/api';
import { T, FONT, KP, oficioCorto } from '@/lib/theme';

/* «Mi equipo»: quién atiende a este atleta. Su coach principal (no se quita desde
   aquí) y los profesionales de su equipo, que ÉL decide: acepta o rechaza las
   invitaciones, quita a quien ya no quiere y agrega a alguien con su código o
   @usuario. Quitar no borra nada: esa persona deja de verlo al instante y, si
   la vuelve a agregar, todo regresa. */

const iniciales = (nombre) => {
  const partes = String(nombre ?? '').trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return '?';
  return (partes.length === 1 ? partes[0].slice(0, 2) : partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
};

function Persona({ persona, detalle, children }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, background: T.bg2, border: `1px solid ${T.border}`,
      borderRadius: 14, padding: '11px 13px',
    }}>
      <span style={{
        width: 40, height: 40, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center',
        background: `linear-gradient(140deg, ${KP.blue}, ${KP.blueDk})`, color: '#fff', fontWeight: 800, fontSize: 14,
        overflow: 'hidden',
      }}>
        {persona.avatar_url
          ? <img src={persona.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : iniciales(persona.full_name || persona.username)}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 15, fontWeight: 800, color: T.text, overflowWrap: 'anywhere' }}>
          {persona.full_name || persona.username}
        </span>
        <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: T.text2 }}>
          {[oficioCorto(persona.profesion), detalle].filter(Boolean).join(' · ')}
        </span>
      </span>
      {children}
    </div>
  );
}

const boton = (tono) => ({
  display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontFamily: FONT, fontSize: 13.5,
  fontWeight: 800, borderRadius: 11, padding: '9px 13px', touchAction: 'manipulation',
  border: tono === 'principal' ? 'none' : `1.5px solid ${tono === 'peligro' ? '#F1B7B7' : T.border}`,
  background: tono === 'principal' ? T.accent : T.bg2,
  color: tono === 'principal' ? '#fff' : (tono === 'peligro' ? T.danger : T.text2),
});

export default function MiEquipo() {
  const { user, refreshProfile } = useAuth();
  const { t } = usePalabras();
  const pregunta = useConfirmacion();
  const [equipo, setEquipo] = useState(null); // null = cargando
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(null); // id de quien se está procesando
  const [ref, setRef] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [encontrado, setEncontrado] = useState(null);
  const [aviso, setAviso] = useState('');

  const yo = user?.id;
  const cargar = useCallback(async () => {
    if (!yo) return;
    try {
      setEquipo(await nombresDelEquipo(yo));
    } catch (e) {
      setEquipo([]);
      setError(e.message || 'No se pudo leer tu equipo.');
    }
  }, [yo]);

  useEffect(() => {
    let vivo = true;
    (async () => { if (vivo) await cargar(); })();
    return () => { vivo = false; };
  }, [cargar]);

  const hacer = async (idPersona, accion, mensaje) => {
    setOcupado(idPersona);
    setError('');
    setAviso('');
    try {
      await accion();
      if (mensaje) setAviso(mensaje);
      await cargar();
    } catch (e) {
      setError(e.message || 'No se pudo hacer.');
    } finally {
      setOcupado(null);
    }
  };

  async function quitar(persona) {
    const nombre = persona.full_name || persona.username;
    const va = await pregunta({
      titulo: `¿Quitar a ${nombre} de tu equipo?`,
      detalle: 'Dejará de ver tu plan y cómo vas. No se borra nada: si lo vuelves a agregar, todo regresa.',
      confirmar: 'Sí, quitar',
      peligro: true,
    });
    if (!va) return;
    await hacer(persona.profesional_id, () => quitarDeMiEquipo(persona.profesional_id), `${nombre} ya no está en tu equipo.`);
  }

  async function buscar(e) {
    e.preventDefault();
    const limpio = ref.trim().replace(/^@/, '');
    if (!limpio) return;
    setBuscando(true);
    setError('');
    setAviso('');
    setEncontrado(null);
    try {
      const p = await profesionalPorReferencia(limpio);
      if (!p) setError('No encontramos a nadie con ese código o usuario.');
      else setEncontrado({ ...p, ref: limpio });
    } catch (e2) {
      setError(e2.message || 'No se pudo buscar.');
    } finally {
      setBuscando(false);
    }
  }

  async function agregar() {
    if (!encontrado) return;
    setOcupado('agregando');
    setError('');
    try {
      const r = await agregarAMiEquipo(encontrado.ref);
      const nombre = encontrado.full_name || 'Esa persona';
      setAviso(r?.tipo === 'principal' ? `Listo: ${nombre} ahora es tu coach.` : `Listo: ${nombre} ya está en tu equipo.`);
      setEncontrado(null);
      setRef('');
      if (r?.tipo === 'principal') await refreshProfile?.();
      await cargar();
    } catch (e) {
      setError(e.message || 'No se pudo agregar.');
    } finally {
      setOcupado(null);
    }
  }

  const principal = (equipo ?? []).find((p) => p.es_principal);
  const activos = (equipo ?? []).filter((p) => !p.es_principal && p.estado === 'activo');
  const pendientes = (equipo ?? []).filter((p) => !p.es_principal && p.estado === 'pendiente');

  return (
    <section aria-label="Mi equipo">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <Users size={16} color={T.text3} />
        <span style={{ fontSize: 11, fontWeight: 800, color: T.text3, textTransform: 'uppercase', letterSpacing: 0.6 }}>Mi equipo</span>
      </div>

      {equipo === null ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.text2, fontWeight: 600, fontSize: 14 }}>
          <Loader2 size={15} className="spin" /> Cargando…
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {principal ? (
            <Persona persona={principal} detalle={t('Coach principal')} />
          ) : (
            <div style={{ fontSize: 13.5, color: T.text2, fontWeight: 600 }}>Aún no tienes coach.</div>
          )}

          {pendientes.map((p) => (
            <Persona key={p.profesional_id} persona={p} detalle="quiere atenderte">
              <span style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button type="button" disabled={ocupado === p.profesional_id} style={boton('principal')}
                  onClick={() => hacer(p.profesional_id, () => aceptarInvitacionDeEquipo(p.profesional_id), `${p.full_name || 'Esa persona'} ya está en tu equipo.`)}>
                  <Check size={15} /> Aceptar
                </button>
                <button type="button" disabled={ocupado === p.profesional_id} style={boton()} aria-label={`Rechazar a ${p.full_name || p.username}`}
                  onClick={() => hacer(p.profesional_id, () => rechazarInvitacionDeEquipo(p.profesional_id))}>
                  <X size={15} />
                </button>
              </span>
            </Persona>
          ))}

          {activos.map((p) => (
            <Persona key={p.profesional_id} persona={p} detalle={p.alta_en ? 'te dio de alta' : null}>
              <button type="button" disabled={ocupado === p.profesional_id} style={boton('peligro')} onClick={() => quitar(p)}>
                <UserMinus size={15} /> Quitar
              </button>
            </Persona>
          ))}

          {/* Agregar: blanco, borde sólido y azul (el estilo de «agregar» de la app). */}
          <form onSubmit={buscar} style={{ marginTop: 6 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: T.text2, marginBottom: 7, lineHeight: 1.45 }}>
              ¿Alguien más te atiende (un fisio, por ejemplo)? Escribe su código o @usuario.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={ref}
                onChange={(e) => { setRef(e.target.value); setEncontrado(null); setError(''); }}
                placeholder="Código o @usuario"
                aria-label="Código o usuario"
                autoCapitalize="none"
                spellCheck={false}
                style={{
                  flex: 1, minWidth: 0, border: `1.5px solid ${T.border}`, borderRadius: 12, padding: '12px 13px',
                  fontFamily: FONT, fontSize: 16, fontWeight: 500, color: T.text, background: T.bg2, outline: 'none',
                }}
              />
              <button
                type="submit"
                disabled={buscando || !ref.trim()}
                className="kp-press"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontFamily: FONT,
                  fontSize: 14, fontWeight: 800, borderRadius: 12, padding: '0 16px',
                  border: `1.5px solid ${T.accent}`, background: T.bg2, color: T.accent,
                  opacity: buscando || !ref.trim() ? 0.55 : 1,
                }}
              >
                {buscando ? <Loader2 size={15} className="spin" /> : <Plus size={16} />} Buscar
              </button>
            </div>
          </form>

          {encontrado && (
            <div style={{ background: T.accentBg, borderRadius: 14, padding: 13 }}>
              <div style={{ fontSize: 14.5, fontWeight: 800, color: T.text, overflowWrap: 'anywhere' }}>
                {encontrado.full_name} {encontrado.profesion ? <span style={{ fontWeight: 600, color: T.text2 }}>· {oficioCorto(encontrado.profesion)}</span> : null}
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.text2, marginTop: 4, lineHeight: 1.45 }}>
                Podrá ver tu plan de entrenamiento y cómo vas. Tú decides: puedes quitarlo cuando quieras.
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button type="button" onClick={agregar} disabled={ocupado === 'agregando'} style={boton('principal')}>
                  {ocupado === 'agregando' ? <Loader2 size={15} className="spin" /> : <Check size={15} />} Agregar a mi equipo
                </button>
                <button type="button" onClick={() => setEncontrado(null)} style={boton()}>Cancelar</button>
              </div>
            </div>
          )}

          {aviso && <div role="status" style={{ fontSize: 13.5, fontWeight: 700, color: '#00805A' }}>{aviso}</div>}
          {error && <div role="alert" style={{ fontSize: 13.5, fontWeight: 700, color: T.danger }}>{error}</div>}
        </div>
      )}
    </section>
  );
}
