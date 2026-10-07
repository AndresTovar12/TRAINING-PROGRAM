import { useCallback, useEffect, useState } from 'react';
import { RotateCcw, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { planDe } from '@/lib/api';
import { useConfirmacion } from '@/components/Confirmacion';
import BotonEntendido from '@/components/BotonEntendido';
import { useAvisosVistos } from '@/lib/useAvisosVistos';
import { usePalabras } from '@/contexts/PalabrasContext';
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
 *              los últimos días: "Claude cambió este plan · Deshacer". También si
 *              se borró el plan: "… borró el plan · Recuperar". Con su «Entendido»:
 *              se acepta y ese aviso ya no vuelve (uno nuevo, de un cambio nuevo, sí).
 *   la lista — plegada, con las versiones recientes. Cada una lleva su «Entendido»
 *              (Andrés, 7 oct 2026: «todo tipo de esos avisos también tendría un botón de
 *              “entendido” para que no se haga una lista gigante de cambios»): la que ya
 *              viste sale de la lista, con la misma clave del aviso de arriba (`plan:<versión>`),
 *              y queda un «Ver todos» chico para poder regresar a una versión vieja.
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

export default function CambiosDelPlan({ atleta, plan, onCambio, Seccion, abierta, onToggle, profesionalId = null }) {
  const pregunta = useConfirmacion();
  const { t } = usePalabras();
  const { listo: avisosListos, visto: avisoVisto, marcar: aceptarAviso } = useAvisosVistos();
  const [versiones, setVersiones] = useState([]);
  const [nombres, setNombres] = useState({});
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState('');
  // «Ver todos»: trae de vuelta, atenuadas, las versiones que ya se aceptaron.
  const [verTodos, setVerTodos] = useState(false);
  // La hora se toma al cargar, no en cada dibujo: dibujar tiene que dar lo
  // mismo cada vez. "hace 5 min" se pone al día al volver a cargar la lista.
  const [ahora, setAhora] = useState(() => Date.now());

  const cargar = useCallback(async () => {
    // Solo las versiones de ESTE programa (el del coach principal o el de un profesional
    // del equipo): el master ve las de todos y sin este filtro saldrían revueltas.
    // Las sesiones pegadas al programa del coach viven en una fila `draft` del mismo
    // profesional (ver `lib/pegadas.js`): sus versiones no son cambios del programa.
    let consulta = supabase
      .from('plan_versiones')
      .select('id, title, creada_en, cambiada_por, cliente_ia, motivo')
      .eq('user_id', atleta.id)
      .neq('status', 'draft');
    consulta = profesionalId ? consulta.eq('profesional_id', profesionalId) : consulta.is('profesional_id', null);
    const { data } = await consulta
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
  }, [atleta.id, profesionalId]);

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

  // Quién hizo el cambio, o '' si no se sabe. En la lista no se escribe «alguien»: no dice nada.
  const autorDe = (v) => {
    const persona = nombres[v.cambiada_por] || '';
    if (!v.cliente_ia) return persona;
    return persona ? `${v.cliente_ia} (IA de ${persona})` : v.cliente_ia;
  };
  // En una frase sí hace falta alguien que haga la acción.
  const quien = (v) => autorDe(v) || 'alguien';
  const claveDe = (v) => `plan:${v.id}`;

  async function regresar(v) {
    const va = await pregunta({
      titulo: t('¿Regresar el plan a esta versión?'),
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
    const nuevo = await planDe(atleta.id, profesionalId).catch(() => null);
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
  // Cada cambio es un aviso distinto: aceptar este no esconde el que venga después.
  const claveDelAviso = ultima ? claveDe(ultima) : null;
  const hayAviso = (avisoIA || planBorrado) && avisosListos && !avisoVisto(claveDelAviso);

  if (!versiones.length) return null;

  // Hasta saber qué se aceptó no se enseña ninguna fila: una ya aceptada aparecería un instante y se iría.
  const sinAceptar = avisosListos ? versiones.filter((v) => !avisoVisto(claveDe(v))) : [];
  const yaAceptadas = avisosListos ? versiones.length - sinAceptar.length : 0;
  const filas = verTodos ? versiones : sinAceptar;

  const boton = {
    display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 36, padding: '0 13px', borderRadius: 10,
    border: 'none', cursor: trabajando ? 'default' : 'pointer', fontFamily: FONT, fontSize: 13, fontWeight: 800,
    opacity: trabajando ? 0.6 : 1, flexShrink: 0,
  };

  return (
    <>
      {hayAviso && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', background: KP.violetSoft, borderRadius: 14,
          padding: '11px 12px 11px 14px', margin: '0 0 12px',
        }}>
          <Sparkles size={17} color={KP.violet} style={{ flexShrink: 0 }} />
          <div style={{ flex: '1 1 200px', minWidth: 0, fontSize: 13.5, fontWeight: 700, color: T.text, lineHeight: 1.4 }}>
            {planBorrado
              ? `${quien(ultima)} ${t('borró el plan')} ${hace(ultima.creada_en, ahora)}.`
              : `${ultima.cliente_ia} ${t('cambió este plan')} ${hace(ultima.creada_en, ahora)}.`}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginLeft: 'auto' }}>
            <button type="button" disabled={trabajando} onClick={() => regresar(ultima)} style={{ ...boton, background: KP.violet, color: '#fff' }}>
              <RotateCcw size={14} /> {planBorrado ? 'Recuperar' : 'Deshacer'}
            </button>
            <BotonEntendido color={KP.violet} onClick={() => aceptarAviso(claveDelAviso)} />
          </div>
        </div>
      )}

      <Seccion titulo={t('Cambios del plan')} abierta={abierta} onToggle={onToggle}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {avisosListos && filas.length === 0 && (
            <div style={{ fontSize: 13, fontWeight: 600, color: T.text2, padding: '9px 0', borderBottom: `1px solid ${T.border}` }}>
              Nada por revisar.
            </div>
          )}
          {filas.map((v) => {
            const aceptada = avisoVisto(claveDe(v));
            return (
              <div
                key={v.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '9px 0',
                  borderBottom: `1px solid ${T.border}`, opacity: aceptada ? 0.6 : 1,
                }}
              >
                <div style={{ flex: '1 1 150px', minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: T.text }}>
                    {v.motivo === 'borrado' ? 'Antes de borrarlo' : v.motivo === 'restauracion' ? 'Antes de regresar a otra versión' : 'Antes de un cambio'}
                  </div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: T.text3 }}>
                    {[autorDe(v), hace(v.creada_en, ahora)].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <button type="button" disabled={trabajando} onClick={() => regresar(v)} style={{ ...boton, background: T.bg2, color: T.text2, border: `1px solid ${T.border}` }}>
                  <RotateCcw size={14} /> Regresar
                </button>
                {!aceptada && <BotonEntendido color={T.accent} onClick={() => aceptarAviso(claveDe(v))} />}
              </div>
            );
          })}
        </div>
        {yaAceptadas > 0 && (
          <button
            type="button" onClick={() => setVerTodos((x) => !x)}
            style={{
              border: 'none', background: 'none', cursor: 'pointer', fontFamily: FONT, fontSize: 13, fontWeight: 700,
              color: T.accent, padding: '10px 2px 2px',
            }}
          >
            {verTodos ? 'Esconder los que ya vi' : `Ver todos (${versiones.length})`}
          </button>
        )}
        {error && <div style={{ color: T.danger, fontSize: 13, fontWeight: 700, marginTop: 10 }}>{error}</div>}
      </Seccion>
    </>
  );
}
