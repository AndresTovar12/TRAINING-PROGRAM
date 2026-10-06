import { useState } from 'react';
import { ChevronDown, ChevronUp, Pencil, Plus, Timer, Trash2 } from 'lucide-react';
import ListaDesplegable from '@/components/ListaDesplegable';
import BotonEntendido from '@/components/BotonEntendido';
import { usePalabras } from '@/contexts/PalabrasContext';
import { useAvisosVistos } from '@/lib/useAvisosVistos';
import Ventana from '@/features/misplanes/Ventana';
import { IconBtn, Pill, Stepper, Contador } from '@/features/admin/piezas';
import {
  FORMATOS, IDS_DE_FORMATOS, ANOTA, formatoNuevo, comoPersonalizado, vistaDe, nombreDeFormato, limpiaFormato,
  segundosTotales, expande, pasoDeEscala, textoDeTiempo,
} from '@/lib/formatos';
import { T, FONT } from '@/lib/theme';

/**
 * El formato de un Set en el editor: AMRAP, EMOM, Tabata, Fartlek… (ver `lib/formatos.js`).
 *
 * CÓMO SE METE SIN SATURAR EL EDITOR. Andrés, 5 oct 2026: «cómo vamos a meterle esa función al
 * editor que ya tenemos, para seguir con la línea de que sea intuitivo pero no se sature
 * visualmente». Se aprobó una maqueta con una regla: el formato REEMPLAZA el «Se repite N veces»,
 * no se suma a él.
 *
 *   · Un Set normal queda casi igual: «Se repite» lleva una flechita ▾, igual que el «REPS ▾» de
 *     los ejercicios. Al tocarla sale la lista de formatos. No hay ningún botón nuevo.
 *   · Con un formato elegido, una pastilla con su nombre ocupa el lugar de «Se repite N veces» y
 *     debajo sale UNA franja con sus números (los mismos − y + del editor).
 *   · Lo secundario —qué anota el atleta, si los ejercicios se turnan— está en «Más ▾».
 *   · «Personalizado» es lo único que abre una ventana aparte, para armar los tramos.
 *   · Un aviso corto, una sola vez, con «✓ Entendido», para que se enteren de que existe.
 */

const CLAVE_DEL_AVISO = 'aviso:formatos-del-set';

// Los ejercicios que se repiten en cada Set de la vista: lo que decide si «Se turnan» tiene sentido.
const hayQueTurnar = (nEjercicios) => nEjercicios >= 2;

/* El botón de la lista de formatos. Primero iba sin caja, con el tamaño de una frase (como el «REPS ▾»), y
   Andrés, 5 oct 2026, dijo que «el botón casi no se ve»: nadie lo encontraba. Ahora es un botón de los suyos
   —blanco, borde sólido, azul—. SIN reloj: «Se repite» son las series de siempre, y el reloj se queda para lo
   que sí lo lleva (él mismo, horas después: «ahí no quiero que tenga un reloj, pero en las demás opciones sí»).
   Con un formato elegido es la pastilla azul, con su relojito. */
const ESTILO_SIN_FORMATO = {
  width: 'auto', border: `1.5px solid ${T.accent}`, background: '#fff', minHeight: 30, gap: 6, borderRadius: 999,
  padding: '0 11px', fontFamily: FONT, fontSize: 12.5, fontWeight: 800, color: T.accent,
};
const ESTILO_CON_FORMATO = {
  width: 'auto', border: 'none', background: T.accentBg, minHeight: 0, gap: 6, borderRadius: 999,
  padding: '7px 12px', fontFamily: FONT, fontSize: 13, fontWeight: 800, color: T.accent,
};

// Botón blanco con borde sólido azul: lo que no es la acción principal pero se busca a simple vista.
function BotonBlanco({ icon: Icon, children, onClick, expandido }) {
  return (
    <button
      type="button" onClick={onClick} className="kp-accion" aria-expanded={expandido}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 32, padding: '0 13px', borderRadius: 999,
        cursor: 'pointer', fontFamily: FONT, fontSize: 12.5, fontWeight: 800, flexShrink: 0,
        border: `1.5px solid ${T.accent}`, background: '#fff', color: T.accent, touchAction: 'manipulation',
      }}
    >
      {Icon && <Icon size={14} strokeWidth={2.6} />} {children}
    </button>
  );
}

