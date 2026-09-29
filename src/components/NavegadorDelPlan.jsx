import { useState } from 'react';
import { Check, ChevronRight, CornerUpLeft, MoreHorizontal, Plus } from 'lucide-react';
import { LT, KP, FONT, NUM_STYLE, tipoDeSesion } from '@/lib/theme';
import { esDescanso, enOrdenDeSemana, semanaGlobal } from '@/lib/training-utils';
import { sesionesDelTitulo, textoDeSesiones } from '@/lib/sesiones';
import EtiquetasDeSesion from '@/components/EtiquetasDeSesion';
import { pluralS } from '@/lib/plural';

/* Los siete días, empezando en lunes. Son las mismas claves que guarda el plan
   ('Mié', 'Sáb', con acento): si no coincidieran, un día con sesión saldría
   vacío en el editor. */
const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

/** Cómo se llama una sesión: su nombre, o sus bloques, o su tipo. */
const nombreDe = (day) => textoDeSesiones(sesionesDelTitulo(day))
  || (esDescanso(day) ? 'Descanso' : tipoDeSesion(day).label);

/* El título de un renglón de día.

   Un día con UNA sesión se escribe como siempre, cortado con «…» si no cabe.
   Uno con DOS —mañana y tarde, o el mismo día de la semana con dos entradas—
   lleva una etiqueta por cada sesión en vez de sus nombres unidos con «+»:
   «Velocidad + Lower Strength» se lee como una sola sesión que junta las dos
   cosas (Andrés, 29 sep 2026). El renglón puede crecer a dos líneas. */
function TituloDelRenglon({ dias, color, peso = 700 }) {
  const sesiones = sesionesDelTitulo(dias);
  if (sesiones.length > 1) {
    return <EtiquetasDeSesion sesiones={sesiones} style={{ flex: 1 }} />;
  }
  return (
    <span style={{
      flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: peso, color,
      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    }}>
      {nombreDe(Array.isArray(dias) ? dias[0] : dias)}
    </span>
  );
}

/**
 * LA forma de ver un plan en esta app. Solo hay una.
 *
 * Andrés, 24 sep 2026: la hoja "Programa de …" que ve el atleta es "mi forma
 * favorita de ver cualquier plan", y "en otras partes de la app mantuviste
 * otras formas de navegar los planes… debería de ser congruente: al navegar
 * el plan de cualquier forma tendría que ser igual". En la ficha del atleta
 * había un acordeón larguísimo y en el editor unas tarjetas con flechas.
 *
 * Por eso esto es un componente aparte y no un trozo de la pantalla del
 * atleta. Lo usan tres sitios, con la misma cara:
 *   el atleta          — su programa
 *   el coach, "Ver el plan" — `quien="atleta"` y `contenidoDia`
 *   el editor del plan — `editor`
 *
 * Fases como filas; la abierta muestra sus semanas como fichas y los días de
 * la semana elegida debajo.
 *
 * DOS MARCAS DISTINTAS, porque confundirlas era la queja:
 *   aqui    — donde va el atleta DE VERDAD. Fase, semana y día.
 *   viendo  — lo que tiene abierto en pantalla, si no es lo mismo.
 * Antes solo había una, puesta en la fase, y seguía a lo que se miraba en vez
 * de a donde se va: "si te metes a ver algún otro día pierdes la noción de si
 * ese día es donde vas o es otro que seleccionaste".
 *
 * MODO EDITOR (`editor`). La fase y la semana abiertas las lleva quien edita,
 * porque el editor del día de al lado tiene que estar mirando la misma. Salen
 * los SIETE días —un sábado vacío es justo donde el coach quiere añadir algo—,
 * y cada fase y cada semana tienen sus tres puntos. Aprobado por Andrés con
 * maqueta el 24 sep 2026: "sí, hazlo así".
 *
 * LA FORMA DEL PLAN (`estructura`, ver `estructuraDelPlan`). En una rutina no
 * hay fase que nombrar. En "varias semanas" tampoco: sale UNA tarjeta con las
 * semanas contadas de corrido, aunque por dentro vengan de varias fases (al
 * pasar un programa por fases a semanas no se juntan los datos). Sin
 * `estructura`, se deduce de `kind` como antes.
 */
