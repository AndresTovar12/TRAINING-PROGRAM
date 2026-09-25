import { useCallback, useEffect, useState } from 'react';
import { RotateCcw, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getActivePlan } from '@/lib/api';
import { useConfirmacion } from '@/components/Confirmacion';
import { T, FONT, KP } from '@/lib/theme';

/**
 * Cambios del plan, y cómo deshacerlos.
 *
 * Andrés, 25 sep 2026: cuando la IA de un coach cambie un plan, "directo, con
 * deshacer". La base guarda sola la versión anterior en cada cambio (tabla
 * `plan_versiones`, disparador `plans_guardar_version`), venga de la app o de
 * una IA. Aquí se ven y se regresa a cualquiera.
 *
 * Dos piezas:
 *   el aviso — arriba y a la vista, SOLO si lo último fue de una IA y es de
 *              los últimos días: "Claude cambió este plan · Deshacer".
 *   la lista — plegada, con todas las versiones recientes.
 *
 * Regresar también guarda versión: si alguien se equivoca de versión, se
 * rehace desde la misma lista.
 */

const DIAS_DEL_AVISO = 3;

function hace(fecha, ahora) {
  const min = Math.round((ahora - new Date(fecha).getTime()) / 60000);
  if (min < 1) return 'hace un momento';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? 'ayer' : `hace ${d} días`;
}

export default function CambiosDelPlan({ atleta, plan, onCambio, Seccion, abierta, onToggle }) {
  const pregunta = useConfirmacion();
  const [versiones, setVersiones] = useState([]);
  const [nombres, setNombres] = useState({});
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState('');
  // La hora se toma al cargar, no en cada dibujo: dibujar tiene que dar lo
  // mismo cada vez. "hace 5 min" se pone al día al volver a cargar la lista.
  const [ahora, setAhora] = useState(() => Date.now());

  const cargar = useCallback(async () => {
    const { data } = await supabase
      .from('plan_versiones')
      .select('id, title, creada_en, cambiada_por, cliente_ia, motivo')
      .eq('user_id', atleta.id)
      .order('creada_en', { ascending: false })
      .limit(15);
    const filas = data ?? [];
    const ids = [...new Set(filas.map((v) => v.cambiada_por).filter(Boolean))];
    let gente = {};
    if (ids.length) {
      const { data: perfiles } = await supabase.from('profiles').select('id, full_name, username').in('id', ids);
      gente = Object.fromEntries((perfiles ?? []).map((p) => [p.id, p.full_name || p.username]));
    }
    return { filas, gente };
  }, [atleta.id]);

  useEffect(() => {
    let vivo = true;
    cargar().then(({ filas, gente }) => {
      if (!vivo) return;
      setVersiones(filas);
      setNombres(gente);
      setAhora(Date.now());
    });
    return () => { vivo = false; };
  }, [cargar, plan?.updated_at]);

  const quien = (v) => {
    const persona = nombres[v.cambiada_por] || 'alguien';
    return v.cliente_ia ? `${v.cliente_ia} (IA de ${persona})` : persona;
  };

  async function regresar(v) {
    const va = await pregunta({
      titulo: '¿Regresar el plan a esta versión?',
      detalle: `Queda como estaba antes del cambio de ${quien(v)}, ${hace(v.creada_en, ahora)}. Lo de ahora también se guarda: si te equivocas, lo regresas igual.`,
      confirmar: 'Sí, regresarlo',
    });
    if (!va) return;
    setTrabajando(true);
    setError('');
    const { error: err } = await supabase.rpc('regresar_plan_a_version', { p_version: v.id });
    if (err) {
      setError(err.message);
      setTrabajando(false);
      return;
    }
    const nuevo = await getActivePlan(atleta.id).catch(() => null);
    onCambio?.(nuevo);
    const { filas, gente } = await cargar();
    setVersiones(filas);
    setNombres(gente);
    setAhora(Date.now());
    setTrabajando(false);
  }

  const ultima = versiones[0];
  const avisoIA = ultima && ultima.cliente_ia && ultima.motivo !== 'restauracion'
    && ahora - new Date(ultima.creada_en).getTime() < DIAS_DEL_AVISO * 86400000;
  const planBorrado = !plan && ultima?.motivo === 'borrado';

  if (!versiones.length) return null;

  const boton = {
    display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 36, padding: '0 13px', borderRadius: 10,
    border: 'none', cursor: trabajando ? 'default' : 'pointer', fontFamily: FONT, fontSize: 13, fontWeight: 800,
    opacity: trabajando ? 0.6 : 1, flexShrink: 0,
  };

  return (
    <>
      {(avisoIA || planBorrado) && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, background: KP.violetSoft, borderRadius: 14,
          padding: '11px 12px 11px 14px', margin: '0 0 12px',
        }}>
          <Sparkles size={17} color={KP.violet} style={{ flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 700, color: T.text, lineHeight: 1.4 }}>
            {planBorrado
              ? `${quien(ultima)} borró el plan ${hace(ultima.creada_en, ahora)}.`
              : `${ultima.cliente_ia} cambió este plan ${hace(ultima.creada_en, ahora)}.`}
          </div>
          <button type="button" disabled={trabajando} onClick={() => regresar(ultima)} style={{ ...boton, background: KP.violet, color: '#fff' }}>
            <RotateCcw size={14} /> {planBorrado ? 'Recuperar' : 'Deshacer'}
          </button>
        </div>
      )}

      <Seccion titulo="Cambios del plan" abierta={abierta} onToggle={onToggle}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {versiones.map((v) => (
            <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: `1px solid ${T.border}` }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: T.text }}>
                  {v.motivo === 'borrado' ? 'Antes de borrarlo' : v.motivo === 'restauracion' ? 'Antes de regresar a otra versión' : 'Antes de un cambio'}
                </div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: T.text3 }}>
                  {quien(v)} · {hace(v.creada_en, ahora)}
                </div>
              </div>
              <button type="button" disabled={trabajando} onClick={() => regresar(v)} style={{ ...boton, background: T.bg2, color: T.text2, border: `1px solid ${T.border}` }}>
                <RotateCcw size={14} /> Regresar
              </button>
            </div>
          ))}
        </div>
        {error && <div style={{ color: T.danger, fontSize: 13, fontWeight: 700, marginTop: 10 }}>{error}</div>}
      </Seccion>
    </>
  );
}
