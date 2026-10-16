import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, Eye, FlaskConical, KeyRound, Loader2, Plus, Trash2 } from 'lucide-react';
import { T, KP, FONT } from '@/lib/theme';
import { botonBlanco, botonPrincipal, campo, etiquetaChica } from '@/features/misplanes/estilos';
import { useConfirmacion } from '@/components/Confirmacion';
import { listCoaches } from '@/lib/api';
import { TIPOS_DE_PRUEBA } from '@/lib/cuentasDePrueba';
import { borraCuentaDePrueba, creaCuentaDePrueba, listaCuentasDePrueba, restableceContrasena } from '@/lib/cuentasDePruebaApi';
import { useEnBanda } from '@/components/ui';

/* CUENTAS DE PRUEBA (14 oct 2026), solo para el dueño.

   Andrés: «para comprobar varias cosas necesito hacer cuentas de prueba, las borro, me olvido de la contraseña… que en mi panel yo pueda ver las contraseñas».
   Las contraseñas de PERSONAS REALES no se pueden leer (la base las guarda cifradas en un solo sentido) y no deben poder: quien entrara a la cuenta del dueño vería la de todos.
   Aquí viven las cuentas de PRUEBA (usuario `zz_…`): se crean con un clic, enseñan su contraseña, se copian y se borran. «Ver como» entra a verlas sin escribir nada. */

const chip = (activa) => ({
  minHeight: 40, padding: '0 16px', borderRadius: 999, cursor: 'pointer', fontFamily: FONT, fontSize: 14, fontWeight: 800,
  border: `1.5px solid ${activa ? T.accent : T.border}`, background: activa ? T.accentBg : T.bg2, color: activa ? T.accent : T.text2,
});

function Copiar({ texto, etiqueta }) {
  const [listo, setListo] = useState(false);
  const copia = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      setListo(true);
      setTimeout(() => setListo(false), 1500);
    } catch { /* sin permiso: se puede seleccionar a mano */ }
  };
  return (
    <button
      type="button" onClick={copia} aria-label={`Copiar ${etiqueta}`}
      style={{ width: 40, height: 40, borderRadius: 11, border: `1.5px solid ${T.border}`, background: T.bg2, color: listo ? KP.mint : T.text2, cursor: 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0 }}
    >
      {listo ? <Check size={16} strokeWidth={3} /> : <Copy size={16} />}
    </button>
  );
}

const Dato = ({ etiqueta, children, copia }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={etiquetaChica}>{etiqueta}</div>
      <div style={{ marginTop: 2 }}>{children}</div>
    </div>
    {copia && <Copiar texto={copia} etiqueta={etiqueta.toLowerCase()} />}
  </div>
);

