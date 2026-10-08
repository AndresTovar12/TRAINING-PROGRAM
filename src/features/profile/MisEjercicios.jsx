import { useEffect, useState } from 'react';
import { Check, Loader2, RotateCcw, Trash2, Video } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useConfirmacion } from '@/components/Confirmacion';
import { borrarMiRepertorio, borrarTodasMisVersiones, contarMiRepertorio } from '@/lib/api';
import { plural } from '@/lib/plural';
import { T, FONT, KP } from '@/lib/theme';

/**
 * «Mis ejercicios», en Mi perfil: lo que el inicio promete que siempre se puede (Andrés, 8 oct 2026: «siempre va a poder
 * borrar todo, crear su propia versión de todo, regresar a la versión original de la app»).
 *
 *   1. Ejercicios de Training Lab: prendidos o apagados. Apagados, el coach solo ve lo suyo; nada se borra.
 *   2. Volver al original: se borran TODAS sus versiones de los ejercicios de Training Lab.
 *   3. Borrar todo lo mío: sus ejercicios (con videos), categorías, grupos musculares y tipos de sesión. Para siempre.
 *
 * Los dos borrados preguntan con números («¿Borrar 14 ejercicios…?»), no en abstracto.
 */

const tarjeta = (peligro) => ({
  background: T.bg2, border: `1.5px solid ${peligro ? '#F1B7B7' : T.border}`, borderRadius: 18, padding: '14px 16px',
  display: 'flex', flexDirection: 'column', gap: 10,
});
const cuadro = (fondo, color) => ({
  width: 38, height: 38, borderRadius: 11, display: 'grid', placeItems: 'center', flexShrink: 0, background: fondo, color,
});
const titulo = { fontSize: 15.5, fontWeight: 800, color: T.text };
const texto = { fontSize: 13.5, fontWeight: 500, color: T.text2, lineHeight: 1.45 };
const boton = (tono, apagado) => ({
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, minHeight: 44, padding: '0 16px',
  borderRadius: 12, cursor: apagado ? 'default' : 'pointer', fontFamily: FONT, fontSize: 14, fontWeight: 800,
  touchAction: 'manipulation', opacity: apagado ? 0.5 : 1,
  border: `1.5px solid ${tono === 'peligro' ? '#F1B7B7' : KP.lineHi}`, background: T.bg2,
  color: tono === 'peligro' ? T.danger : T.accent,
});

function Interruptor({ puesto, onChange, ocupado, etiqueta }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={puesto}
      aria-label={etiqueta}
      disabled={ocupado}
      onClick={() => onChange(!puesto)}
      style={{
        width: 52, height: 32, borderRadius: 999, border: 'none', padding: 0, cursor: ocupado ? 'default' : 'pointer', flexShrink: 0,
        background: puesto ? T.accent : KP.lineHi, position: 'relative', transition: 'background .15s', touchAction: 'manipulation',
      }}
    >
      <span style={{
        position: 'absolute', top: 3, left: puesto ? 23 : 3, width: 26, height: 26, borderRadius: '50%', background: '#fff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.25)', transition: 'left .15s', display: 'grid', placeItems: 'center', color: T.accent,
      }}>
        {ocupado ? <Loader2 size={14} className="spin" /> : puesto && <Check size={14} strokeWidth={3} />}
      </span>
    </button>
  );
}

