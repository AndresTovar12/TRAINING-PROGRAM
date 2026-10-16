import { useEffect, useState } from 'react';
import { Check, Loader2, Store } from 'lucide-react';
import { T, FONT, UI } from '@/lib/theme';
import { botonPrincipal, campo, etiquetaChica } from '@/features/misplanes/estilos';
import { useConfirmacion } from '@/components/Confirmacion';
import { guardaPoderes, lugaresDe } from '@/lib/lugaresApi';
import { COMISION_BASE_PORCIENTO, comisionATexto, comisionParaGuardar, etiquetaDeLugares, limiteParaGuardar, modoDeLimite } from '@/lib/limiteDeAtletas';

/* LO QUE SOLO EL DUEÑO PUEDE FIJAR DE UN PROFESIONAL (14 oct 2026), en su ficha:
   cuántos atletas a mano puede tener, qué comisión paga y si su vitrina está suspendida.

   Andrés: «una atleta de la NFL pide más cuentas gratis»: el tope se sube aquí, sin tocar la base a mano.
   El profesional no puede cambiarse nada de esto: la base se lo niega (`guardar_campos_de_poder`). */

const chip = (activo) => ({
  minHeight: 40, padding: '0 14px', borderRadius: 999, cursor: 'pointer', fontFamily: FONT, fontSize: 13.5, fontWeight: 800,
  border: 'none', background: activo ? T.accentBg : UI.relleno, color: activo ? T.accent : T.text2,
});

const fila = { display: 'flex', flexDirection: 'column', gap: 8 };

export default function PoderesDelProfesional({ coach, onCambiado }) {
  const pregunta = useConfirmacion();
  const [modo, setModo] = useState(modoDeLimite(coach.limite_atletas));
  const [numero, setNumero] = useState(coach.limite_atletas > 0 ? String(coach.limite_atletas) : '');
  const [comision, setComision] = useState(comisionATexto(coach.comision_especial));
  const [lugares, setLugares] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [suspendiendo, setSuspendiendo] = useState(false);
  const [err, setErr] = useState('');
  const [guardado, setGuardado] = useState(false);

  const nombre = coach.full_name || coach.username;
  const suspendida = !!coach.vitrina_suspendida;

  useEffect(() => {
    let vivo = true;
    lugaresDe(coach.id).then((l) => { if (vivo) setLugares(l); }).catch(() => { if (vivo) setLugares(null); });
    return () => { vivo = false; };
  }, [coach.id, coach.limite_atletas]);

  const limite = limiteParaGuardar(modo, numero);
  const com = comisionParaGuardar(comision);
  const cambio = !limite.error && !com.error
    && (limite.valor !== (coach.limite_atletas ?? null) || com.valor !== (coach.comision_especial === undefined ? null : coach.comision_especial));

  async function guarda() {
    if (limite.error || com.error) { setErr(limite.error || com.error); return; }
    setGuardando(true);
    setErr('');
    try {
      const fila_ = await guardaPoderes(coach.id, { limite_atletas: limite.valor, comision_especial: com.valor });
      onCambiado?.(fila_);
      setGuardado(true);
      setTimeout(() => setGuardado(false), 1800);
    } catch (e) {
      setErr(e.message || 'No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  }

  async function cambiaVitrina() {
    const va = await pregunta({
      titulo: suspendida ? `¿Reactivar la vitrina de ${nombre}?` : `¿Suspender la vitrina de ${nombre}?`,
      detalle: suspendida
        ? 'Su página y sus planes vuelven a verse y a poder venderse.'
        : 'Su página y sus planes dejan de verse y de venderse, y no puede publicar. No se borra nada; se deshace cuando quieras.',
      confirmar: suspendida ? 'Sí, reactivar' : 'Sí, suspender',
      peligro: !suspendida,
    });
    if (!va) return;
    setSuspendiendo(true);
    setErr('');
    try {
      onCambiado?.(await guardaPoderes(coach.id, { vitrina_suspendida: !suspendida }));
    } catch (e) {
      setErr(e.message || 'No se pudo cambiar.');
    } finally {
      setSuspendiendo(false);
    }
  }

  return (
    <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${T.border}`, fontFamily: FONT }}>
      <div style={{ ...etiquetaChica, marginBottom: 12 }}>Límites y dinero</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={fila}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: T.text }}>Atletas a mano</span>
            {etiquetaDeLugares(lugares) && <span style={{ fontSize: 13, fontWeight: 800, color: T.text2, fontVariantNumeric: 'tabular-nums' }}>{etiquetaDeLugares(lugares)}</span>}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" style={chip(modo === 'fabrica')} onClick={() => setModo('fabrica')}>De fábrica</button>
            <button type="button" style={chip(modo === 'numero')} onClick={() => setModo('numero')}>Otro número</button>
            <button type="button" style={chip(modo === 'sin_tope')} onClick={() => setModo('sin_tope')}>Sin tope</button>
          </div>
          {modo === 'numero' && (
            <input
              aria-label="Cuántos atletas a mano" inputMode="numeric" value={numero} placeholder="Ej. 25"
              onChange={(e) => setNumero(e.target.value)} style={{ ...campo, maxWidth: 140, fontSize: 16 }}
            />
          )}
        </div>

        <div style={fila}>
          <span style={{ fontSize: 14, fontWeight: 800, color: T.text }}>Comisión de la app</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button type="button" style={chip(comision.trim() === '')} onClick={() => setComision('')}>Normal ({COMISION_BASE_PORCIENTO} %)</button>
            <input
              aria-label="Comisión especial en por ciento" inputMode="decimal" value={comision} placeholder="Especial %"
              onChange={(e) => setComision(e.target.value)} style={{ ...campo, maxWidth: 130, fontSize: 16 }}
            />
          </div>
        </div>

        <button type="button" onClick={guarda} disabled={!cambio || guardando} style={{ ...botonPrincipal(!cambio || guardando), alignSelf: 'flex-start' }}>
          {guardando ? <Loader2 size={16} className="spin" /> : guardado ? <Check size={16} strokeWidth={3} /> : null}
          {guardado ? 'Guardado' : 'Guardar'}
        </button>

        <button
          type="button" onClick={cambiaVitrina} disabled={suspendiendo}
          style={{
            display: 'flex', alignItems: 'center', gap: 10, minHeight: 48, padding: '0 14px', borderRadius: 13, textAlign: 'left',
            border: 'none', background: suspendida ? 'rgba(245,158,11,0.10)' : UI.relleno,
            cursor: suspendiendo ? 'default' : 'pointer', opacity: suspendiendo ? 0.6 : 1,
            fontFamily: FONT, fontSize: 14, fontWeight: 700, color: suspendida ? T.warning : T.text2,
          }}
        >
          {suspendiendo ? <Loader2 size={16} className="spin" /> : <Store size={16} />}
          <span style={{ flex: 1, minWidth: 0 }}>{suspendida ? 'Vitrina suspendida · Reactivar' : 'Suspender su vitrina'}</span>
        </button>
      </div>

      {err && (
        <div style={{ marginTop: 12, background: 'rgba(220,38,38,0.08)', color: T.danger, borderRadius: 11, padding: '10px 12px', fontSize: 12.5, fontWeight: 700 }}>
          {err}
        </div>
      )}
    </div>
  );
}
