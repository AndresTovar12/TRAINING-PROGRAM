import { useState } from 'react';
import { Check, Plus, X } from 'lucide-react';
import { T, KP, FONT, UI } from '@/lib/theme';
import { botonBlanco, etiquetaChica } from '@/features/misplanes/estilos';
import { EDADES, edadesValidas, idDeRango, nombreDeEdad, problemaDeRango } from '@/lib/paraQuien';

/* LAS EDADES DE UN PLAN EN VENTA (13 oct 2026, Andrés: «tiene que ser más customizable»).

   Los cuatro rangos de uso común se marcan con un toque; el coach puede escribir los suyos («de 12 a 14», «de 60 en adelante») y salen como una opción más, marcada, que se quita con otro toque.
   Sin marcar nada quiere decir «todas las edades». Los rangos viven como textos `18-30` / `60+` (ver `lib/paraQuien.js`), así que no pide nada nuevo a la base.

   `valor`: los ids marcados. `alCambiar(ids)`: la lista nueva, ya sin repetir y de menor a mayor. */

const chip = (on) => ({
  minHeight: 40, padding: '0 13px', borderRadius: 999, cursor: 'pointer', fontFamily: FONT, fontSize: 13.5, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6,
  border: 'none', background: on ? T.accentBg : UI.relleno, color: on ? T.accent : T.text2,
});

const numero = {
  width: 68, minHeight: 44, borderRadius: 11, border: 'none', background: UI.relleno, color: T.text, boxSizing: 'border-box', textAlign: 'center',
  fontFamily: FONT, fontSize: 16, fontWeight: 700, outline: 'none', padding: '0 6px',
};

export default function EdadesDelPlan({ valor, alCambiar, sinTitulo = false }) {
  const [de, setDe] = useState('');
  const [hasta, setHasta] = useState('');
  const [aviso, setAviso] = useState('');
  const marcados = edadesValidas(valor);
  const presets = new Set(EDADES.map((e) => e.id));
  const propios = marcados.filter((id) => !presets.has(id));

  const alterna = (id) => alCambiar(edadesValidas(marcados.includes(id) ? marcados.filter((x) => x !== id) : [...marcados, id]));
  const agrega = () => {
    const problema = problemaDeRango(de, hasta);
    if (problema) { setAviso(problema); return; }
    const id = idDeRango(de, hasta);
    if (!marcados.includes(id)) alCambiar(edadesValidas([...marcados, id]));
    setDe(''); setHasta(''); setAviso('');
  };
  const alTeclear = (e) => { if (e.key === 'Enter') { e.preventDefault(); agrega(); } };
  const escribe = (poner) => (e) => { poner(e.target.value.replace(/\D/g, '').slice(0, 2)); setAviso(''); };

  return (
    <div role="group" aria-label="Edades" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {!sinTitulo && <span style={etiquetaChica}>Edades</span>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
        {EDADES.map((o) => {
          const on = marcados.includes(o.id);
          return (
            <button key={o.id} type="button" role="checkbox" aria-checked={on} onClick={() => alterna(o.id)} style={chip(on)}>
              {on && <Check size={14} strokeWidth={3.2} />}{o.nombre}
            </button>
          );
        })}
        {propios.map((id) => (
          <button key={id} type="button" role="checkbox" aria-checked aria-label={`Quitar ${nombreDeEdad(id)}`} onClick={() => alterna(id)} style={chip(true)}>
            {nombreDeEdad(id)}<X size={14} strokeWidth={3.2} />
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 4, fontSize: 14, fontWeight: 700, color: T.text2 }}>
        Otro rango: de
        <input value={de} onChange={escribe(setDe)} onKeyDown={alTeclear} inputMode="numeric" aria-label="Desde qué edad" placeholder="12" style={numero} />
        a
        <input value={hasta} onChange={escribe(setHasta)} onKeyDown={alTeclear} inputMode="numeric" aria-label="Hasta qué edad (vacío: en adelante)" placeholder="sin tope" style={{ ...numero, width: 84 }} />
        años
        <button type="button" onClick={agrega} style={botonBlanco(true)}><Plus size={15} strokeWidth={3} /> Agregar</button>
      </div>
      {aviso && <span role="alert" style={{ fontSize: 12.5, fontWeight: 700, color: KP.danger }}>{aviso}</span>}
      <span style={{ fontSize: 12.5, fontWeight: 600, color: T.text3 }}>Sin marcar: todas las edades.</span>
    </div>
  );
}
