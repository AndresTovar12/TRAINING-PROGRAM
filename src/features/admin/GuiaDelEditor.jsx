import { useState } from 'react';
import { ChevronDown, ChevronRight, CopyPlus, CornerUpLeft, Pin, Plus, Trash2 } from 'lucide-react';
import { LT, KP, FONT, NUM_STYLE, tipoDeSesion, UI } from '@/lib/theme';
import { esDescanso } from '@/lib/training-utils';
import { Boton } from '@/components/ui';
import { pluralS } from '@/lib/plural';
import { useIsDesktop } from '@/lib/useViewport';
import { propsDeArrastre } from '@/lib/arrastrar';
import { TituloDelRenglon } from '@/components/NavegadorDelPlan';
import { DIAS_SEMANA } from '@/lib/pegadas';
import { MenuEmergente } from '@/features/admin/MenuDeAcciones';
import CampoDeFoto from '@/features/admin/CampoDeFoto';
import { posicionDeFoto, separaFoto } from '@/lib/fotoConFoco';

/**
 * La guía del editor de planes: las fases, sus semanas y los siete días de la semana que se ve.
 *
 * Andrés, 5 oct 2026, con la maqueta aprobada (`docs/maquetas/2026-10-05-editor-nuevo-v21.html`). Es la misma
 * cara de siempre —tarjetas por fase, fichas de semana, un renglón por día— con lo que cambió:
 *
 *   · Las fases se abren y se cierran CADA UNA por su cuenta (ver `useFasesAbiertas`). Abrir no es editar: lo
 *     que se edita cambia al tocar una semana o un día de otra fase.
 *   · La fase abierta lleva en su encabezado el botón «Color y foto» (la bolita de su color y una flecha; con
 *     foto, también su miniatura: abre los 8 colores y la foto que sale en Home), su nombre ESCRIBIBLE ahí
 *     mismo, y los iconos de duplicar, eliminar y cerrar. «AQUÍ VA» solo sale con la fase cerrada (abierta, la
 *     marca es el borde azul); la fase que se edita, si está cerrada, dice «EDITANDO».
 *   · La semana lleva un solo «Opciones ▾» y su título se escribe en su línea. Fuera: los «⋯», el panel «Nombre,
 *     color y objetivo» y la ventana «Ajustes de la semana».
 *
 * En la compu el día elegido sale marcado (azul, «EDITANDO»); en el celular la guía y el día son dos pantallas
 * y no hace falta.
 *
 * Solo es para el editor que se puede cambiar. Quien solo mira un programa ajeno (el fisio sobre el programa del
 * coach, «Ver el plan») sigue con `NavegadorDelPlan`.
 *
 * LA FORMA DEL PLAN. En una rutina no hay fase que nombrar ni semanas que contar: salen solo los días. En
 * «varias semanas» sale UNA tarjeta con las semanas contadas de corrido, aunque por dentro vengan de varias
 * fases, y sin encabezado de fase.
 */
const ESTILOS = `
.tl-enlinea:hover{background:${LT.surface2} !important}
.tl-enlinea:focus{background:${LT.surface2} !important;text-overflow:clip}
@media (hover:none){.tl-enlinea{background:${LT.surface2} !important}}
.tl-ic:hover{background:${LT.surface2} !important;color:${LT.text2} !important}
.tl-ic.tl-borra:hover{background:rgba(220,38,38,0.08) !important;color:${LT.danger} !important}
.tl-boton:hover{background:${LT.surface2} !important}
`;

// El texto que se escribe EN su lugar (nombre de la fase, título de la semana): sin caja hasta que lo tocas.
const enLinea = {
  border: 'none', background: 'transparent', borderRadius: 9, padding: '4px 7px', marginLeft: -7,
  fontFamily: FONT, fontWeight: 800, color: LT.text, outline: 'none', minWidth: 0, textOverflow: 'ellipsis',
  cursor: 'text', boxSizing: 'border-box',
};

