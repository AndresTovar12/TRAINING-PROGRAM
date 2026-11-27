import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Check, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { FONT, KP, UI } from '@/lib/theme';
import HojaFlotante from '@/components/HojaFlotante';
import { Boton } from '@/components/ui';
import { datosDeEntrada, guardaEntrada } from '@/lib/compraApi';
import {
  diaCorto, diaLargo, entradaParaFecha, finDelPlan, hoyLocal, lunesDe, opcionesDeInicio, rangoDeFechaMeta,
} from '@/lib/entradaAlPlan';

/* ¿CUÁNDO EMPIEZAS? (encargo «Compra y dinero», 26 nov 2026; dibujos app-s6, app-s7 y web-5-cuando-*). Igual en la app y en la web, después de pagar y en «Volver a empezar».
   «Hoy, martes 24 · El lunes ya pasó; lo puedes hacer igual.» o «El lunes 30 de noviembre · Empiezas la semana completa.» (marcado). «Terminas el domingo 21 de febrero» y
   «Necesito terminar antes»: con su fecha entra en la semana que le toca, solo entre las que el coach permite, y contando desde el día de inicio ELEGIDO (`entradaAlPlan.js`).
   Sin tocar nada, semana 1. En una clase, un workout, una rutina semanal o un plan de 1 semana solo se elige el día. */

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

