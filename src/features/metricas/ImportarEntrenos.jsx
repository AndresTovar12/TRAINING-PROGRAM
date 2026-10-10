import { useMemo, useRef, useState } from 'react';
import { CircleAlert, CircleCheck, ChevronDown, FileUp, Loader2, Watch, X } from 'lucide-react';
import { LT, KP, FONT, NUM_STYLE, eyebrow } from '@/lib/theme';
import { useAuth } from '@/contexts/AuthContext';
import { guardaImportacion } from '@/lib/metricasApi';
import { separaRepetidos } from '@/lib/metricas/construye';
import { nombreDelDeporte } from '@/lib/metricas/deportes';
import { diaLocal, sumaDias } from '@/lib/metricas/forma';
import { diaCorto, distanciaTexto, duracionTexto, fechaCorta } from '@/lib/metricas/formato';
import { leeEnSegundoPlano } from './leeEnSegundoPlano';
import { BarraFija, Boton, MosaicoDeDeporte, Tarjeta } from './Piezas';

/* IMPORTAR ENTRENOS: el atleta (o su coach) suelta aquí los archivos del reloj y la app los lee, enseña lo que encontró y, si se confirma, lo guarda.
   Andrés (10 oct 2026): «especialmente con el Apple Watch». Sin la app instalable, la forma de traer lo del Apple Watch es el export de Apple Salud; con la app,
   esto lo hará HealthKit solo. Todo se lee EN ESTE aparato: lo que se sube a la base son los resúmenes y las series reducidas, no los archivos. */

const pesoTexto = (b) => (b >= 1e9 ? `${(b / 1e9).toFixed(1)} GB` : b >= 1e6 ? `${Math.round(b / 1e6)} MB` : `${Math.max(1, Math.round(b / 1e3))} KB`);

const ALCANCES = [
  { id: 90, titulo: 'Últimos 3 meses' }, { id: 365, titulo: 'Último año' }, { id: 0, titulo: 'Todo' },
];

function Ayuda({ titulo, children }) {
  const [abierta, setAbierta] = useState(false);
  return (
    <div style={{ borderTop: `1px solid ${KP.line}` }}>
      <button
        type="button" onClick={() => setAbierta((a) => !a)} aria-expanded={abierta}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '13px 2px', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: FONT, fontSize: 14.5, fontWeight: 800, color: LT.text, textAlign: 'left', touchAction: 'manipulation' }}
      >
        <span style={{ flex: 1 }}>{titulo}</span>
        <ChevronDown size={16} color={LT.text3} style={{ transform: abierta ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>
      {abierta && <div style={{ padding: '0 2px 14px', fontSize: 14, lineHeight: 1.55, fontWeight: 500, color: LT.text2 }}>{children}</div>}
    </div>
  );
}

const Paso = ({ n, children }) => (
  <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
    <span style={{ width: 22, height: 22, borderRadius: 11, flexShrink: 0, display: 'grid', placeItems: 'center', background: KP.blueSoft, color: LT.blue, fontSize: 12, fontWeight: 800 }}>{n}</span>
    <span>{children}</span>
  </div>
);

