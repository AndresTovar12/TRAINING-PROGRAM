import { useState } from 'react';
import { Camera, Images, Link as LinkIcon, Trash2, Plus, Users, Mars, Venus, Check, ChevronDown, Video } from 'lucide-react';
import MediaUpload from '@/features/admin/MediaUpload';
import { ligaExterna } from '@/lib/videos';
import { T, FONT } from '@/lib/theme';

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
 * reparte: los "para todos" van a las columnas, y el resto se inserta en
 * `exercise_media` en cuanto el ejercicio tiene id.
 *
 * "PARA TODOS" VIENE PUESTO Y NO SE PREGUNTA NADA.
 * Se le ofreció a Andrés preguntarle a quién va justo al terminar de grabar y
 * dijo que no: "la pastilla está bien". Tiene razón para el caso que describió
 * — un paso más con el sol encima es un paso que estorba.
 */

const GRUPOS = [
  { g: '', et: 'Para todos', corto: 'Todos', Icono: Users, pista: 'Quien no tenga una versión propia' },
  { g: 'h', et: 'Hombres', corto: 'Hombres', Icono: Mars, pista: 'Solo lo verán ellos' },
  { g: 'm', et: 'Mujeres', corto: 'Mujeres', Icono: Venus, pista: 'Solo lo verán ellas' },
];

const clave = () => `n-${Math.random().toString(36).slice(2, 9)}`;