export default function NavegadorDelPlan({
  fases, kind, estructura: estructuraDada, aqui, viendo, hecha, alTocarDia, abrirEn, detalleDia,
  contenidoDia, quien = 'tu', editor,
}) {
  const estructura = estructuraDada ?? (kind === 'weekly' ? 'rutina' : 'fases');
  const deCorrido = estructura === 'semanas';
  /* `quien`: el atleta lee "AQUÍ VAS"; el coach, que mira el plan de otro,
     "AQUÍ VA". Misma marca, dicha a quien la lee. */
  const textoAqui = quien === 'tu' ? 'AQUÍ VAS' : 'AQUÍ VA';
  const textoIr = quien === 'tu' ? 'Ir a donde vas' : 'Ir a donde va';

  /* `contenidoDia`: si viene, tocar un día lo abre AQUÍ MISMO para ver qué
     tiene, en vez de llevar a otra pantalla. Es lo que usa el coach: él no
     entrena ese día, solo quiere ver qué le puso. Uno abierto a la vez. */
  const [diaAbierto, setDiaAbierto] = useState(null);
  const fasesSeguras = fases ?? [];
  const inicio = abrirEn ?? aqui;
  const indiceInicio = Math.max(0, fasesSeguras.findIndex((f) => f.id === inicio?.faseId));

  const [abiertaSuelta, setAbiertaSuelta] = useState(indiceInicio);
  const [semanaSuelta, setSemanaSuelta] = useState(
    inicio?.semana ?? fasesSeguras[indiceInicio]?.weekData?.[0]?.num ?? 1,
  );
  // En el editor manda quien edita; en lo demás, el propio navegador.
  const abierta = editor ? editor.faseAbierta : abiertaSuelta;
  const semanaVista = editor ? editor.semanaAbierta : semanaSuelta;
  const abrirFase = (i, semanaNum) => {
    if (editor) { editor.onAbrirFase(i, semanaNum); return; }
    setAbiertaSuelta(i);
    setSemanaSuelta(semanaNum);
  };
  const elegirSemana = (num) => (editor ? editor.onElegirSemana(num) : setSemanaSuelta(num));

  const esAqui = (faseId, semana, dia) => !!aqui
    && aqui.faseId === faseId && aqui.semana === semana && aqui.dia === dia;
  const esViendo = (faseId, semana, dia) => !!viendo
    && viendo.faseId === faseId && viendo.semana === semana && viendo.dia === dia
    && !esAqui(faseId, semana, dia);

  const fase = fasesSeguras[abierta];
  const semana = (fase?.weekData ?? []).find((w) => w.num === semanaVista) ?? fase?.weekData?.[0];

  // Si se anda mirando otra fase u otra semana, un atajo para volver a la de
  // uno. Sin él, en un programa de 9 fases hay que acordarse de dónde era.
  const lejosDeAqui = !!aqui && (fase?.id !== aqui.faseId || semana?.num !== aqui.semana);
  const volverAqui = () => {
    const i = fasesSeguras.findIndex((f) => f.id === aqui.faseId);
    if (i >= 0) abrirFase(i, aqui.semana);
  };

  const pastilla = (texto, fuerte) => (
    <span style={{
      fontSize: 10, fontWeight: 800, letterSpacing: 0.3, flexShrink: 0,
      padding: '3px 7px', borderRadius: 6,
      color: fuerte ? LT.blue : LT.text2,
      background: fuerte ? LT.blueSoft : LT.surface2,
    }}>
      {texto}
    </span>
  );

  // Los tres puntos. Van SIEMPRE como botón aparte, nunca dentro de otro
  // botón: un botón dentro de otro no es HTML válido y el toque se lo come el
  // de fuera.
  const tresPuntos = (etiqueta, alTocar) => (
    <button
      type="button"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); alTocar(); }}
      aria-label={etiqueta}
      title={etiqueta}
      style={{
        width: 32, height: 32, borderRadius: 9, flexShrink: 0, cursor: 'pointer',
        border: 'none', background: 'transparent', color: LT.text2,
        display: 'grid', placeItems: 'center', touchAction: 'manipulation',
      }}
    >
      <MoreHorizontal size={18} />
    </button>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontFamily: FONT }}>
      {lejosDeAqui && (
        <button
          type="button"
          onClick={volverAqui}
          style={{
            alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6,
            border: 'none', background: 'transparent', cursor: 'pointer', padding: '2px 2px 4px',
            fontFamily: FONT, fontSize: 13, fontWeight: 800, color: LT.blue,
          }}
        >
          <CornerUpLeft size={15} /> {textoIr}
        </button>
      )}

      {fasesSeguras.map((f, i) => {
        const faseDeAqui = aqui?.faseId === f.id;

        if (i !== abierta) {
          if (deCorrido) return null;
          const { hechas, total } = cuentaDe(f, hecha);
          const terminada = total > 0 && hechas === total;
          const fila = (
            <button
              key={editor ? undefined : f.id}
              type="button"
              onClick={() => {
                // En la fase donde vas se abre tu semana; en otra, la primera.
                abrirFase(i, faseDeAqui ? aqui.semana : (f.weekData?.[0]?.num ?? 1));
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
                padding: '12px 13px', background: LT.surface, borderRadius: 13, cursor: 'pointer',
                border: `1px solid ${faseDeAqui ? LT.blue : LT.border}`,
                fontFamily: FONT, opacity: terminada && !faseDeAqui ? 0.68 : 1,
                flex: editor ? 1 : undefined, minWidth: 0,
              }}
            >
              <span style={{ width: 9, height: 9, borderRadius: 5, background: f.color || LT.blue, flexShrink: 0 }} />
              <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 700, color: LT.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {f.name}
              </span>
              {/* Aunque esté plegada, la fase donde vas lo sigue diciendo. */}
              {faseDeAqui && pastilla(textoAqui, true)}
              <span style={{ fontSize: 11.5, fontWeight: 700, color: LT.text3, flexShrink: 0, ...NUM_STYLE }}>
                {pluralS(f.weekData?.length || 0, 'sem')}
              </span>
              {terminada
                ? <Check size={15} strokeWidth={3} style={{ color: LT.mint, flexShrink: 0 }} />
                : <ChevronRight size={15} style={{ color: LT.text3, flexShrink: 0 }} />}
            </button>
          );
          if (!editor) return fila;
          return (
            <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {fila}
              {tresPuntos(`Opciones de ${f.name}`, () => editor.onMenuFase(f, i))}
            </div>
          );
        }

        // En "varias semanas" la tarjeta es el plan entero: el atleta siempre
        // está en ella.
        const tarjetaDeAqui = deCorrido ? !!aqui : faseDeAqui;
        // Las fichas de semana: las de esta fase, o en "varias semanas" TODAS,
        // contadas de corrido.
        const fichas = deCorrido
          ? fasesSeguras.flatMap((ff, fi) => (ff.weekData ?? []).map((w) => ({ ff, fi, w })))
          : (f.weekData ?? []).map((w) => ({ ff: f, fi: i, w }));
        const ultima = fasesSeguras.length - 1;
        return (
          <div
            key={f.id}
            style={{
              background: LT.surface, borderRadius: 16, padding: 14,
              border: `${tarjetaDeAqui ? 2 : 1}px solid ${tarjetaDeAqui ? LT.blue : LT.border}`,
              display: 'flex', flexDirection: 'column', gap: 11,
            }}
          >
            {/* En una rutina que se repite no hay fase que nombrar: es una sola
                y su nombre ya está en el título. Solo van los días. En "varias
                semanas", tampoco: se ven como semanas, no como fases. */}
            {kind !== 'weekly' && !deCorrido && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 9, height: 9, borderRadius: 5, background: f.color || LT.blue, flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0, fontSize: 15.5, fontWeight: 800, color: LT.text }}>{f.name}</span>
                {faseDeAqui && pastilla(textoAqui, true)}
                {editor && tresPuntos(`Opciones de ${f.name}`, () => editor.onMenuFase(f, i))}
              </div>
            )}

            {/* Las fichas de las semanas. En el editor salen aunque haya una
                sola, porque ahí vive el "+" para agregar la segunda. */}
            {kind !== 'weekly' && (fichas.length > 1 || editor) && (
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                {fichas.map(({ ff, fi, w }, n) => {
                  const elegida = fi === abierta && w.num === semana?.num;
                  const suya = aqui?.faseId === ff.id && w.num === aqui.semana;
                  const numero = deCorrido ? n + 1 : w.num;
                  return (
                    <button
                      key={`${ff.id}-${w.num}`}
                      type="button"
                      onClick={() => (fi === abierta ? elegirSemana(w.num) : abrirFase(fi, w.num))}
                      aria-label={`Semana ${numero}${suya ? (quien === 'tu' ? ', donde vas' : ', donde va') : ''}`}
                      style={{
                        position: 'relative', minWidth: 38, padding: '7px 0', borderRadius: 10, cursor: 'pointer',
                        border: `${suya && !elegida ? 2 : 1}px solid ${elegida || suya ? LT.blue : LT.border}`,
                        background: elegida ? LT.blue : LT.surface2,
                        color: elegida ? '#fff' : (suya ? LT.blue : LT.text3),
                        fontFamily: FONT, fontSize: 13, fontWeight: 800, ...NUM_STYLE,
                      }}
                    >
                      {numero}
                      {/* El puntito dice "tu semana" aunque estés mirando otra. */}
                      {suya && (
                        <span style={{
                          position: 'absolute', left: '50%', bottom: 3, width: 4, height: 4,
                          marginLeft: -2, borderRadius: 2, background: elegida ? '#fff' : LT.blue,
                        }} />
                      )}
                    </button>
                  );
                })}
                {editor && (
                  <>
                    <button
                      type="button"
                      // En "varias semanas" la nueva va al final de todo.
                      onClick={() => (deCorrido
                        ? editor.onAgregarSemana(fasesSeguras[ultima], ultima)
                        : editor.onAgregarSemana(f, i))}
                      aria-label="Agregar semana"
                      title="Agregar semana"
                      /* Azul clarito y sin contorno punteado: "haces mucho
                         ese estilo de botones, no me gusta" (Andrés, 28 sep
                         2026). Se distingue de las semanas, que son blancas. */
                      style={{
                        minWidth: 38, padding: '6px 0', borderRadius: 10, cursor: 'pointer',
                        border: '1.5px solid transparent', background: LT.blueSoft, color: LT.blue,
                        display: 'grid', placeItems: 'center',
                      }}
                    >
                      <Plus size={15} strokeWidth={2.6} />
                    </button>
                    <span style={{ marginLeft: 'auto' }}>
                      {tresPuntos(
                        `Opciones de la semana ${(deCorrido ? semanaGlobal(fasesSeguras, f.id, semana?.num) : semana?.num) ?? ''}`,
                        () => editor.onMenuSemana(f, i, semana),
                      )}
                    </span>
                  </>
                )}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {editor
                ? DIAS.map((clave) => {
                  /* En el editor, un renglón por día de la semana, tenga o no
                     sesión. Si tiene dos (mañana y tarde), cada una lleva su
                     etiqueta: el editor de la derecha las muestra las dos. */
                  const sesiones = (semana?.days ?? []).filter((d) => d.day === clave);
                  const vacio = sesiones.length === 0;
                  const elegido = editor.diaElegido === clave;
                  const idxAqui = aqui && aqui.faseId === f.id && aqui.semana === semana?.num && aqui.dia != null
                    ? semana.days[aqui.dia]?.day : null;
                  const suyo = idxAqui === clave;
                  const primera = sesiones[0];
                  return (
                    <button
                      key={clave}
                      type="button"
                      onClick={() => editor.onElegirDia(f, i, semana, clave)}
                      aria-pressed={elegido}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
                        padding: '10px 11px', borderRadius: 11, cursor: 'pointer', fontFamily: FONT,
                        background: elegido ? LT.blueSoft : LT.bg,
                        border: `${elegido ? 1.5 : 1}px ${vacio && !elegido ? 'dashed' : 'solid'} ${elegido ? LT.blue : LT.border}`,
                      }}
                    >
                      <span style={{ width: 32, fontSize: 11, fontWeight: 800, color: elegido ? LT.blue : LT.text3, flexShrink: 0 }}>
                        {clave}
                      </span>
                      <span style={{
                        width: 7, height: 7, borderRadius: 4, flexShrink: 0,
                        background: vacio ? 'transparent' : (esDescanso(primera) ? LT.text3 : tipoDeSesion(primera).c),
                      }} />
                      {vacio ? (
                        <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600, color: LT.text3 }}>
                          Sin sesión
                        </span>
                      ) : (
                        <TituloDelRenglon dias={sesiones} color={LT.text} />
                      )}
                      {suyo && pastilla(textoAqui, !elegido)}
                      {elegido && pastilla('EDITANDO', true)}
                    </button>
                  );
                })
                : enOrdenDeSemana(semana?.days ?? []).map(({ day, idx }) => {
                  const tipo = tipoDeSesion(day);
                  const descanso = esDescanso(day);
                  const suyo = esAqui(f.id, semana.num, idx);
                  const mirando = esViendo(f.id, semana.num, idx);
                  const lista = !!hecha?.(f.id, semana.num, idx);
                  const clave = `${f.id}-${semana.num}-${idx}`;
                  const abiertoAqui = !!contenidoDia && diaAbierto === clave;
                  return (
                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <button
                        type="button"
                        aria-expanded={contenidoDia ? abiertoAqui : undefined}
                        onClick={() => {
                          if (contenidoDia) setDiaAbierto(abiertoAqui ? null : clave);
                          alTocarDia?.(f, semana, idx);
                        }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
                          padding: '10px 11px', borderRadius: 11, cursor: 'pointer', fontFamily: FONT,
                          background: suyo ? LT.blueSoft : LT.bg,
                          border: `${suyo || mirando ? 1.5 : 1}px solid ${suyo ? LT.blue : (mirando ? LT.text2 : LT.border)}`,
                        }}
                      >
                        <span style={{ width: 32, fontSize: 11, fontWeight: 800, color: suyo ? LT.blue : LT.text3, flexShrink: 0 }}>
                          {day.day}
                        </span>
                        <span style={{ width: 7, height: 7, borderRadius: 4, background: descanso ? LT.text3 : tipo.c, flexShrink: 0 }} />
                        <TituloDelRenglon dias={day} color={descanso ? LT.text3 : LT.text} />
                        {detalleDia?.(f, semana, idx)}
                        {suyo && pastilla(textoAqui, true)}
                        {mirando && pastilla('VIENDO', false)}
                        {lista && <Check size={14} strokeWidth={3} style={{ color: LT.mint, flexShrink: 0 }} />}
                      </button>
                      {abiertoAqui && (
                        <div style={{ padding: '2px 4px 6px 42px' }}>
                          {contenidoDia(f, semana, idx)}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        );
      })}

      {editor && kind !== 'weekly' && !deCorrido && (
        <button
          type="button"
          onClick={editor.onAgregarFase}
          className="kp-press"
          /* Sin contorno punteado: "haces mucho ese estilo de botones, no me
             gusta" (Andrés, 28 sep 2026). */
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, width: '100%',
            padding: '11px 13px', borderRadius: 13, cursor: 'pointer', fontFamily: FONT,
            border: `1.5px solid ${LT.border}`, background: LT.surface, boxShadow: KP.shCard,
            fontSize: 13.5, fontWeight: 800, color: LT.blue,
          }}
        >
          <Plus size={16} /> Agregar fase
        </button>
      )}
    </div>
  );
}

/** Cuántas sesiones de una fase están hechas, sin contar descansos. */
function cuentaDe(fase, hecha) {
  let hechas = 0;
  let total = 0;
  (fase.weekData ?? []).forEach((w) => (w.days ?? []).forEach((d, i) => {
    if (esDescanso(d)) return;
    total += 1;
    if (hecha?.(fase.id, w.num, i)) hechas += 1;
  }));
  return { hechas, total };
}