function Barra({ avance, texto }) {
  return (
    <div>
      <div role="progressbar" aria-valuenow={Math.round(avance * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={texto} style={{ height: 10, borderRadius: 5, background: LT.surface2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.max(2, Math.round(avance * 100))}%`, borderRadius: 5, background: `linear-gradient(90deg, ${KP.blue}, ${KP.blueDk})`, transition: 'width 0.2s' }} />
      </div>
      <div style={{ marginTop: 8, fontSize: 13.5, fontWeight: 600, color: LT.text2, ...NUM_STYLE }}>{texto}</div>
    </div>
  );
}

export default function ImportarEntrenos({ atletaId, actividades, esAtleta, alTerminar, alCancelar }) {
  const { user } = useAuth();
  const entrada = useRef(null);
  const lector = useRef(null);
  const [paso, setPaso] = useState('elegir'); // elegir · leyendo · revisar · guardando · listo
  const [archivos, setArchivos] = useState([]);
  const [alcance, setAlcance] = useState(365);
  const [avance, setAvance] = useState({ leidos: 0, total: 1, archivo: '', entrenos: 0 });
  const [guardado, setGuardado] = useState({ hechos: 0, total: 0, parte: '', hechosParte: 0, totalParte: 0 });
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState(null);
  const [final, setFinal] = useState(null);
  const [arrastrando, setArrastrando] = useState(false);

  const agrega = (lista) => {
    setError(null);
    setArchivos((previos) => {
      const claves = new Set(previos.map((f) => `${f.name}:${f.size}`));
      return [...previos, ...Array.from(lista).filter((f) => !claves.has(`${f.name}:${f.size}`))];
    });
  };
  const grande = archivos.some((f) => f.size > 30e6);
  const total = archivos.reduce((s, f) => s + f.size, 0);

  async function lee() {
    setError(null);
    setPaso('leyendo');
    setAvance({ leidos: 0, total: total || 1, archivo: archivos[0]?.name ?? '', entrenos: 0 });
    const desde = alcance > 0 ? sumaDias(diaLocal(Date.now(), -new Date().getTimezoneOffset()), -alcance) : null;
    // El avance de cada archivo se suma al de los que ya terminaron, para que la barra sea una sola.
    const terminados = new Map();
    const l = leeEnSegundoPlano(archivos, { desde }, (p) => {
      terminados.set(p.archivo, p.leidos);
      const suma = [...terminados.values()].reduce((s, v) => s + v, 0);
      setAvance({ leidos: Math.min(suma, total), total: total || 1, archivo: p.archivo, entrenos: p.entrenos });
    });
    lector.current = l;
    try {
      const res = await l.promesa;
      setResultado(res);
      setPaso('revisar');
    } catch (e) {
      if (/cancelada/.test(e?.message ?? '')) { setPaso('elegir'); return; }
      setError(e?.message ?? 'No se pudieron leer los archivos');
      setPaso('elegir');
    } finally {
      lector.current = null;
    }
  }

  const { nuevos, repetidos } = useMemo(() => (resultado ? separaRepetidos(resultado.entrenos, actividades) : { nuevos: [], repetidos: [] }), [resultado, actividades]);
  const porDeporte = useMemo(() => {
    const m = new Map();
    nuevos.forEach((e) => m.set(e.deporte, (m.get(e.deporte) ?? 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [nuevos]);
  // De qué día a qué día son los entrenos nuevos (hora local de cada uno), para que se vea de un vistazo si es lo que se esperaba.
  const rango = useMemo(() => {
    const dias = nuevos.map((e) => diaLocal(e.inicio, e.desfase_min ?? -new Date().getTimezoneOffset())).filter(Boolean).sort();
    return dias.length ? { desde: dias[0], hasta: dias[dias.length - 1] } : null;
  }, [nuevos]);

  async function guarda() {
    setError(null);
    setPaso('guardando');
    setGuardado({ hechos: 0, total: 0, parte: '', hechosParte: 0, totalParte: 0 });
    try {
      const r = await guardaImportacion({
        atletaId, subidoPor: user?.id, resultado: { ...resultado, entrenos: nuevos },
        desfaseMin: -new Date().getTimezoneOffset(), alAvance: (a) => setGuardado({ hechos: a.hechos, total: a.total, parte: a.parte, hechosParte: a.hechosParte, totalParte: a.totalParte }),
      });
      setFinal(r);
      setPaso('listo');
    } catch (e) {
      setError(e?.message ?? 'No se pudo guardar');
      setPaso('revisar');
    }
  }

  /* ---------------------------------------------------------------- */

  if (paso === 'leyendo') {
    return (
      <Tarjeta style={{ marginTop: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <Loader2 size={20} className="spin" color={LT.blue} />
          <div style={{ fontSize: 17, fontWeight: 800, color: LT.text }}>Leyendo los archivos…</div>
        </div>
        <Barra avance={avance.leidos / (avance.total || 1)} texto={`${pesoTexto(avance.leidos)} de ${pesoTexto(avance.total)}${avance.entrenos ? ` · ${avance.entrenos} entrenos encontrados` : ''}`} />
        <div style={{ marginTop: 14, fontSize: 13, fontWeight: 600, color: LT.text3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{avance.archivo}</div>
        <div style={{ marginTop: 16 }}><Boton pequeno onClick={() => lector.current?.cancela()}>Cancelar</Boton></div>
      </Tarjeta>
    );
  }

  if (paso === 'guardando') {
    return (
      <Tarjeta style={{ marginTop: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <Loader2 size={20} className="spin" color={LT.blue} />
          <div style={{ fontSize: 17, fontWeight: 800, color: LT.text }}>Guardando…</div>
        </div>
        <Barra avance={guardado.total ? guardado.hechos / guardado.total : 0} texto={guardado.total ? `Guardando ${guardado.parte}: ${guardado.hechosParte} de ${guardado.totalParte}` : 'Preparando lo que se va a guardar…'} />
        <div style={{ marginTop: 12, fontSize: 13.5, fontWeight: 500, color: LT.text2 }}>No cierres esta pantalla hasta que termine.</div>
      </Tarjeta>
    );
  }

  if (paso === 'listo') {
    return (
      <Tarjeta style={{ marginTop: 6, textAlign: 'center', padding: '28px 18px' }}>
        <span style={{ width: 60, height: 60, borderRadius: 20, display: 'inline-grid', placeItems: 'center', background: KP.mintSoft, color: KP.mint, marginBottom: 14 }}><CircleCheck size={30} /></span>
        <div style={{ fontSize: 20, fontWeight: 800, color: LT.text, marginBottom: 6 }}>Listo</div>
        <div style={{ fontSize: 15, lineHeight: 1.5, fontWeight: 500, color: LT.text2, marginBottom: 18 }}>
          Se {final.nuevos === 1 ? 'agregó 1 entreno' : `agregaron ${final.nuevos} entrenos`}
          {final.dias ? ` y ${final.dias} días de recuperación` : ''}
          {repetidos.length ? `. ${repetidos.length === 1 ? '1 ya estaba y no se repitió' : `${repetidos.length} ya estaban y no se repitieron`}` : ''}.
        </div>
        <Boton principal onClick={alTerminar}>Ver los entrenos</Boton>
      </Tarjeta>
    );
  }

  if (paso === 'revisar' && resultado) {
    const vacio = nuevos.length === 0 && resultado.recuperacion.length === 0;
    return (
      <div>
        <Tarjeta style={{ marginTop: 6 }}>
          <div style={eyebrow(LT.text2)}>Esto es lo que encontré</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 14, margin: '14px 0 4px' }}>
            {[[nuevos.length, nuevos.length === 1 ? 'entreno nuevo' : 'entrenos nuevos', LT.blue], [repetidos.length, 'ya estaban', LT.text2], [resultado.recuperacion.length, 'días de recuperación', LT.text]].map(([v, e, c]) => (
              <div key={e}><div style={{ fontSize: 30, fontWeight: 800, color: c, letterSpacing: -0.8, lineHeight: 1.05, ...NUM_STYLE }}>{v}</div><div style={{ fontSize: 12.5, fontWeight: 600, color: LT.text2, marginTop: 4 }}>{e}</div></div>
            ))}
          </div>
          {porDeporte.length > 0 && <div style={{ marginTop: 12, fontSize: 13.5, fontWeight: 600, color: LT.text2 }}>{porDeporte.map(([d, n]) => `${n} ${nombreDelDeporte(d).toLowerCase()}`).join(' · ')}</div>}
          {rango && <div style={{ marginTop: 4, fontSize: 13.5, fontWeight: 600, color: LT.text2, ...NUM_STYLE }}>{rango.desde === rango.hasta ? `El ${diaCorto(rango.desde)}` : `Del ${diaCorto(rango.desde)} al ${diaCorto(rango.hasta)}`}</div>}
        </Tarjeta>
        {nuevos.slice(0, 6).length > 0 && (
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {nuevos.slice(0, 6).map((e) => (
              <div key={`${e.inicio}-${e.duracion_s}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 14, background: LT.surface, border: `1px solid ${KP.line}` }}>
                <MosaicoDeDeporte deporte={e.deporte} size={34} />
                <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 700, color: LT.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.titulo || nombreDelDeporte(e.deporte)}</span>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: LT.text2, ...NUM_STYLE }}>{fechaCorta(e.inicio, e.desfase_min ?? -new Date().getTimezoneOffset())} · {duracionTexto(e.duracion_s)}{e.distancia_m >= 100 ? ` · ${distanciaTexto(e.distancia_m)}` : ''}</span>
              </div>
            ))}
            {nuevos.length > 6 && <div style={{ fontSize: 13, fontWeight: 600, color: LT.text3, padding: '2px 4px' }}>y {nuevos.length - 6} más</div>}
          </div>
        )}
        {resultado.ignorados.length > 0 && (
          <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 14, background: KP.amberSoft, color: LT.text }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13.5, fontWeight: 800 }}><CircleAlert size={15} color={KP.amber} /> {resultado.ignorados.length} {resultado.ignorados.length === 1 ? 'archivo no se pudo leer' : 'archivos no se pudieron leer'}</div>
            <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 12.5, fontWeight: 500, lineHeight: 1.5, color: LT.text2 }}>
              {resultado.ignorados.slice(0, 5).map((i, k) => <li key={k} style={{ overflowWrap: 'anywhere' }}><b>{i.nombre}</b>: {i.motivo}</li>)}
              {resultado.ignorados.length > 5 && <li>y {resultado.ignorados.length - 5} más</li>}
            </ul>
          </div>
        )}
        {vacio && <div style={{ marginTop: 12, fontSize: 14.5, fontWeight: 500, color: LT.text2, lineHeight: 1.5 }}>No hay nada nuevo que guardar{repetidos.length ? ': todo lo de estos archivos ya estaba' : ''}. Si esperabas más, prueba con «Todo» en lugar de un periodo corto.</div>}
        {error && <div role="alert" style={{ marginTop: 12, padding: '10px 12px', borderRadius: 12, background: KP.dangerSoft, color: KP.danger, fontSize: 13.5, fontWeight: 700 }}>{error}</div>}
        <BarraFija>
          {!vacio && <Boton principal onClick={guarda}>{nuevos.length ? `Guardar ${nuevos.length} ${nuevos.length === 1 ? 'entreno' : 'entrenos'}` : 'Guardar la recuperación'}</Boton>}
          <Boton principal={vacio} onClick={() => { setResultado(null); setPaso('elegir'); }}>Cambiar archivos</Boton>
        </BarraFija>
      </div>
    );
  }

  // Elegir archivos.
  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }} onDragLeave={() => setArrastrando(false)}
        onDrop={(e) => { e.preventDefault(); setArrastrando(false); agrega(e.dataTransfer.files); }}
        style={{ marginTop: 6, padding: '26px 18px', borderRadius: 20, textAlign: 'center', border: `2px dashed ${arrastrando ? LT.blue : LT.borderHi}`, background: arrastrando ? KP.blueSoft : LT.surface }}
      >
        <span style={{ width: 52, height: 52, borderRadius: 17, display: 'inline-grid', placeItems: 'center', background: KP.blueSoft, color: LT.blue, marginBottom: 12 }}><Watch size={26} /></span>
        <div style={{ fontSize: 17, fontWeight: 800, color: LT.text, marginBottom: 6 }}>{esAtleta ? 'Trae tus entrenos del reloj' : 'Trae los entrenos de su reloj'}</div>
        <div style={{ fontSize: 14, lineHeight: 1.5, fontWeight: 500, color: LT.text2, maxWidth: 440, margin: '0 auto 16px' }}>
          Sirven los archivos .fit, .gpx y .tcx, el ZIP de Strava, y el export de Apple Salud (.zip) con el pulso del Apple Watch. Se leen en este aparato; no se sube el archivo.
        </div>
        <input ref={entrada} type="file" multiple hidden onChange={(e) => { agrega(e.target.files); e.target.value = ''; }} />
        <Boton principal icono={FileUp} onClick={() => entrada.current?.click()}>Elegir archivos</Boton>
      </div>

      {archivos.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {archivos.map((f) => (
              <div key={`${f.name}:${f.size}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 14, background: LT.surface, border: `1px solid ${KP.line}` }}>
                <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 700, color: LT.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: LT.text3, ...NUM_STYLE }}>{pesoTexto(f.size)}</span>
                <button type="button" aria-label={`Quitar ${f.name}`} onClick={() => setArchivos((a) => a.filter((x) => x !== f))} style={{ width: 28, height: 28, borderRadius: 14, border: 'none', background: LT.surface2, color: LT.text2, cursor: 'pointer', display: 'grid', placeItems: 'center' }}><X size={14} /></button>
              </div>
            ))}
          </div>
          {grande && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: LT.text, marginBottom: 8 }}>Es un archivo grande: ¿cuánto traer?</div>
              <div role="group" aria-label="Cuánto traer" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {ALCANCES.map((a) => (
                  <button
                    key={a.id} type="button" aria-pressed={alcance === a.id} onClick={() => setAlcance(a.id)}
                    style={{ minHeight: 38, padding: '0 14px', borderRadius: 999, cursor: 'pointer', fontFamily: FONT, fontSize: 13.5, fontWeight: 800, touchAction: 'manipulation', border: `1.5px solid ${alcance === a.id ? LT.blue : LT.borderHi}`, background: alcance === a.id ? LT.blue : LT.surface, color: alcance === a.id ? '#fff' : LT.text }}
                  >
                    {a.titulo}
                  </button>
                ))}
              </div>
              <div style={{ marginTop: 8, fontSize: 12.5, fontWeight: 500, color: LT.text2, lineHeight: 1.5 }}>Leerlo puede tardar unos minutos. Si pesa más de 500 MB, es mejor hacerlo desde una computadora.</div>
            </div>
          )}
          {error && <div role="alert" style={{ marginTop: 12, padding: '10px 12px', borderRadius: 12, background: KP.dangerSoft, color: KP.danger, fontSize: 13.5, fontWeight: 700 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <Boton principal onClick={lee}>Leer {archivos.length === 1 ? 'el archivo' : `los ${archivos.length} archivos`}</Boton>
            <Boton onClick={alCancelar}>Cancelar</Boton>
          </div>
        </div>
      )}

      <div style={{ marginTop: 22 }}>
        <div style={{ ...eyebrow(LT.text2), marginBottom: 4 }}>¿De dónde saco los archivos?</div>
        <Ayuda titulo="Del Apple Watch (Apple Salud)">
          <Paso n={1}>En el iPhone abre <b>Salud</b> y toca tu foto, arriba a la derecha.</Paso>
          <Paso n={2}>Baja hasta <b>Exportar todos los datos de salud</b> y toca <b>Exportar</b>. Tarda unos minutos.</Paso>
          <Paso n={3}>Guárdalo en <b>Archivos</b> (o mándalo por AirDrop a la computadora) y elígelo aquí. Es un .zip: no lo abras.</Paso>
          <div style={{ marginTop: 10 }}>Trae los entrenos del Apple Watch con su pulso, y cada día el pulso en reposo, la HRV y el sueño.</div>
        </Ayuda>
        <Ayuda titulo="De Garmin, Polar, Suunto, COROS o Wahoo">
          Entra a la página de tu cuenta (Garmin Connect, Polar Flow, etc.), abre el entreno y busca <b>Exportar el original</b> o <b>Descargar .fit</b>. Puedes elegir varios archivos a la vez.
        </Ayuda>
        <Ayuda titulo="De Strava o TrainingPeaks">
          En Strava: <b>Configuración → Mi cuenta → Descargar o eliminar tu cuenta → Solicitar tu archivo</b>. Te llega un correo con un ZIP: elígelo aquí tal cual, con todos sus entrenos y sus nombres. TrainingPeaks permite exportar cada entreno como .fit o .tcx.
        </Ayuda>
        <div style={{ borderTop: `1px solid ${KP.line}` }} />
      </div>
    </div>
  );
}