function Fila({ cuenta, nueva, ocupado, onVerComo, onNuevaClave, onBorrar }) {
  const nombre = cuenta.full_name || cuenta.username;
  return (
    <div style={{ background: KP.surface, borderRadius: 20, boxShadow: '0 1px 2px rgba(17,19,24,0.04)', padding: 16, display: 'flex', flexDirection: 'column', gap: 12, outline: nueva ? `2px solid ${KP.mint}` : 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 16.5, fontWeight: 800, color: T.text, overflowWrap: 'anywhere' }}>{nombre}</div>
        <span style={{ padding: '3px 10px', borderRadius: 999, background: T.accentBg, color: T.accent, fontSize: 12, fontWeight: 800 }}>
          {TIPOS_DE_PRUEBA.find((t) => t.id === cuenta.tipo)?.nombre ?? cuenta.tipo}
        </span>
        {cuenta.is_active === false && <span style={{ padding: '3px 10px', borderRadius: 999, background: T.bg3, color: T.text2, fontSize: 12, fontWeight: 800 }}>Desactivada</span>}
        {nueva && <span style={{ padding: '3px 10px', borderRadius: 999, background: KP.mintSoft, color: KP.mint, fontSize: 12, fontWeight: 800 }}>Recién creada</span>}
      </div>
      <Dato etiqueta="Usuario" copia={cuenta.username}>
        <span style={{ fontSize: 15.5, fontWeight: 700, color: T.text, fontFamily: 'ui-monospace, Menlo, monospace', overflowWrap: 'anywhere' }}>{cuenta.username}</span>
      </Dato>
      <Dato etiqueta="Contraseña" copia={cuenta.contrasena ?? undefined}>
        {cuenta.contrasena
          ? <span style={{ fontSize: 15.5, fontWeight: 700, color: T.text, fontFamily: 'ui-monospace, Menlo, monospace', letterSpacing: 0.3, overflowWrap: 'anywhere', userSelect: 'all' }}>{cuenta.contrasena}</span>
          : <span style={{ fontSize: 14, fontWeight: 600, color: T.text3 }}>Nadie la guardó. Ponle una nueva.</span>}
      </Dato>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" onClick={() => onVerComo(cuenta)} disabled={ocupado} style={{ ...botonBlanco(true, ocupado), minHeight: 40 }}><Eye size={15} /> Ver como</button>
        <button type="button" onClick={() => onNuevaClave(cuenta)} disabled={ocupado} style={{ ...botonBlanco(false, ocupado), minHeight: 40 }}>
          {ocupado === 'clave' ? <Loader2 size={15} className="spin" /> : <KeyRound size={15} />} Contraseña nueva
        </button>
        <button
          type="button" onClick={() => onBorrar(cuenta)} disabled={ocupado}
          style={{ ...botonBlanco(false, ocupado), minHeight: 40, border: 'none', background: KP.dangerSoft, color: KP.danger }}
        >
          {ocupado === 'borrar' ? <Loader2 size={15} className="spin" /> : <Trash2 size={15} />} Borrar
        </button>
      </div>
    </div>
  );
}