function Pastilla({ texto, fuerte = true }) {
  return (
    <span style={{
      fontSize: 12, fontWeight: 700, flexShrink: 0, padding: '3px 8px', borderRadius: 8,
      color: fuerte ? LT.blue : LT.text2, background: fuerte ? LT.blueSoft : LT.surface2,
    }}>
      {texto}
    </span>
  );
}

function BotonIcono({ icono: Icono, etiqueta, onClick, peligro = false, tam, size = 15, ...resto }) {
  return (
    <button
      type="button" className={`tl-ic${peligro ? ' tl-borra' : ''}`} onClick={onClick} aria-label={etiqueta} title={etiqueta}
      style={{
        width: tam, height: tam, borderRadius: 999, border: 'none', background: 'transparent', color: LT.text3,
        display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0, padding: 0, touchAction: 'manipulation',
      }}
      {...resto}
    >
      <Icono size={size} />
    </button>
  );
}

// Una fase cerrada: una fila. Tocarla la abre (no cambia lo que se edita).
function FilaDeFase({ f, esDeAqui, editando, textoAqui, onAbrir, arrastre }) {
  return (
    <button
      type="button" className={`tl-fila${esDeAqui ? ' tl-azul' : ''}`} aria-expanded={false} onClick={onAbrir} {...arrastre}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '12px 13px',
        background: esDeAqui ? LT.blueSoft : LT.surface, borderRadius: 13, cursor: 'pointer', border: 'none',
        fontFamily: FONT, minWidth: 0,
      }}
    >
      <span style={{ width: 9, height: 9, borderRadius: 5, background: f.color || LT.blue, flexShrink: 0 }} />
      <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 700, color: LT.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {f.name}
      </span>
      {esDeAqui && <Pastilla texto={textoAqui} />}
      {editando && <Pastilla texto="Editando" />}
      <span style={{ fontSize: 11.5, fontWeight: 700, color: LT.text3, flexShrink: 0, ...NUM_STYLE }}>
        {pluralS(f.weekData?.length || 0, 'sem')}
      </span>
      <ChevronRight size={15} style={{ color: LT.text3, flexShrink: 0 }} />
    </button>
  );
}

// El renglón de un día de la semana, tenga o no sesión (un sábado vacío es justo donde el coach quiere agregar algo).
function DiaEnLaGuia({ clave, sesiones, elegido, suyo, textoAqui, onElegir }) {
  const vacio = sesiones.length === 0;
  const primera = sesiones[0];
  return (
    <button
      type="button" className={`tl-fila${elegido ? ' tl-azul' : ''}`} onClick={onElegir} aria-pressed={elegido}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', borderRadius: 11, cursor: 'pointer',
        fontFamily: FONT, padding: '10px 11px', background: elegido ? LT.blueSoft : LT.bg, border: 'none',
      }}
    >
      <span style={{ width: 32, fontSize: 11, fontWeight: 800, color: elegido ? LT.blue : LT.text3, flexShrink: 0 }}>{clave}</span>
      <span style={{
        width: 7, height: 7, borderRadius: 4, flexShrink: 0,
        background: vacio ? 'transparent' : (esDescanso(primera) ? LT.text3 : tipoDeSesion(primera).c),
      }} />
      {vacio
        ? <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600, color: LT.text3 }}>Sin sesión</span>
        : <TituloDelRenglon dias={sesiones} color={LT.text} />}
      {suyo && <Pastilla texto={textoAqui} fuerte={!elegido} />}
      {elegido && <Pastilla texto="Editando" />}
    </button>
  );
}