const frase = { fontSize: 12.5, fontWeight: 700, color: T.text2 };

/** Aviso de una sola vez, arriba de los Sets, que dice que un Set puede tener formato. */
export function AvisoDeFormatos() {
  const { listo, visto, marcar } = useAvisosVistos();
  if (!listo || visto(CLAVE_DEL_AVISO)) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', background: T.accentBg, borderRadius: 12, padding: '10px 14px' }}>
      <span style={{ flex: 1, minWidth: 200, fontSize: 13, fontWeight: 600, color: T.accent, lineHeight: 1.4 }}>
        Un Set también puede ser AMRAP, EMOM, Tabata, Fartlek… Toca «Se repite» para elegir el formato.
      </span>
      <BotonEntendido color={T.accent} onClick={() => marcar(CLAVE_DEL_AVISO)} />
    </div>
  );
}

/**
 * El encabezado de un Set: su número, cómo se repite (o su formato), y los botones de siempre.
 * La franja de números y la ventana de tramos salen debajo, solo si hay formato.
 *
 * `bloque` es el Set tal como lo arma el editor (`{ members, rounds, formato }`); `onCambio`
 * recibe lo que cambia de él (`{ rounds }` o `{ formato }`).
 */
export function EncabezadoDelSet({
  numero, bloque, etiquetaDeTipo, onCambio, onAgregar, onSubir, onBajar, onEliminar, puedeSubir, puedeBajar,
}) {
  const formato = bloque.formato ?? null;
  const nEjercicios = bloque.members.length;
  const vista = formato ? vistaDe(formato) : 'normal';
  const [ventana, setVentana] = useState(false);

  const pon = (f) => onCambio({ formato: f, rounds: String(f.vueltas) });

  const elige = (id) => {
    if (id === 'normal') { onCambio({ formato: null }); return; }
    if (id === vista) { if (id === 'custom') setVentana(true); return; }
    if (id === 'custom') {
      // Desde un formato con nombre se queda con sus tramos para retocarlos; desde cero, uno de ejemplo.
      pon(formato ? comoPersonalizado(formato) : formatoNuevo('custom'));
      setVentana(true);
      return;
    }
    pon(formatoNuevo(id));
  };

  const opciones = [
    { valor: 'normal', etiqueta: 'Normal', corta: 'Se repite', detalle: 'Series de siempre' },
    ...IDS_DE_FORMATOS.map((id) => ({
      valor: id,
      etiqueta: FORMATOS[id].nombre,
      // Un Personalizado con nombre propio se llama así en la pastilla, no «Personalizado».
      corta: id === 'custom' && formato ? nombreDeFormato(formato) : undefined,
      detalle: FORMATOS[id].detalle,
    })),
  ];

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <span style={{ fontSize: 14.5, fontWeight: 800, color: T.text }}>Set {numero}</span>
        {formato ? (
          <ListaDesplegable
            etiqueta="Formato del set" valor={vista} onCambio={elige} opciones={opciones}
            icono={Timer} estilo={ESTILO_CON_FORMATO} colorFlecha={T.accent} anchoMinimo={270} alto={460}
          />
        ) : (
          <>
            {etiquetaDeTipo && (
              <span style={{ fontSize: 10.5, fontWeight: 800, color: T.accent, background: T.accentBg, padding: '3px 9px', borderRadius: 8, letterSpacing: 0.4 }}>
                {etiquetaDeTipo.toUpperCase()}
              </span>
            )}
            <span style={{ ...frase, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <ListaDesplegable
                etiqueta="Formato del set" valor="normal" onCambio={elige} opciones={opciones}
                estilo={ESTILO_SIN_FORMATO} colorFlecha={T.accent} anchoMinimo={270} alto={460}
              />
              <Stepper value={bloque.rounds} onChange={(v) => onCambio({ rounds: v })} />
              {parseInt(bloque.rounds, 10) === 1 ? 'vez' : 'veces'}
            </span>
          </>
        )}
        <span style={{ flex: 1 }} />
        <Pill icon={Plus} primary onClick={onAgregar}>Agregar ejercicio</Pill>
        {/* Subir y bajar solo si quien lo usa no deja arrastrar el Set. */}
        {onSubir && <IconBtn icon={ChevronUp} onClick={onSubir} disabled={!puedeSubir} />}
        {onBajar && <IconBtn icon={ChevronDown} onClick={onBajar} disabled={!puedeBajar} />}
        <IconBtn icon={Trash2} danger onClick={onEliminar} />
      </div>

      {formato && (
        <FranjaDeFormato
          formato={formato} nEjercicios={nEjercicios} onCambio={pon} onTramos={() => setVentana(true)}
        />
      )}
      {formato && ventana && (
        <VentanaDeTramos
          titulo={`Tramos del Set ${numero}`} formato={formato} nEjercicios={nEjercicios}
          onCambio={pon} onCerrar={() => setVentana(false)}
        />
      )}
    </>
  );
}

/** Los números del formato, en una sola franja debajo del encabezado. */
function FranjaDeFormato({ formato, nEjercicios, onCambio, onTramos }) {
  const { t } = usePalabras();
  const [mas, setMas] = useState(false);
  const vista = vistaDe(formato);
  const def = FORMATOS[vista];
  const total = segundosTotales(formato, nEjercicios);
  const nTramos = expande(formato, nEjercicios).length;

  const campo = (k) => {
    const c = def.campos[k];
    const v = c.lee(formato);
    const mueve = (dir) => {
      const sig = c.tipo === 'numero'
        ? v + dir
        : c.paso ? v + dir * c.paso : pasoDeEscala(v, dir, c.min, c.max);
      onCambio(c.pon(formato, Math.min(c.max, Math.max(c.min, sig))));
    };
    // El trabajo de un Intervalos puede ser «hasta que toque Listo»: no hay número que mover.
    if (v === null) return <span key={k} style={{ ...frase, color: T.text }}>hasta «Listo»</span>;
    const texto = c.tipo === 'numero' ? String(v) : (k === 'tope' && v === 0 ? 'sin tope' : textoDeTiempo(v));
    return (
      <Contador
        key={k} texto={texto} etiqueta={k}
        ancho={c.tipo === 'numero' ? 38 : k === 'tope' ? 62 : 50}
        editable={c.tipo === 'numero'}
        onEscribe={(txt) => {
          const n = parseInt(txt, 10);
          if (Number.isFinite(n)) onCambio(c.pon(formato, Math.min(c.max, Math.max(c.min, n))));
        }}
        onMenos={() => mueve(-1)} onMas={() => mueve(1)}
        menosApagado={v <= c.min} masApagado={v >= c.max}
      />
    );
  };

  const cambiaAnota = (anota) => onCambio({ ...formato, anota });
  const alTrabajo = vista === 'intervalos' ? (formato.pasos[0].seg === null ? 'listo' : 'fijo') : null;

  return (
    <div style={{ background: T.accentBg, borderRadius: 12, padding: '9px 12px', marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px 10px' }}>
        {vista === 'custom' ? (
          <>
            <span style={frase}>{nTramos} {nTramos === 1 ? 'tramo' : 'tramos'}</span>
            <BotonBlanco icon={Pencil} onClick={onTramos}>Editar tramos</BotonBlanco>
          </>
        ) : def.frase.map((p, i) => (typeof p === 'string'
          ? <span key={i} style={frase}>{p}</span>
          : campo(p.campo)))}
        <span style={{ ...frase, color: T.accent }}>
          {total === null ? 'hasta que termines' : `= ${textoDeTiempo(total)}`}
        </span>
        <span style={{ flex: 1 }} />
        <BotonBlanco onClick={() => setMas(!mas)} expandido={mas}>
          Más {mas ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </BotonBlanco>
      </div>

      {mas && (
        <div style={{
          display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px 18px', marginTop: 9, paddingTop: 9,
          borderTop: `1px solid ${T.accent}33`,
        }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span style={frase}>{t('El atleta anota')}</span>
            <ListaDesplegable
              etiqueta="Qué anota" valor={formato.anota} onCambio={cambiaAnota}
              opciones={ANOTA.map((a) => ({ valor: a.id, etiqueta: a.etiqueta }))}
              estilo={{ width: 'auto', minHeight: 0, padding: '7px 11px', fontSize: 13, gap: 7 }} anchoMinimo={210} alto={330}
            />
          </span>
          {alTrabajo && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <span style={frase}>El trabajo dura</span>
              <ListaDesplegable
                etiqueta="Cuánto dura el trabajo" valor={alTrabajo}
                onCambio={(v) => onCambio({ ...formato, pasos: formato.pasos.map((p, i) => (i === 0 ? { ...p, seg: v === 'listo' ? null : 30 } : p)) })}
                opciones={[{ valor: 'fijo', etiqueta: 'Un tiempo fijo' }, { valor: 'listo', etiqueta: 'Hasta que toque «Listo»' }]}
                estilo={{ width: 'auto', minHeight: 0, padding: '7px 11px', fontSize: 13, gap: 7 }} anchoMinimo={220} alto={120}
              />
            </span>
          )}
          {hayQueTurnar(nEjercicios) && (
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', ...frase, color: T.text }}>
              <input
                type="checkbox" checked={formato.turnan} onChange={(e) => onCambio({ ...formato, turnan: e.target.checked })}
                style={{ width: 17, height: 17, accentColor: T.accent, margin: 0 }}
              />
              Un ejercicio distinto en cada tramo
            </label>
          )}
        </div>
      )}
    </div>
  );
}

const CAMPO_DE_TEXTO = {
  border: `1.5px solid ${T.border}`, borderRadius: 11, padding: '9px 12px', fontFamily: FONT, fontSize: 14, fontWeight: 600,
  color: T.text, outline: 'none', background: T.bg2, boxSizing: 'border-box', width: '100%',
};

/**
 * La ventana de los tramos: lo único que sale del renglón. Cada tramo es «trabajo» o «descanso»,
 * dura un tiempo o «hasta Listo», y puede llevar un nombre que el atleta ve en el reloj
 * («Fuerte», «Suave»). Abajo, cuántas veces se repite la lista y el tope opcional.
 */
function VentanaDeTramos({ titulo, formato, nEjercicios, onCambio, onCerrar }) {
  const g = limpiaFormato(formato) ?? formato;
  const pasos = g.pasos;
  const cambiaPaso = (i, cambios) => onCambio({ ...g, pasos: pasos.map((p, k) => (k === i ? { ...p, ...cambios } : p)) });
  const quita = (i) => { if (pasos.length > 1) onCambio({ ...g, pasos: pasos.filter((_, k) => k !== i) }); };
  const agrega = () => onCambio({ ...g, pasos: [...pasos, { tipo: 'trabajo', seg: 60 }] });
  const total = segundosTotales(g, nEjercicios);
  const plan = expande(g, nEjercicios);

  const segmentado = (valor, opciones, alCambiar) => (
    <span style={{ display: 'inline-flex', borderRadius: 10, border: `1.5px solid ${T.border}`, overflow: 'hidden', flexShrink: 0 }}>
      {opciones.map(([v, texto]) => (
        <button
          key={v} type="button" onClick={() => alCambiar(v)} aria-pressed={valor === v}
          style={{
            border: 'none', cursor: 'pointer', padding: '6px 11px', fontFamily: FONT, fontSize: 12.5, fontWeight: 800,
            background: valor === v ? T.accent : T.bg2, color: valor === v ? '#fff' : T.text2, touchAction: 'manipulation',
          }}
        >{texto}</button>
      ))}
    </span>
  );

  return (
    <Ventana
      titulo={titulo} subtitulo="Cada tramo es un tiempo de trabajo o de descanso. La lista se repite las veces que digas."
      onCerrar={onCerrar} ancho={560}
      pie={<Pill solido onClick={onCerrar}>Listo</Pill>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label style={{ display: 'block' }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: T.text2, marginBottom: 6 }}>Nombre del formato (opcional)</div>
          <input
            value={g.nombre ?? ''} maxLength={40}
            onChange={(e) => onCambio({ ...g, nombre: e.target.value })} style={CAMPO_DE_TEXTO}
          />
        </label>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {pasos.map((p, i) => (
            <div
              key={i}
              style={{
                display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px 10px', background: T.bg2,
                border: `1px solid ${T.border}`, borderRadius: 12, padding: '9px 10px',
              }}
            >
              <span style={{ width: 20, fontSize: 12.5, fontWeight: 800, color: T.text3, textAlign: 'center' }}>{i + 1}</span>
              {segmentado(p.tipo, [['trabajo', 'Trabajo'], ['descanso', 'Descanso']], (v) => cambiaPaso(i, { tipo: v }))}
              {p.seg !== null && (
                <Contador
                  texto={textoDeTiempo(p.seg)} ancho={50} etiqueta="tiempo"
                  onMenos={() => cambiaPaso(i, { seg: pasoDeEscala(p.seg, -1, 5, 21600) })}
                  onMas={() => cambiaPaso(i, { seg: pasoDeEscala(p.seg, 1, 5, 21600) })}
                />
              )}
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', ...frase }}>
                <input
                  type="checkbox" checked={p.seg === null} onChange={(e) => cambiaPaso(i, { seg: e.target.checked ? null : 60 })}
                  style={{ width: 16, height: 16, accentColor: T.accent, margin: 0 }}
                />
                Hasta «Listo»
              </label>
              <input
                value={p.etiqueta ?? ''} maxLength={30} placeholder="Nombre (opcional)" aria-label="Nombre del tramo"
                onChange={(e) => cambiaPaso(i, { etiqueta: e.target.value })}
                style={{ ...CAMPO_DE_TEXTO, flex: '1 1 130px', width: 'auto', minWidth: 110, padding: '7px 10px', fontSize: 13 }}
              />
              <IconBtn icon={Trash2} danger onClick={() => quita(i)} disabled={pasos.length <= 1} title="Quitar el tramo" />
            </div>
          ))}
          <div><BotonBlanco icon={Plus} onClick={agrega}>Agregar tramo</BotonBlanco></div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px 22px' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, ...frase }}>
            Repetir toda la lista
            <Contador
              editable texto={String(g.vueltas)} ancho={38} etiqueta="veces"
              onEscribe={(txt) => { const n = parseInt(txt, 10); if (Number.isFinite(n)) onCambio({ ...g, vueltas: Math.min(99, Math.max(1, n)) }); }}
              onMenos={() => onCambio({ ...g, vueltas: Math.max(1, g.vueltas - 1) })}
              onMas={() => onCambio({ ...g, vueltas: Math.min(99, g.vueltas + 1) })}
              menosApagado={g.vueltas <= 1}
            />
            {g.vueltas === 1 ? 'vez' : 'veces'}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, ...frase }}>
            Tope total
            <Contador
              texto={g.tope ? textoDeTiempo(g.tope) : 'sin tope'} ancho={62} etiqueta="tope"
              onMenos={() => onCambio({ ...g, tope: g.tope && g.tope > 60 ? g.tope - 60 : null })}
              onMas={() => onCambio({ ...g, tope: Math.min(21600, (g.tope ?? 0) + 60) })}
              menosApagado={!g.tope}
            />
          </span>
        </div>

        {/* El mismo orden que va a correr el reloj, de un vistazo: azul = trabajo, vacío = descanso. */}
        <div>
          <div style={{ display: 'flex', gap: 2, height: 16 }}>
            {plan.map((t) => (t.seg === null
              ? <i key={t.n} style={{ flex: 45, border: `1.5px dashed ${T.accent}`, borderRadius: 3, minWidth: 3 }} />
              : <i key={t.n} style={{
                flex: t.seg, borderRadius: 3, minWidth: 3,
                background: t.tipo === 'trabajo' ? T.accent : T.bg2, border: t.tipo === 'trabajo' ? 'none' : `1px solid ${T.borderHi}`,
              }}
              />))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginTop: 6, ...frase }}>
            <span>Azul: trabajo · Vacío: descanso</span>
            <span style={{ color: T.text }}>{total === null ? 'Hasta que termines' : `Total ${textoDeTiempo(total)}`}</span>
          </div>
        </div>
      </div>
    </Ventana>
  );
}
