import { useEffect, useState } from 'react';
import { Check, Loader2, Plus, Trash2 } from 'lucide-react';
import { T, KP, FONT } from '@/lib/theme';
import { botonBlanco, botonPrincipal, campo, etiquetaChica } from '@/features/misplanes/estilos';
import { useConfirmacion } from '@/components/Confirmacion';
import { ajustesDeMonetizacion, borraPaquete, guardaAjuste, guardaPaquete, todosLosPaquetes } from '@/lib/lugaresApi';

/* MONETIZACIÓN (14 oct 2026), solo para el dueño: lo que antes se movía a mano en la base.
   - Cuántos atletas gratis recibe cada profesional nuevo (a los que el dueño no les fijó otro tope).
   - Los paquetes de lugares que se pueden comprar cuando se llena ese tope.
   - Si las ventas están abiertas. */

const tarjeta = { background: T.bg2, border: `1.5px solid ${T.border}`, borderRadius: 16, padding: '16px 16px 18px' };
const titulo = { fontSize: 15, fontWeight: 800, color: T.text, marginBottom: 12 };

function Aviso({ texto }) {
  return texto ? (
    <div style={{ marginTop: 10, background: 'rgba(220,38,38,0.08)', color: T.danger, borderRadius: 11, padding: '10px 12px', fontSize: 12.5, fontWeight: 700 }}>{texto}</div>
  ) : null;
}