export default function GuiaDelEditor({
  fases, estructura, aqui, faseEditada, semanaEditada, diaElegido, abiertas, vistas, colores, tituloDeSemana,
  acciones, textoAqui = 'Aquí va',
}) {
  const esCompu = useIsDesktop();
  // El selector de color abierto: { i, ancla } (la fase y el botón al que se pega).
  const [color, setColor] = useState(null);
  const deCorrido = estructura === 'semanas';
  const esRutina = estructura === 'rutina';
  const lista = fases ?? [];
  const ultima = lista.length - 1;
  const tamIcono = esCompu ? 28 : 32;

  // Las fases se mueven arrastrándolas (la fila cerrada, o la tarjeta abierta desde sus huecos): `moverFaseA(de, a)`.
  const arrastreDe = (f) => propsDeArrastre({ lista: 'fases', etiqueta: f.name || 'Fase', alMover: acciones.moverFaseA });

  // La semana que se ve en cada fase: la que se edita, o la última que se miró, o donde va el atleta, o la primera.
  const semanaDe = (f, i) => {
    const ws = f.weekData ?? [];
    const num = i === faseEditada ? semanaEditada : (vistas[f.id] ?? (aqui?.faseId === f.id ? aqui.semana : undefined));
    return ws.find((w) => w.num === num) ?? ws[0];
  };

  // Si se anda editando otra fase u otra semana, un atajo para volver a la del atleta: sin él, en un programa
  // de 9 fases hay que acordarse de dónde era.
  const lejosDeAqui = !!aqui && (lista[faseEditada]?.id !== aqui.faseId || semanaEditada !== aqui.semana);
  const textoIr = textoAqui === 'Aquí vas' ? 'Ir a donde vas' : 'Ir a donde va';

  const tarjetaDe = (f, i) => {
    const s = semanaDe(f, i);
    const delAtleta = aqui?.faseId === f.id;
    const deAqui = deCorrido ? !!aqui : delAtleta;
    const editada = i === faseEditada && s?.num === semanaEditada;
    // Las fichas: las de esta fase o, en «varias semanas», TODAS contadas de corrido.
    const fichas = deCorrido
      ? lista.flatMap((ff, fi) => (ff.weekData ?? []).map((w) => ({ ff, fi, w })))
      : (f.weekData ?? []).map((w) => ({ ff: f, fi: i, w }));
    const diaDeAqui = aqui && delAtleta && aqui.semana === s?.num && aqui.dia != null ? s?.days?.[aqui.dia]?.day : null;
    const titulo = s ? tituloDeSemana(s) : '';

    return (
      <div
        key={f.id} {...(esRutina || deCorrido ? null : arrastreDe(f))}
        style={{
          background: LT.surface, borderRadius: 16, padding: 14, display: 'flex', flexDirection: 'column', gap: 11,
          border: 'none', boxShadow: UI.sombraGrupo,
        }}
      >
        {/* En una rutina que se repite no hay fase que nombrar, y en «varias semanas» tampoco: se ven como semanas. */}
        {!esRutina && !deCorrido && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
            {/* UN BOTÓN, Y TIENE QUE PARECERLO (Andrés, 7 oct 2026: «el botón de color aún no parece botón»). Con
                borde y flecha, como «Opciones ▾»; abre el color y la foto de la fase. */}
            <button
              type="button" className="tl-boton" onClick={(e) => setColor({ i, ancla: e.currentTarget })}
              aria-haspopup="menu" aria-label="Color y foto de la fase" title="Color y foto"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0, cursor: 'pointer',
                border: 'none', background: UI.relleno, borderRadius: 999,
                padding: f.image ? '3px 7px 3px 4px' : '6px 7px 6px 9px', touchAction: 'manipulation',
              }}
            >
              {f.image && (
                <img
                  src={separaFoto(f.image).url} alt=""
                  style={{ width: 22, height: 22, borderRadius: 999, objectFit: 'cover', objectPosition: posicionDeFoto(f.image), display: 'block' }}
                />
              )}
              <i style={{ width: 13, height: 13, borderRadius: 7, background: f.color || LT.blue, display: 'block' }} />
              <ChevronDown size={13} style={{ color: LT.text3 }} />
            </button>
            <input
              className="tl-enlinea" value={f.name ?? ''} onChange={(e) => acciones.nombreFase(i, e.target.value)}
              aria-label="Nombre de la fase" title="Cambiar el nombre"
              style={{ ...enLinea, flex: 1, fontSize: 15.5, paddingBlock: 5 }}
            />
            <span style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0, marginRight: -6 }}>
              <BotonIcono icono={CopyPlus} etiqueta="Duplicar la fase" tam={tamIcono} onClick={() => acciones.duplicarFase(i)} />
              {lista.length > 1 && (
                <BotonIcono icono={Trash2} etiqueta="Eliminar la fase" peligro tam={tamIcono} onClick={() => acciones.eliminarFase(i)} />
              )}
              <BotonIcono
                icono={ChevronDown} size={16} etiqueta="Cerrar la fase" tam={tamIcono} aria-expanded
                onClick={() => acciones.cerrar(i)}
              />
            </span>
          </div>
        )}

        {/* Las fichas de las semanas. Salen aunque haya una sola: ahí vive el «+» para agregar la segunda. */}
        {!esRutina && (
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
            {fichas.map(({ ff, fi, w }, n) => {
              const vista = fi === i && w.num === s?.num;
              const suya = aqui?.faseId === ff.id && w.num === aqui.semana;
              const numero = deCorrido ? n + 1 : w.num;
              return (
                <button
                  key={`${ff.id}-${w.num}`} type="button" onClick={() => acciones.elegirSemana(fi, w.num)}
                  aria-label={`Semana ${numero}${suya ? (textoAqui === 'Aquí vas' ? ', donde vas' : ', donde va') : ''}`}
                  style={{
                    position: 'relative', minWidth: 38, padding: '7px 0', borderRadius: 10, cursor: 'pointer',
                    border: 'none',
                    background: vista ? LT.blue : (suya ? LT.blueSoft : LT.surface2), color: vista ? '#fff' : (suya ? LT.blue : LT.text3),
                    fontFamily: FONT, fontSize: 13, fontWeight: 800, ...NUM_STYLE,
                  }}
                >
                  {numero}
                  {/* El puntito dice «su semana» aunque estés mirando otra. */}
                  {suya && (
                    <span style={{
                      position: 'absolute', left: '50%', bottom: 3, width: 4, height: 4, marginLeft: -2, borderRadius: 2,
                      background: vista ? '#fff' : LT.blue,
                    }} />
                  )}
                </button>
              );
            })}
            <button
              type="button" onClick={() => acciones.agregarSemana(deCorrido ? ultima : i)}
              aria-label="Agregar semana" title="Agregar semana"
              /* Azul clarito y sin contorno punteado: «haces mucho ese estilo de botones, no me gusta»
                 (Andrés, 28 sep 2026). Se distingue de las semanas, que son blancas. */
              style={{
                minWidth: 38, padding: '6px 0', borderRadius: 10, cursor: 'pointer', border: 'none',
                background: LT.blueSoft, color: LT.blue, display: 'grid', placeItems: 'center',
              }}
            >
              <Plus size={15} strokeWidth={2.6} />
            </button>
            {s && (
              <button
                type="button" className="tl-boton" onClick={(e) => acciones.opcionesSemana(i, s.num, e.currentTarget)}
                aria-haspopup="menu" aria-label={`Opciones de la semana ${deCorrido ? fichas.findIndex((x) => x.ff.id === f.id && x.w.num === s.num) + 1 : s.num}`}
                style={{
                  marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 7, flexShrink: 0, cursor: 'pointer',
                  border: 'none', background: UI.relleno, color: LT.text, borderRadius: 999,
                  padding: '6px 9px', fontFamily: FONT, fontSize: 12.5, fontWeight: 700,
                }}
              >
                Opciones <ChevronDown size={14} style={{ color: LT.text3 }} />
              </button>
            )}
          </div>
        )}

        {/* El título de la semana se escribe en su línea. Con la semana que se edita siempre sale (ahí se escribe
            el primero); en las demás, solo si ya lo tiene. */}
        {!esRutina && s && (titulo || editada) && (
          <input
            className="tl-enlinea" value={titulo} onChange={(e) => acciones.tituloSemana(i, s.num, e.target.value)}
            placeholder="Título de la semana" aria-label="Título de la semana"
            style={{ ...enLinea, width: 'calc(100% + 7px)', fontSize: 13, fontWeight: 600, paddingBlock: 5, marginTop: -4 }}
          />
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {DIAS_SEMANA.map((clave) => (
            <DiaEnLaGuia
              key={clave} clave={clave} sesiones={(s?.days ?? []).filter((d) => d.day === clave)}
              elegido={esCompu && editada && diaElegido === clave} suyo={diaDeAqui === clave} textoAqui={textoAqui}
              onElegir={() => acciones.elegirDia(i, s?.num, clave)}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontFamily: FONT }}>
      <style>{ESTILOS}</style>

      {lejosDeAqui && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button" onClick={acciones.volverAqui}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', background: 'transparent',
              cursor: 'pointer', padding: '2px 2px 4px', fontFamily: FONT, fontSize: 13, fontWeight: 800, color: LT.blue,
            }}
          >
            <CornerUpLeft size={15} /> {textoIr}
          </button>
          {/* «Mover a X a esta semana»: cambia DÓNDE VA el atleta (no el plan). Va aquí porque quien abre el editor para mover a alguien de semana busca justo esto. */}
          {acciones.moverAqui && (
            <Boton tipo="secundario" chico icono={Pin} onClick={acciones.moverAqui.alMover}>Mover a {acciones.moverAqui.nombre} a esta semana</Boton>
          )}
        </div>
      )}

      {lista.map((f, i) => {
        // Rutina y «varias semanas»: una sola tarjeta, siempre abierta, la de lo que se edita.
        if (esRutina || deCorrido) return i === faseEditada ? tarjetaDe(f, i) : null;
        if (abiertas[f.id] === true) return tarjetaDe(f, i);
        return (
          <FilaDeFase
            key={f.id} f={f} esDeAqui={aqui?.faseId === f.id} editando={i === faseEditada} textoAqui={textoAqui}
            onAbrir={() => acciones.abrir(i)} arrastre={arrastreDe(f)}
          />
        );
      })}

      {!esRutina && !deCorrido && (
        <button
          type="button" onClick={acciones.agregarFase} className="kp-press"
          /* Sin contorno punteado: «haces mucho ese estilo de botones, no me gusta» (Andrés, 28 sep 2026). */
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, width: '100%', padding: '11px 13px',
            borderRadius: 13, cursor: 'pointer', fontFamily: FONT, border: 'none', background: LT.surface,
            boxShadow: KP.shCard, fontSize: 13.5, fontWeight: 800, color: LT.blue,
          }}
        >
          <Plus size={16} /> Agregar fase
        </button>
      )}

      {color && lista[color.i] && (
        <MenuEmergente titulo="Color y foto" ancla={color.ancla} onClose={() => setColor(null)}>
          <div
            style={{
              display: 'grid', gridTemplateColumns: `repeat(4, ${esCompu ? 30 : 44}px)`, gap: 10,
              justifyContent: esCompu ? undefined : 'center', padding: esCompu ? 8 : '8px 0 12px',
            }}
          >
            {colores.map((c, k) => (
              <button
                key={c} type="button" data-enfoque={k === 0 ? '' : undefined} aria-label={`Color ${c}`}
                aria-pressed={c === lista[color.i].color}
                onClick={() => { acciones.colorFase(color.i, c); setColor(null); }}
                style={{
                  width: esCompu ? 30 : 44, height: esCompu ? 30 : 44, borderRadius: 10, cursor: 'pointer', padding: 0, background: c,
                  border: `3px solid ${c === lista[color.i].color ? LT.text : 'transparent'}`, /* estilo-ok: anillo del color elegido */
                }}
              />
            ))}
          </div>
          <div style={{ padding: esCompu ? '2px 8px 8px' : '2px 4px 4px' }}>
            <CampoDeFoto
              valor={lista[color.i].image || ''} alto={esCompu ? 110 : 150}
              onCambia={(url) => acciones.fotoFase(lista[color.i].id, url)}
            />
          </div>
        </MenuEmergente>
      )}
    </div>
  );
}