function Calendario({ desde, hasta, valor, alElegir }) {
  const [mes, setMes] = useState((valor ?? desde).slice(0, 7));
  const [a, m] = mes.split('-').map(Number);
  const primero = `${mes}-01`;
  const dias = new Date(Date.UTC(a, m, 0)).getUTCDate();
  const hueco = Math.round((Date.parse(`${primero}T00:00:00Z`) - Date.parse(`${lunesDe(primero)}T00:00:00Z`)) / 86400000);
  const mueve = (n) => { const d = new Date(Date.UTC(a, m - 1 + n, 1)); setMes(d.toISOString().slice(0, 7)); };
  const puedeAtras = mes > desde.slice(0, 7);
  const puedeAdelante = mes < hasta.slice(0, 7);
  const flecha = (activa) => ({ width: 40, height: 40, borderRadius: 12, border: 'none', background: 'none', color: activa ? KP.blue : KP.ink3, cursor: activa ? 'pointer' : 'default', display: 'grid', placeItems: 'center' });
  return (
    <div style={{ background: UI.tarjeta, borderRadius: UI.rTarjeta, padding: '12px 12px 16px', fontFamily: FONT }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <button type="button" aria-label="Mes anterior" disabled={!puedeAtras} onClick={() => mueve(-1)} style={flecha(puedeAtras)}><ChevronLeft size={22} /></button>
        <span style={{ fontSize: 17, fontWeight: 700 }}>{MESES[m - 1]} {a}</span>
        <button type="button" aria-label="Mes siguiente" disabled={!puedeAdelante} onClick={() => mueve(1)} style={flecha(puedeAdelante)}><ChevronRight size={22} /></button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', rowGap: 6, textAlign: 'center' }}>
        {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => <span key={i} style={{ fontSize: 13, fontWeight: 700, color: KP.ink2, padding: '6px 0' }}>{d}</span>)}
        {Array.from({ length: hueco }, (_, i) => <span key={`h${i}`} />)}
        {Array.from({ length: dias }, (_, i) => {
          const f = `${mes}-${String(i + 1).padStart(2, '0')}`;
          const se = f >= desde && f <= hasta;
          const elegido = f === valor;
          return (
            <button
              key={f} type="button" disabled={!se} onClick={() => alElegir(f)} aria-label={diaLargo(f)} aria-pressed={elegido}
              style={{ justifySelf: 'center', width: 42, height: 42, borderRadius: 99, border: 'none', cursor: se ? 'pointer' : 'default', fontFamily: FONT, fontSize: 17, fontWeight: 600, background: elegido ? KP.blue : 'transparent', color: elegido ? '#fff' : se ? KP.ink : KP.ink3 }}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const Marca = ({ activa }) => ( // estilo-ok: el círculo de una opción sin marcar
  <span aria-hidden="true" style={{ width: 30, height: 30, borderRadius: 99, flexShrink: 0, display: 'grid', placeItems: 'center', background: activa ? KP.blue : 'transparent', border: activa ? 'none' : `2px solid ${KP.lineHi}`, color: '#fff' }}>
    {activa && <Check size={17} strokeWidth={3} />}
  </span>
);

/**
 * `compraId`. `cabeza`: lo de arriba («Compra confirmada…»), lo pone quien la usa. `alListo()`: ya guardó. `boton`: el texto si no es «Empezar el …» (p. ej. al volver a empezar).
 */
export default function CuandoEmpiezas({ compraId, cabeza = null, alListo, alCerrar = null }) {
  const [d, setD] = useState(undefined);
  const [error, setError] = useState(null);
  const hoy = hoyLocal();
  const opciones = useMemo(() => opcionesDeInicio(hoy), [hoy]);
  const [inicio, setInicio] = useState(opciones.find((o) => o.porDefecto)?.fecha ?? hoy);
  const [fechaMeta, setFechaMeta] = useState(null);
  const [hoja, setHoja] = useState(false);
  const [borrador, setBorrador] = useState(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let vivo = true;
    datosDeEntrada(compraId).then((x) => { if (vivo) setD(x); }).catch((e) => { if (vivo) { setD(null); setError(e.message); } });
    return () => { vivo = false; };
  }, [compraId]);

  if (d === undefined) return <div role="status" style={{ display: 'flex', justifyContent: 'center', padding: 48, color: KP.ink2 }}><Loader2 size={22} className="spin" /></div>;
  if (d === null) return <div role="alert" style={{ padding: 20, fontFamily: FONT, color: KP.danger, fontWeight: 700 }}>{error}</div>;

  const total = d.total || 1;
  const conEntrada = !!d.con_entrada;
  const permitidas = d.permitidas?.length ? d.permitidas : [1];
  const entrada = conEntrada && fechaMeta ? entradaParaFecha({ total, permitidas, inicio, fecha: fechaMeta }) : null;
  const semana = entrada?.semana ?? 1;
  const fin = finDelPlan(inicio, total, semana);
  const rango = rangoDeFechaMeta(inicio, total);
  const previa = borrador ? entradaParaFecha({ total, permitidas, inicio, fecha: borrador }) : null;
  const elegida = opciones.find((o) => o.fecha === inicio) ?? opciones[0];
  const empezar = elegida.tipo === 'hoy' ? 'Empezar hoy' : `Empezar el ${diaCorto(inicio)}`;

  async function guarda() {
    setGuardando(true);
    setError(null);
    try {
      await guardaEntrada(compraId, { inicio, semana, fechaMeta: entrada ? fechaMeta : null });
      alListo?.();
    } catch (e) { setError(e.message); setGuardando(false); }
  }

  const fila = { display: 'flex', alignItems: 'center', gap: 14, width: '100%', padding: '16px 18px', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', fontFamily: FONT, color: KP.ink };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: FONT, color: KP.ink }}>
      {cabeza}
      <h2 style={{ margin: '4px 4px 0', fontSize: 20, fontWeight: 800 }}>¿Cuándo empiezas?</h2>
      <div style={{ background: UI.tarjeta, borderRadius: UI.rTarjeta, boxShadow: UI.sombraGrupo, overflow: 'hidden' }}>
        {opciones.map((o, i) => (
          <button key={o.tipo} type="button" role="radio" aria-checked={inicio === o.fecha} onClick={() => setInicio(o.fecha)} style={{ ...fila, borderTop: i ? `1px solid ${UI.hilo}` : 'none' }}>
            <span style={{ flex: 1 }}>
              <span style={{ display: 'block', fontSize: 18, fontWeight: inicio === o.fecha ? 700 : 500 }}>{o.tipo === 'hoy' ? `Hoy, ${diaCorto(o.fecha)}` : `El ${diaLargo(o.fecha)}`}</span>
              <span style={{ display: 'block', fontSize: 15, fontWeight: 500, color: KP.ink2 }}>{o.aMitad ? 'El lunes ya pasó; lo puedes hacer igual.' : 'Empiezas la semana completa.'}</span>
            </span>
            <Marca activa={inicio === o.fecha} />
          </button>
        ))}
      </div>
      {conEntrada && (
        <div style={{ background: UI.tarjeta, borderRadius: UI.rTarjeta, boxShadow: UI.sombraGrupo, overflow: 'hidden' }}>
          <div style={{ ...fila, cursor: 'default' }}>
            <span style={{ width: 44, height: 44, borderRadius: 13, background: UI.relleno, display: 'grid', placeItems: 'center' }}><CalendarDays size={20} color={KP.ink2} /></span>
            <span style={{ flex: 1 }}>
              <span style={{ display: 'block', fontSize: 17, fontWeight: 600 }}>Terminas el {diaLargo(fin)}</span>
              {entrada && <span style={{ display: 'block', fontSize: 15, fontWeight: 500, color: KP.ink2 }}>Entras en la semana {semana} de {total}.</span>}
            </span>
          </div>
          {entrada ? (
            <button type="button" onClick={() => setFechaMeta(null)} style={{ ...fila, borderTop: `1px solid ${UI.hilo}`, color: KP.danger, fontSize: 17, fontWeight: 600 }}>Quitar fecha</button>
          ) : (
            <button type="button" onClick={() => { setBorrador(null); setHoja(true); }} style={{ ...fila, borderTop: `1px solid ${UI.hilo}`, color: KP.blue, fontSize: 17, fontWeight: 600 }}>
              <span style={{ flex: 1 }}>Necesito terminar antes</span><ChevronRight size={20} color={KP.ink3} />
            </button>
          )}
        </div>
      )}
      <p style={{ margin: '0 6px', fontSize: 14.5, fontWeight: 500, color: KP.ink2 }}>Lo puedes cambiar después en Mis planes.</p>
      {error && <div role="alert" style={{ background: KP.dangerSoft, color: KP.danger, borderRadius: 14, padding: '12px 14px', fontSize: 15, fontWeight: 700 }}>{error}</div>}
      <Boton ancho cargando={guardando} onClick={guarda}>{empezar}</Boton>
      {alCerrar && <Boton tipo="texto" onClick={alCerrar}>Ahora no</Boton>}

      {hoja && (
        <HojaFlotante titulo="¿Para qué fecha?" subtitulo="El día de tu competencia o de tu meta." onCerrar={() => setHoja(false)} ancho={460}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 6 }}>
            <Calendario desde={rango.desde} hasta={rango.hasta} valor={borrador} alElegir={setBorrador} />
            {previa && (
              <div style={{ display: 'flex', gap: 10, background: KP.blueSoft, color: KP.blue, borderRadius: 16, padding: '14px 16px', fontSize: 16, fontWeight: 600, lineHeight: 1.4 }}>
                <CalendarDays size={20} style={{ flexShrink: 0, marginTop: 1 }} />
                {previa.semana === 1 ? `Te alcanza para todo el plan. Entras en la semana 1 de ${total}.` : `Entras en la semana ${previa.semana} de ${total}. Te saltas las primeras ${previa.saltadas}.`}
              </div>
            )}
            <Boton ancho deshabilitado={!borrador} onClick={() => { setFechaMeta(borrador); setHoja(false); }}>Usar esta fecha</Boton>
          </div>
        </HojaFlotante>
      )}
    </div>
  );
}

/** Para quien abre el plan sin haber elegido: si la compra es nueva y aún no eligió, sale esta pantalla (ver `MisPlanes` y la app). */
export const faltaElegir = (compra) => !!compra && !compra.entrada_elegida_en && ['activa', 'gracia'].includes(compra.estado);
