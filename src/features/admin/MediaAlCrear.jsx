import { useState } from 'react';
import { Link as LinkIcon, Trash2, Plus, Users, Mars, Venus, ChevronDown } from 'lucide-react';
import { DosBotonesDeGrabar, FilaDeTres, PanelDeLiga, PastillaDeProposito, SelectorDeProposito } from '@/features/admin/AgregarMedia';
import { avisoDeLiga, ligaExterna } from '@/lib/videos';
import { EJEMPLO, esExplicacion, explicacionesPrimero } from '@/lib/proposito';
import Portada from '@/components/Portada';
import IconoExplicacion from '@/components/IconoExplicacion';
import { T, FONT, KP } from '@/lib/theme';

/**
 * Las fotos y los videos de un ejercicio que TODAVÍA NO EXISTE.
 *
 * POR QUÉ ES UNA PANTALLA APARTE Y NO LA DE SIEMPRE.
 * Andrés, 18 sep 2026: "imagínate que eres el coach que está creando el
 * ejercicio, estás cansado, te está pegando el sol, necesitas poner el tripié
 * y grabar un video rápido, y aquí ni siquiera te está dando la opción para
 * grabar". Ahí había un párrafo gris que decía "guarda el ejercicio y podrás
 * agregarle fotos y videos" — o sea: crea la ficha entera, sal, búscalo otra
 * vez, y ahora sí graba.
 *
 * Escogió la maqueta A de tres, con tres correcciones suyas, y las tres están
 * aquí: (1) la FOTO cuenta igual que el video, (2) cada archivo decide si es
 * para todos, para hombres o para mujeres, (3) se puede crear SIN nada.
 *
 * DÓNDE ACABA CADA ARCHIVO, que es lo que obliga a que esto funcione así.
 * Un ejercicio guarda su foto y su video "para todos" en dos columnas suyas
 * (`cover_image_url`, `video_url`), y esas columnas NO tienen género. Las
 * versiones por género son filas de `exercise_media`, y esa tabla necesita un
 * `exercise_id` — o sea, necesita que el ejercicio ya exista.
 *
 * Por eso aquí no se guarda nada: se sube el archivo y se apunta en una lista
 * que vive en el formulario. Al tocar "Crear ejercicio", `ExercisesPanel`
 * reparte: los ejemplos "para todos" van a las columnas, y el resto (las
 * explicaciones, otros ángulos, las versiones por género) se inserta en
 * `exercise_media` en cuanto el ejercicio tiene id.
 *
 * "PARA TODOS" VIENE PUESTO Y NO SE PREGUNTA NADA.
 * Se le ofreció a Andrés preguntarle a quién va justo al terminar de grabar y
 * dijo que no: "la pastilla está bien". Tiene razón para el caso que describió
 * — un paso más con el sol encima es un paso que estorba.
 *
 * EJEMPLO O EXPLICACIÓN (Andrés, 7 oct 2026). Son DOS BOTONES IGUALES de grabar
 * (ver `AgregarMedia`): el que se toca ya dice qué es, así que tampoco se
 * pregunta. Solo un video del carrete o de una liga pregunta, porque nadie lo
 * ha dicho. Y si el coach se equivocó de botón, la pastilla del video en la
 * lista lo cambia.
 */

const GRUPOS = [
  { g: '', et: 'Para todos', corto: 'Todos', Icono: Users },
  { g: 'h', et: 'Hombres', corto: 'Hombres', Icono: Mars },
  { g: 'm', et: 'Mujeres', corto: 'Mujeres', Icono: Venus },
];

const clave = () => `n-${Math.random().toString(36).slice(2, 9)}`;