function AtletasGratis({ valor, onGuardado }) {
  const [texto, setTexto] = useState(String(valor));
  const [ocupado, setOcupado] = useState(false);
  const [hecho, setHecho] = useState(false);
  const [err, setErr] = useState('');
  const n = Number(texto);
  const valido = Number.isInteger(n) && n >= 0;

  async function guarda() {
    setOcupado(true);
    setErr('');
    try {
      await guardaAjuste('atletas_gratis', n);
      onGuardado?.(n);
      setHecho(true);
      setTimeout(() => setHecho(false), 1800);
    } catch (e) {
      setErr(e.message || 'No se pudo guardar.');
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div style={tarjeta}>
      <div style={titulo}>Atletas gratis por profesional nuevo</div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <input aria-label="Atletas gratis" inputMode="numeric" value={texto} onChange={(e) => setTexto(e.target.value)} style={{ ...campo, maxWidth: 110, fontSize: 16 }} />
        <button type="button" onClick={guarda} disabled={!valido || n === valor || ocupado} style={botonPrincipal(!valido || n === valor || ocupado)}>
          {ocupado ? <Loader2 size={16} className="spin" /> : hecho ? <Check size={16} strokeWidth={3} /> : null}
          {hecho ? 'Guardado' : 'Guardar'}
        </button>
      </div>
      <Aviso texto={err} />
    </div>
  );
}

function FilaDePaquete({ paquete, onCambiado, onBorrado }) {
  const pregunta = useConfirmacion();
  const [nombre, setNombre] = useState(paquete.nombre);
  const [atletas, setAtletas] = useState(String(paquete.atletas_total));
  const [precio, setPrecio] = useState(String(paquete.precio_mxn));
  const [activo, setActivo] = useState(paquete.activo !== false);
  const [ocupado, setOcupado] = useState(false);
  const [err, setErr] = useState('');
  const sucio = nombre !== paquete.nombre || Number(atletas) !== paquete.atletas_total || Number(precio) !== Number(paquete.precio_mxn) || activo !== (paquete.activo !== false);

  async function guarda() {
    setOcupado(true);
    setErr('');
    try {
      onCambiado(await guardaPaquete({ ...paquete, nombre, atletas_total: atletas, precio_mxn: precio, activo }));
    } catch (e) {
      setErr(e.message || 'No se pudo guardar.');
    } finally {
      setOcupado(false);
    }
  }

  async function borra() {
    if (!(await pregunta({ titulo: `¿Borrar «${paquete.nombre}»?`, detalle: 'Deja de ofrecerse. Quien ya lo compró no se afecta.', confirmar: 'Sí, borrar', peligro: true }))) return;
    setOcupado(true);
    try {
      await borraPaquete(paquete.id);
      onBorrado(paquete.id);
    } catch (e) {
      setErr(e.message || 'No se pudo borrar.');
      setOcupado(false);
    }
  }

  return (
    <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 12, marginTop: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
        <label><span style={etiquetaChica}>Nombre</span><input value={nombre} onChange={(e) => setNombre(e.target.value)} style={{ ...campo, fontSize: 16, marginTop: 4 }} /></label>
        <label><span style={etiquetaChica}>Atletas en total</span><input inputMode="numeric" value={atletas} onChange={(e) => setAtletas(e.target.value)} style={{ ...campo, fontSize: 16, marginTop: 4 }} /></label>
        <label><span style={etiquetaChica}>Pesos al mes</span><input inputMode="decimal" value={precio} onChange={(e) => setPrecio(e.target.value)} style={{ ...campo, fontSize: 16, marginTop: 4 }} /></label>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
        <button
          type="button" role="switch" aria-checked={activo} onClick={() => setActivo(!activo)}
          style={{ ...botonBlanco(activo), minHeight: 40 }}
        >
          {activo ? 'Se ofrece' : 'Apagado'}
        </button>
        <button type="button" onClick={guarda} disabled={!sucio || ocupado} style={{ ...botonPrincipal(!sucio || ocupado), minHeight: 40 }}>
          {ocupado ? <Loader2 size={16} className="spin" /> : null} Guardar
        </button>
        <button type="button" onClick={borra} disabled={ocupado} aria-label={`Borrar ${paquete.nombre}`} style={{ ...botonBlanco(false), minHeight: 40, color: T.danger }}>
          <Trash2 size={16} />
        </button>
      </div>
      <Aviso texto={err} />
    </div>
  );
}

export default function Monetizacion() {
  const [ajustes, setAjustes] = useState(null);
  const [paquetes, setPaquetes] = useState(null);
  const [err, setErr] = useState('');
  const [creando, setCreando] = useState(false);
  const [cambiandoVentas, setCambiandoVentas] = useState(false);
  const pregunta = useConfirmacion();

  useEffect(() => {
    let vivo = true;
    Promise.all([ajustesDeMonetizacion(), todosLosPaquetes()])
      .then(([a, p]) => { if (vivo) { setAjustes(a); setPaquetes(p); } })
      .catch((e) => { if (vivo) setErr(e.message || 'No se pudo leer.'); });
    return () => { vivo = false; };
  }, []);

  async function nuevoPaquete() {
    setCreando(true);
    setErr('');
    try {
      const mayor = Math.max(0, ...(paquetes ?? []).map((p) => p.atletas_total));
      const p = await guardaPaquete({ nombre: `Hasta ${mayor + 25} atletas`, atletas_total: mayor + 25, precio_mxn: 0, activo: false, orden: (paquetes ?? []).length + 1 });
      setPaquetes((prev) => [...(prev ?? []), p]);
    } catch (e) {
      setErr(e.message || 'No se pudo crear.');
    } finally {
      setCreando(false);
    }
  }

  async function cambiaVentas() {
    const abrir = !ajustes.ventas_abiertas;
    const va = await pregunta({
      titulo: abrir ? '¿Abrir las ventas?' : '¿Cerrar las ventas?',
      detalle: abrir
        ? 'Los profesionales con depósitos conectados empiezan a vender y aparecen en Explorar. Los demás tienen que conectar su cuenta para publicar.'
        : 'Se deja de vender y de cobrar. Lo ya comprado sigue funcionando.',
      confirmar: abrir ? 'Sí, abrir' : 'Sí, cerrar',
      peligro: !abrir,
    });
    if (!va) return;
    setCambiandoVentas(true);
    setErr('');
    try {
      await guardaAjuste('ventas_abiertas', abrir);
      setAjustes((a) => ({ ...a, ventas_abiertas: abrir }));
    } catch (e) {
      setErr(e.message || 'No se pudo cambiar.');
    } finally {
      setCambiandoVentas(false);
    }
  }

  if (!ajustes || !paquetes) {
    return <div style={{ padding: 24, display: 'grid', placeItems: 'center' }}>{err ? <Aviso texto={err} /> : <Loader2 size={22} className="spin" color={T.text2} />}</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 640, fontFamily: FONT }}>
      <AtletasGratis key={ajustes.atletas_gratis} valor={ajustes.atletas_gratis} onGuardado={(n) => setAjustes((a) => ({ ...a, atletas_gratis: n }))} />

      <div style={tarjeta}>
        <div style={{ ...titulo, marginBottom: 0 }}>Paquetes de lugares</div>
        {paquetes.map((p) => (
          <FilaDePaquete
            key={p.id} paquete={p}
            onCambiado={(f) => setPaquetes((prev) => prev.map((x) => (x.id === f.id ? f : x)))}
            onBorrado={(id) => setPaquetes((prev) => prev.filter((x) => x.id !== id))}
          />
        ))}
        <button type="button" onClick={nuevoPaquete} disabled={creando} style={{ ...botonBlanco(true), marginTop: 14 }}>
          {creando ? <Loader2 size={16} className="spin" /> : <Plus size={16} />} Agregar paquete
        </button>
      </div>

      <div style={tarjeta}>
        <div style={titulo}>Ventas</div>
        <button
          type="button" role="switch" aria-checked={ajustes.ventas_abiertas} onClick={cambiaVentas} disabled={cambiandoVentas}
          style={{ ...botonBlanco(ajustes.ventas_abiertas), color: ajustes.ventas_abiertas ? KP.mint : T.text2, borderColor: ajustes.ventas_abiertas ? KP.mint : T.border }}
        >
          {cambiandoVentas ? <Loader2 size={16} className="spin" /> : null}
          {ajustes.ventas_abiertas ? 'Ventas abiertas' : 'Ventas cerradas'}
        </button>
      </div>

      <Aviso texto={err} />
    </div>
  );
}