export default function MisEjercicios() {
  const { profile, updateProfile } = useAuth();
  const pregunta = useConfirmacion();
  const [cuentas, setCuentas] = useState(null); // { ejercicios, categorias, grupos, tipos, versiones } | null = cargando
  const [ocupado, setOcupado] = useState(''); // '' | 'base' | 'versiones' | 'todo'
  const [err, setErr] = useState('');
  const [hecho, setHecho] = useState('');

  const recontar = () => contarMiRepertorio().then(setCuentas).catch((e) => setErr(e.message || 'No se pudo cargar'));
  useEffect(() => { recontar(); }, []);

  const avisa = (msg) => { setHecho(msg); setTimeout(() => setHecho(''), 2600); };

  async function cambiarBase(puesto) {
    setErr(''); setOcupado('base');
    const { error } = await updateProfile({ repertorio_base: puesto });
    setOcupado('');
    if (error) setErr(error.message);
  }

  async function volverAlOriginal() {
    const n = cuentas?.versiones ?? 0;
    const ok = await pregunta({
      titulo: '¿Volver al original?',
      detalle: `Se ${n === 1 ? 'borra tu versión' : `borran tus ${n} versiones`} de ejercicios de Training Lab y vuelven a verse como vienen. Los planes no cambian.`,
      confirmar: 'Sí, volver',
    });
    if (!ok) return;
    setErr(''); setOcupado('versiones');
    try {
      await borrarTodasMisVersiones();
      await recontar();
      avisa('Listo: los ejercicios de Training Lab vuelven a verse como vienen.');
    } catch (e) {
      setErr(e.message || 'No se pudo');
    } finally {
      setOcupado('');
    }
  }

  async function borrarTodo() {
    const c = cuentas || {};
    const partes = [
      c.ejercicios ? `${plural(c.ejercicios, 'ejercicio', 'ejercicios')} con sus videos` : '',
      c.categorias ? plural(c.categorias, 'categoría', 'categorías') : '',
      c.grupos ? plural(c.grupos, 'grupo muscular', 'grupos musculares') : '',
      c.tipos ? plural(c.tipos, 'tipo de sesión', 'tipos de sesión') : '',
    ].filter(Boolean);
    const ok = await pregunta({
      titulo: '¿Borrar todo lo tuyo?',
      detalle: `Se borran para siempre ${partes.join(', ')}. Los planes que ya los usan conservan el nombre del ejercicio, pero sin ficha ni video. Los ejercicios de Training Lab no se tocan.`,
      confirmar: 'Sí, borrar todo',
      peligro: true,
    });
    if (!ok) return;
    setErr(''); setOcupado('todo');
    try {
      await borrarMiRepertorio();
      await recontar();
      avisa('Listo: tu lista quedó vacía.');
    } catch (e) {
      setErr(e.message || 'No se pudo borrar');
    } finally {
      setOcupado('');
    }
  }

  const base = profile?.repertorio_base !== false;
  const c = cuentas || {};
  const hayMio = (c.ejercicios || 0) + (c.categorias || 0) + (c.grupos || 0) + (c.tipos || 0) > 0;
  const resumenMio = cuentas
    ? (hayMio
      ? [plural(c.ejercicios || 0, 'ejercicio', 'ejercicios'), plural(c.categorias || 0, 'categoría', 'categorías'), plural(c.grupos || 0, 'grupo', 'grupos'), plural(c.tipos || 0, 'tipo de sesión', 'tipos de sesión')].join(' · ')
      : 'Todavía no tienes nada tuyo.')
    : 'Contando…';

  return (
    <>
      <div style={tarjeta(false)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={cuadro(KP.blueSoft, KP.blue)}><Video size={19} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={titulo}>Ejercicios de Training Lab</div>
            <div style={texto}>118 ejercicios de gym con video. Apagados, solo ves los tuyos; nada se borra.</div>
          </div>
          <Interruptor puesto={base} onChange={cambiarBase} ocupado={ocupado === 'base'} etiqueta="Ejercicios de Training Lab" />
        </div>
      </div>

      <div style={tarjeta(false)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={cuadro(KP.blueSoft, KP.blue)}><RotateCcw size={19} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={titulo}>Volver al original</div>
            <div style={texto}>
              {cuentas
                ? (c.versiones ? `Cambiaste ${plural(c.versiones, 'ejercicio', 'ejercicios')} de Training Lab a tu manera.` : 'No has cambiado ningún ejercicio de Training Lab.')
                : 'Contando…'}
            </div>
          </div>
        </div>
        <button type="button" onClick={volverAlOriginal} disabled={!c.versiones || !!ocupado} style={boton('normal', !c.versiones || !!ocupado)}>
          {ocupado === 'versiones' ? <Loader2 size={16} className="spin" /> : <RotateCcw size={16} />} Volver al original
        </button>
      </div>

      <div style={tarjeta(true)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={cuadro('rgba(220,38,38,0.08)', T.danger)}><Trash2 size={19} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={titulo}>Borrar todos mis ejercicios</div>
            <div style={texto}>{resumenMio}</div>
          </div>
        </div>
        <button type="button" onClick={borrarTodo} disabled={!hayMio || !!ocupado} style={boton('peligro', !hayMio || !!ocupado)}>
          {ocupado === 'todo' ? <Loader2 size={16} className="spin" /> : <Trash2 size={16} />} Borrar todo lo mío
        </button>
      </div>

      {hecho && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: KP.mintSoft, color: KP.mint, borderRadius: 12, padding: '11px 15px', fontWeight: 700, fontSize: 13.5 }}>
          <Check size={16} strokeWidth={3} /> {hecho}
        </div>
      )}
      {err && (
        <div style={{ background: 'rgba(220,38,38,0.08)', color: T.danger, borderRadius: 12, padding: '11px 15px', fontWeight: 700, fontSize: 13.5 }}>
          {err}
        </div>
      )}
    </>
  );
}