export default function CuentasDePrueba({ onVerComoCoach, onVerComoAtleta }) {
  const enBanda = useEnBanda();
  const pregunta = useConfirmacion();
  const [cuentas, setCuentas] = useState(null);
  const [coaches, setCoaches] = useState([]);
  const [error, aviso] = useState('');
  const [tipo, setTipo] = useState('atleta');
  const [coach, setCoach] = useState('');
  const [creando, setCreando] = useState(false);
  const [nueva, setNueva] = useState(null);
  const [ocupado, setOcupado] = useState({}); // id → 'clave' | 'borrar'

  const lee = useCallback(async () => {
    try { setCuentas(await listaCuentasDePrueba()); aviso(''); } catch (e) { aviso(e?.message ?? 'No se pudieron leer las cuentas.'); setCuentas((c) => c ?? []); }
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- lectura inicial
  useEffect(() => { lee(); listCoaches().then(setCoaches).catch(() => {}); }, [lee]);

  const crea = async () => {
    setCreando(true);
    aviso('');
    try {
      const c = await creaCuentaDePrueba({ tipo, coach: tipo === 'atleta' ? coach : '', usuariosQueYaHay: (cuentas ?? []).map((x) => x.username) });
      setNueva(c.id);
      await lee();
    } catch (e) {
      aviso(e?.message ?? 'No se pudo crear la cuenta.');
    } finally {
      setCreando(false);
    }
  };

  const verComo = (c) => (c.tipo === 'atleta' ? onVerComoAtleta?.(c) : onVerComoCoach?.(c));

  const nuevaClave = async (c) => {
    const va = await pregunta({ titulo: `¿Contraseña nueva para ${c.full_name || c.username}?`, detalle: 'La que tiene ahora deja de servir. La nueva se guarda aquí para que no se te olvide.', confirmar: 'Sí, ponerla' });
    if (!va) return;
    setOcupado((o) => ({ ...o, [c.id]: 'clave' }));
    aviso('');
    try {
      const r = await restableceContrasena(c.id);
      setCuentas((lista) => (lista ?? []).map((x) => (x.id === c.id ? { ...x, contrasena: r.contrasena } : x)));
    } catch (e) {
      aviso(e?.message ?? 'No se pudo poner la contraseña.');
    } finally {
      setOcupado((o) => { const n = { ...o }; delete n[c.id]; return n; });
    }
  };

  const borra = async (c) => {
    const va = await pregunta({
      titulo: `¿Borrar a ${c.full_name || c.username}?`,
      detalle: 'Se borra la cuenta, su plan, sus entrenos y su contraseña guardada. No se puede deshacer.',
      confirmar: 'Sí, borrar', peligro: true,
    });
    if (!va) return;
    setOcupado((o) => ({ ...o, [c.id]: 'borrar' }));
    aviso('');
    try {
      await borraCuentaDePrueba(c);
      setCuentas((lista) => (lista ?? []).filter((x) => x.id !== c.id));
    } catch (e) {
      aviso(e?.message ?? 'No se pudo borrar.');
    } finally {
      setOcupado((o) => { const n = { ...o }; delete n[c.id]; return n; });
    }
  };

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 44, height: 44, borderRadius: 14, background: T.accentBg, color: T.accent, display: 'grid', placeItems: 'center' }}><FlaskConical size={22} /></div>
        <div>
          {!enBanda && <div style={{ fontSize: 22, fontWeight: 800, color: T.text, letterSpacing: -0.3 }}>Cuentas de prueba</div>}
          <div style={{ fontSize: 13.5, fontWeight: 600, color: T.text2, marginTop: 2 }}>Solo estas muestran su contraseña. Las de personas reales nunca se pueden ver.</div>
        </div>
      </div>

      <div style={{ background: KP.surface, borderRadius: 20, boxShadow: '0 1px 2px rgba(17,19,24,0.04)', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={etiquetaChica}>Crear una cuenta de prueba</div>
        <div role="radiogroup" aria-label="Tipo de cuenta" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {TIPOS_DE_PRUEBA.map((t) => (
            <button key={t.id} type="button" role="radio" aria-checked={tipo === t.id} onClick={() => setTipo(t.id)} style={chip(tipo === t.id)}>{t.nombre}</button>
          ))}
        </div>
        {tipo === 'atleta' && (
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={etiquetaChica}>Con qué coach</span>
            <select value={coach} onChange={(e) => setCoach(e.target.value)} style={{ ...campo, minHeight: 46 }}>
              <option value="">Sin coach</option>
              {coaches.map((c) => <option key={c.id} value={c.username}>{c.full_name || c.username} (@{c.username})</option>)}
            </select>
          </label>
        )}
        <button type="button" onClick={crea} disabled={creando} style={{ ...botonPrincipal(creando), minHeight: 48, justifyContent: 'center' }}>
          {creando ? <Loader2 size={17} className="spin" /> : <Plus size={17} strokeWidth={3} />} Crear cuenta
        </button>
      </div>

      {error && <div role="alert" style={{ padding: '10px 14px', borderRadius: 12, background: KP.dangerSoft, color: KP.danger, fontSize: 13.5, fontWeight: 700, overflowWrap: 'anywhere' }}>{error}</div>}

      {cuentas === null
        ? <div role="status" style={{ display: 'flex', justifyContent: 'center', padding: 32, color: T.text2 }}><Loader2 size={22} className="spin" /></div>
        : cuentas.length === 0
          ? <div style={{ padding: 24, textAlign: 'center', fontSize: 14.5, fontWeight: 600, color: T.text2 }}>Todavía no tienes cuentas de prueba.</div>
          : cuentas.map((c) => <Fila key={c.id} cuenta={c} nueva={nueva === c.id} ocupado={ocupado[c.id]} onVerComo={verComo} onNuevaClave={nuevaClave} onBorrar={borra} />)}
    </div>
  );
}