export default function MediaAlCrear({ nuevos, onNuevos }) {
  const [abierto, setAbierto] = useState(null);   // archivo con el menú de "para quién" desplegado
  const [agregando, setAgregando] = useState(false); // los botones, cuando ya hay algo
  const [ligaAbierta, setLigaAbierta] = useState(false);
  const [ligaTexto, setLigaTexto] = useState('');
  const [err, setErr] = useState('');
  const [arrastrando, setArrastrando] = useState(false);

  const suma = (datos) => {
    if (!datos?.url) { setErr('No se pudo subir el archivo.'); return; }
    setErr('');
    setAgregando(false);
    onNuevos([...nuevos, { key: clave(), genero: '', ...datos }]);
  };

  const quita = (k) => onNuevos(nuevos.filter((m) => m.key !== k));
  const aQuien = (k, genero) => {
    onNuevos(nuevos.map((m) => (m.key === k ? { ...m, genero } : m)));
    setAbierto(null);
  };

  function guardaLiga() {
    const texto = ligaTexto.trim();
    if (!ligaExterna(texto)) {
      setErr('Eso no parece una dirección de video. Copia la liga completa desde la app.');
      return;
    }
    setLigaAbierta(false);
    setLigaTexto('');
    suma({ url: texto, tipo: 'video' });
  }

  /* Los tres botones chicos. Siempre los mismos, cambia solo si hay un
     "Grabar" enorme encima o no. */
  const menudos = (conGrabar) => (
    <div style={{ display: 'flex', gap: 8 }}>
      {conGrabar && (
        <MediaUpload
          accept="video/*" kind="videos" value="" onChange={() => {}}
          onAjustes={suma}
          botones={({ camara, carrete, busy, enTelefono }) => (
            <button type="button" onClick={enTelefono ? camara : carrete} disabled={busy} style={chico}>
              <Video size={20} color={T.text} />
              <span style={textoChico}>{busy ? 'Subiendo…' : 'Grabar'}</span>
            </button>
          )}
        />
      )}
      <MediaUpload
        accept="image/*" kind="covers" value="" onChange={() => {}}
        onAjustes={suma}
        botones={({ camara, carrete, busy, enTelefono }) => (
          <button type="button" onClick={enTelefono ? camara : carrete} disabled={busy} style={chico}>
            <Camera size={20} color={T.text} />
            <span style={textoChico}>{busy ? 'Subiendo…' : enTelefono ? 'Tomar foto' : 'Foto'}</span>
          </button>
        )}
      />
      <MediaUpload
        accept="image/*,video/*" kind="videos" value="" onChange={() => {}}
        onAjustes={suma}
        botones={({ carrete, busy }) => (
          <button type="button" onClick={carrete} disabled={busy} style={chico}>
            <Images size={20} color={T.text2} />
            <span style={textoChico}>{busy ? 'Subiendo…' : 'Del carrete'}</span>
          </button>
        )}
      />
      <button type="button" onClick={() => setLigaAbierta(true)} style={chico}>
        <LinkIcon size={20} color={T.text2} />
        <span style={textoChico}>Pegar liga</span>
      </button>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <span style={{ fontSize: 12.5, fontWeight: 700, color: T.text2 }}>Fotos y videos</span>

      {nuevos.map((m) => (
        <Ficha
          key={m.key}
          item={m}
          abierto={abierto === m.key}
          onAbrir={() => setAbierto(abierto === m.key ? null : m.key)}
          onAQuien={(g) => aQuien(m.key, g)}
          onQuitar={() => quita(m.key)}
        />
      ))}

      {nuevos.length === 0 ? (
        <>
          {/* EL BOTÓN GRANDE. Es la maqueta A tal cual: lo que el coach viene a
              hacer ocupa media pantalla, y lo demás cabe debajo en una fila. */}
          <MediaUpload
            accept="video/*" kind="videos" value="" onChange={() => {}}
            onAjustes={suma}
            botones={({ camara, carrete, suelta, busy, enTelefono }) => (
              <button
                type="button"
                onClick={enTelefono ? camara : carrete}
                disabled={busy}
                className="kp-press"
                /* Soltar el archivo encima. En la compu es el gesto natural y
                   la pantalla ya lo ofrecía por escrito: sin esto era una
                   promesa falsa. `onDragOver` con `preventDefault` es
                   obligatorio — sin él el navegador se queda el archivo y abre
                   el video en una pestaña, tirando el formulario a medias. */
                onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }}
                onDragLeave={() => setArrastrando(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setArrastrando(false);
                  suelta(e.dataTransfer?.files?.[0]);
                }}
                style={{
                  width: '100%', border: 'none', cursor: busy ? 'default' : 'pointer', padding: '30px 16px',
                  background: `linear-gradient(150deg, ${T.accent}, ${T.accentDk})`,
                  borderRadius: 22, display: 'flex', flexDirection: 'column', alignItems: 'center',
                  gap: 14, fontFamily: FONT, opacity: busy ? 0.75 : 1,
                  boxShadow: arrastrando
                    ? '0 0 0 4px rgba(30,64,224,0.35), 0 10px 26px rgba(30,64,224,0.30)'
                    : '0 10px 26px rgba(30,64,224,0.30)',
                  transform: arrastrando ? 'scale(1.01)' : 'none',
                  transition: 'box-shadow .15s, transform .15s',
                }}
              >
                <span style={{
                  width: 72, height: 72, borderRadius: 24, background: 'rgba(255,255,255,0.16)',
                  display: 'grid', placeItems: 'center',
                }}>
                  <Video size={34} color="#fff" />
                </span>
                <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                  <span style={{ fontSize: 20, fontWeight: 800, color: '#fff', letterSpacing: -0.4 }}>
                    {busy ? 'Subiendo…' : enTelefono ? 'Grabar el ejercicio' : 'Elegir el video'}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.80)' }}>
                    {arrastrando ? 'Suéltalo aquí'
                      : enTelefono ? 'Ponlo en el tripié y dale'
                      : 'O arrástralo aquí desde tu compu'}
                  </span>
                </span>
              </button>
            )}
          />
          {menudos(false)}
        </>
      ) : agregando ? (
        menudos(true)
      ) : (
        <button
          type="button"
          onClick={() => setAgregando(true)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 46,
            border: `1px dashed ${T.borderHi}`, background: T.bg2, borderRadius: 14, cursor: 'pointer',
            fontFamily: FONT, fontSize: 13.5, fontWeight: 700, color: T.accent,
          }}
        >
          <Plus size={16} /> Agregar otro ángulo o versión
        </button>
      )}

      {ligaAbierta && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <input
            autoFocus
            value={ligaTexto}
            onChange={(e) => setLigaTexto(e.target.value)}
            placeholder="https://www.tiktok.com/…"
            style={{
              minHeight: 46, boxSizing: 'border-box', padding: '0 13px', borderRadius: 12,
              border: `1.5px solid ${T.accent}`, background: T.bg2,
              fontFamily: FONT, fontSize: 14.5, fontWeight: 600, color: T.text,
            }}
          />
          <div style={{ display: 'flex', gap: 7 }}>
            <button
              type="button"
              onClick={() => { setLigaAbierta(false); setLigaTexto(''); setErr(''); }}
              style={{
                flex: 1, minHeight: 42, borderRadius: 11, border: `1px solid ${T.border}`,
                background: T.bg2, cursor: 'pointer', fontFamily: FONT, fontSize: 13.5,
                fontWeight: 700, color: T.text2,
              }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={guardaLiga}
              style={{
                flex: 1, minHeight: 42, borderRadius: 11, border: 'none',
                background: T.accent, cursor: 'pointer', fontFamily: FONT, fontSize: 13.5,
                fontWeight: 700, color: '#fff',
              }}
            >
              Agregar
            </button>
          </div>
        </div>
      )}

      {/* LA TERCERA CORRECCIÓN, dicha con todas sus letras: no hace falta nada
          de esto para crear el ejercicio. */}
      <div style={{ fontSize: 11.5, color: T.text3, fontWeight: 600, lineHeight: 1.5 }}>
        {nuevos.length
          ? 'Se guardan al crear el ejercicio.'
          : 'Con el nombre basta. El video se puede grabar después.'}
      </div>

      {err && (
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

const chico = {
  flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center',
  justifyContent: 'center', gap: 6, minHeight: 66, padding: '0 6px', borderRadius: 15,
  border: `1px solid ${T.border}`, background: T.bg2, cursor: 'pointer', fontFamily: FONT,
};
const textoChico = { fontSize: 12, fontWeight: 700, color: T.text, whiteSpace: 'nowrap' };

/** Un archivo ya subido: qué es, para quién va, y cómo quitarlo. */
function Ficha({ item, abierto, onAbrir, onAQuien, onQuitar }) {
  const esVideo = item.tipo === 'video';
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
            <video
              src={item.url} muted playsInline preload="metadata" tabIndex={-1} aria-hidden="true"
              onLoadedMetadata={(e) => { e.currentTarget.currentTime = 0.1; }}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          ) : (
            <img src={item.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          )}
        </span>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: T.text }}>
            {liga ? liga.de : esVideo ? 'Video' : 'Foto'}
          </div>
          {/* LA PASTILLA. Es el control entero: se toca y se elige. Viene con
              "Para todos" puesto y nadie está obligado a tocarla. */}
          <button
            type="button"
            onClick={onAbrir}
            aria-expanded={abierto}
            style={{
              marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 5,
              minHeight: 28, padding: '0 10px', borderRadius: 999, cursor: 'pointer',
              border: `1px solid ${item.genero ? T.accent : T.borderHi}`,
              background: item.genero ? T.accentBg : 'transparent',
              color: item.genero ? T.accent : T.text3,
              fontFamily: FONT, fontSize: 11.5, fontWeight: 700,
            }}
          >
            <grupo.Icono size={12} />
            {grupo.et}
            <ChevronDown size={12} />
          </button>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {GRUPOS.map((o) => {
            const aqui = o.g === (item.genero || '');
            return (
              <button
                key={o.g || 'todos'}
                type="button"
                onClick={() => onAQuien(o.g)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, minHeight: 52, padding: '0 11px',
                  borderRadius: 13, cursor: 'pointer', fontFamily: FONT, textAlign: 'left',
                  border: `1.5px solid ${aqui ? T.accent : T.border}`,
                  background: aqui ? T.accentBg : T.bg2,
                }}
              >
                <span style={{
                  width: 30, height: 30, borderRadius: 10, flexShrink: 0, display: 'grid',
                  placeItems: 'center', background: aqui ? T.accent : T.bg3,
                }}>
                  <o.Icono size={15} color={aqui ? '#fff' : T.text2} />
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13.5, fontWeight: 800, color: aqui ? T.accent : T.text }}>
                    {o.corto}
                  </span>
                  <span style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: T.text3, marginTop: 1 }}>
                    {o.pista}
                  </span>
                </span>
                {aqui && <Check size={17} color={T.accent} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