export default function MediaAlCrear({ nuevos, onNuevos }) {
  const [abierto, setAbierto] = useState(null);   // archivo con el menú de "para quién" desplegado
  const [abiertoTipo, setAbiertoTipo] = useState(null); // archivo con el menú de «ejemplo / explicación» desplegado
  const [agregando, setAgregando] = useState(false); // los botones, cuando ya hay algo
  const [ligaAbierta, setLigaAbierta] = useState(false);
  const [err, setErr] = useState('');

  const suma = (datos) => {
    if (!datos?.url) { setErr('No se pudo subir el archivo.'); return; }
    setErr('');
    setAgregando(false);
    onNuevos([...nuevos, { key: clave(), genero: '', proposito: EJEMPLO, ...datos }]);
  };

  const quita = (k) => onNuevos(nuevos.filter((m) => m.key !== k));
  const aQuien = (k, genero) => {
    onNuevos(nuevos.map((m) => (m.key === k ? { ...m, genero } : m)));
    setAbierto(null);
  };
  const queEs = (k, proposito) => {
    onNuevos(nuevos.map((m) => (m.key === k ? { ...m, proposito } : m)));
    setAbiertoTipo(null);
  };

  function guardaLiga(texto, proposito) {
    const aviso = avisoDeLiga(texto);
    if (aviso) { setErr(aviso); return; }
    setLigaAbierta(false);
    setErr('');
    suma({ url: texto, tipo: 'video', proposito });
  }

  // Las explicaciones primero: es el orden en que las ve el atleta.
  const lista = explicacionesPrimero(nuevos);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>Fotos y videos</span>

      {lista.map((m) => (
        <Ficha
          key={m.key}
          item={m}
          abierto={abierto === m.key}
          onAbrir={() => { setAbierto(abierto === m.key ? null : m.key); setAbiertoTipo(null); }}
          onAQuien={(g) => aQuien(m.key, g)}
          abiertoTipo={abiertoTipo === m.key}
          onAbrirTipo={() => { setAbiertoTipo(abiertoTipo === m.key ? null : m.key); setAbierto(null); }}
          onQueEs={(p) => queEs(m.key, p)}
          onQuitar={() => quita(m.key)}
        />
      ))}

      {nuevos.length === 0 || agregando ? (
        <>
          {/* LOS DOS BOTONES, iguales. Lo que el coach viene a hacer ocupa media pantalla. */}
          <DosBotonesDeGrabar onAjustes={suma} compacto={nuevos.length > 0} />
          <FilaDeTres onAjustes={suma} onLiga={() => { setLigaAbierta(true); setErr(''); }} />
        </>
      ) : (
        <button
          type="button"
          onClick={() => setAgregando(true)}
          className="kp-press"
          /* Sin contorno punteado: "haces mucho ese estilo de botones, no me
             gusta" (Andrés, 28 sep 2026). */
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 46,
            border: `1.5px solid ${T.border}`, background: T.bg2, borderRadius: 14, cursor: 'pointer',
            boxShadow: KP.shCard, fontFamily: FONT, fontSize: 13.5, fontWeight: 800, color: T.accent,
          }}
        >
          <Plus size={16} /> Agregar otro ángulo o versión
        </button>
      )}

      {ligaAbierta && <PanelDeLiga onGuarda={guardaLiga} onCancela={() => { setLigaAbierta(false); setErr(''); }} error={err} />}

      {/* LA TERCERA CORRECCIÓN, dicha con todas sus letras: no hace falta nada
          de esto para crear el ejercicio. */}
      <div style={{ fontSize: 11.5, color: T.text3, fontWeight: 600, lineHeight: 1.5 }}>
        {nuevos.length
          ? 'Se guardan al crear el ejercicio.'
          : 'Con el nombre basta. El video se puede grabar después.'}
      </div>

      {err && !ligaAbierta && (
        <div style={{
          background: 'rgba(220,38,38,0.08)', color: T.danger, borderRadius: 11,
          padding: '10px 12px', fontSize: 12.5, fontWeight: 700,
        }}>
          {err}
        </div>
      )}
    </div>
  );
}

/** Un archivo ya subido: qué es, para quién va, y cómo quitarlo. */
function Ficha({ item, abierto, onAbrir, onAQuien, abiertoTipo, onAbrirTipo, onQueEs, onQuitar }) {
  const esVideo = item.tipo === 'video';
  const explicacion = esVideo && esExplicacion(item);
  const liga = ligaExterna(item.url);
  const grupo = GRUPOS.find((x) => x.g === (item.genero || '')) ?? GRUPOS[0];

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 9,
      background: T.bg, border: `1px solid ${T.border}`, borderRadius: 14, padding: 9,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{
          width: 52, height: 52, borderRadius: 11, overflow: 'hidden', flexShrink: 0,
          background: '#0E1015', display: 'grid', placeItems: 'center',
        }}>
          {liga ? <LinkIcon size={19} color="#8A93A3" /> : esVideo ? (
            // El fotograma de la mitad, como la portada (ver `Portada`).
            <Portada video={item.url} style={{ width: '100%', height: '100%' }} />
          ) : (
            <img src={item.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          )}
        </span>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13.5, fontWeight: 700, color: T.text }}>
            {explicacion && <IconoExplicacion size={15} color={T.accent} />}
            {liga ? liga.de : esVideo ? 'Video' : 'Foto'}
          </div>
          {/* LAS PASTILLAS. Cada una es el control entero: se toca y se elige. Vienen con «Para todos» y
              «Ejemplo» puestos, y nadie está obligado a tocarlas. */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
            <button
              type="button"
              onClick={onAbrir}
              aria-expanded={abierto}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                minHeight: 26, padding: '0 9px 0 10px', borderRadius: 999, cursor: 'pointer',
                border: `1px solid ${item.genero ? T.accent : T.borderHi}`,
                background: item.genero ? T.accentBg : T.bg2,
                color: item.genero ? T.accent : T.text2,
                fontFamily: FONT, fontSize: 11.5, fontWeight: 700,
              }}
            >
              <grupo.Icono size={12} />
              {grupo.corto}
              <ChevronDown size={11} />
            </button>
            {esVideo && <PastillaDeProposito valor={item.proposito} abierta={abiertoTipo} onToggle={onAbrirTipo} />}
          </div>
        </div>

        <button
          type="button"
          onClick={onQuitar}
          aria-label={esVideo ? 'Quitar el video' : 'Quitar la foto'}
          style={{
            border: 'none', background: 'transparent', cursor: 'pointer', padding: 7,
            flexShrink: 0, color: T.danger,
          }}
        >
          <Trash2 size={16} />
        </button>
      </div>

      {abierto && (
        <div style={{ display: 'flex', gap: 6 }}>
          {GRUPOS.map((o) => {
            const aqui = o.g === (item.genero || '');
            return (
              <button
                key={o.g || 'todos'}
                type="button"
                onClick={() => onAQuien(o.g)}
                aria-pressed={aqui}
                style={{
                  flex: 1, minHeight: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  borderRadius: 11, cursor: 'pointer', fontFamily: FONT, fontSize: 13, fontWeight: 800,
                  border: `1.5px solid ${aqui ? T.accent : T.border}`, background: aqui ? T.accentBg : T.bg2,
                  color: aqui ? T.accent : T.text2,
                }}
              >
                <o.Icono size={14} /> {o.corto}
              </button>
            );
          })}
        </div>
      )}

      {abiertoTipo && <SelectorDeProposito valor={item.proposito} onCambia={onQueEs} />}
    </div>
  );
}
