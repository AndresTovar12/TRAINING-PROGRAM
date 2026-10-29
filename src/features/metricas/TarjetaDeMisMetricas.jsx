import { useEffect, useMemo, useState } from 'react';
import { Activity, Check, Upload } from 'lucide-react';
import { AVISO_ABRE_PERFIL } from '@/lib/abrePerfil';
import { AVISO_CONECTA_RELOJ, abreConectaReloj } from '@/lib/abreConectaReloj';
import { cuentaDelReloj, useReloj } from '@/lib/relojConectado';
import { botonPrimario, enlace } from '@/features/inicio/estilos';
import { FONT, KP } from '@/lib/theme';
import { saludDisponible } from '@/lib/saludDelTelefono';
import AbreMetricas from './AbreMetricas';
import { useEntrenosRecientes } from '@/features/libre/useEntrenoLibre';
import { resumenDeLaSemana } from '@/lib/semanaLibre';
import { duracionTexto } from '@/lib/metricas/formato';
import { useRecuperacionReciente } from '@/lib/useRecuperacionReciente';
import { useUnRM } from '@/lib/unRM';
import { LEVANTAMIENTOS } from '@/lib/cargaPorcentaje';
import { desdeKilos, etiquetaUnidad } from '@/lib/unidades';
import { Fila, Grupo, IconoDeFila, TarjetaHeroe } from '@/components/ui';

/* «MIS MÉTRICAS» en Mi perfil del ATLETA. Reestructura visual (15 oct 2026), como la captura de Andrés: la tarjeta azul con su semana (cuánto entrenó), sus
   máximos (1RM), lo que midió su reloj y, abajo, las puertas a sus métricas completas (`MetricasDelAtleta`) y a importar entrenos.
   Solo se monta en la app del atleta, que trae `AppStateProvider` (los 1RM se guardan con `useStorage`). */
export default function TarjetaDeMisMetricas({ atleta }) {
  const [abierta, setAbierta] = useState(null); // null | 'ver' | 'importar'
  // Ir a Mi perfil → Dispositivos desde las métricas: se cierran para que se vea.
  useEffect(() => {
    const cierra = () => setAbierta(null);
    window.addEventListener(AVISO_ABRE_PERFIL, cierra);
    window.addEventListener(AVISO_CONECTA_RELOJ, cierra);
    return () => { window.removeEventListener(AVISO_ABRE_PERFIL, cierra); window.removeEventListener(AVISO_CONECTA_RELOJ, cierra); };
  }, []);
  const enLaApp = saludDisponible();
  // Mis métricas sin datos del reloj (fase 5): con reloj emparejado, «Conectar Apple Watch»; sin reloj, «Conectar Apple Salud» (o importar un archivo).
  const { listo: relojListo, conexion, reloj } = useReloj();
  const [delReloj, setDelReloj] = useState(null);
  const desde = conexion?.conectado_en ?? null;
  useEffect(() => {
    let vivo = true;
    if (desde) cuentaDelReloj(atleta?.id, desde).then((c) => { if (vivo) setDelReloj(c.n); });
    return () => { vivo = false; };
  }, [atleta?.id, desde]);
  const sinConectar = enLaApp && relojListo && !conexion;
  const esperandoElPrimero = enLaApp && !!conexion && delReloj === 0;
  const { filas } = useEntrenosRecientes(atleta?.id, 40);
  const semana = useMemo(() => resumenDeLaSemana(filas ?? []), [filas]);
  const { oneRMs } = useUnRM();
  const { hayReloj, recientes } = useRecuperacionReciente();
  const unidad = atleta?.unidad_peso || 'kg';
  const maximos = LEVANTAMIENTOS.filter((l) => Number(oneRMs?.[l.key]) > 0);
  const km = semana.distancia_m >= 100 ? ` · ${(semana.distancia_m / 1000).toFixed(1)} km` : '';

  const vacio = { background: '#fff', borderRadius: 22, padding: '22px 18px 14px', display: 'grid', justifyItems: 'center', textAlign: 'center', gap: 8, fontFamily: FONT, boxShadow: '0 1px 2px rgba(17,19,24,.04)' };
  return (
    <>
      {sinConectar && (
        <section style={vacio}>
          <span style={{ width: 48, height: 48, borderRadius: 15, background: KP.blueSoft, color: KP.blue, display: 'grid', placeItems: 'center' }}><Activity size={24} /></span>
          <b style={{ fontSize: 17, fontWeight: 800, color: KP.ink }}>Aquí verás cómo entrenas</b>
          <p style={{ margin: '0 0 6px', fontSize: 14, lineHeight: 1.45, color: KP.ink2 }}>
            {reloj.emparejado
              ? 'Conecta tu Apple Watch y verás tu pulso, tu ritmo, tu carga y cómo recuperas. Tu coach también los ve.'
              : 'Con un Apple Watch, tu pulso, tu ritmo y tu sueño entran solos. Mientras tanto, conecta Apple Salud o importa un archivo de tu reloj.'}
          </p>
          <button type="button" className="kp-press" onClick={() => abreConectaReloj('metricas')} style={botonPrimario()}>{reloj.emparejado ? 'Conectar Apple Watch' : 'Conectar Apple Salud'}</button>
          <button type="button" onClick={() => setAbierta('importar')} style={enlace}>Importar un archivo de entreno</button>
        </section>
      )}
      {esperandoElPrimero && (
        <section style={vacio}>
          <span style={{ width: 48, height: 48, borderRadius: 15, background: KP.mintSoft, color: KP.mint, display: 'grid', placeItems: 'center' }}><Check size={24} /></span>
          <b style={{ fontSize: 17, fontWeight: 800, color: KP.ink }}>{reloj.emparejado ? 'Tu Apple Watch ya está conectado' : 'Apple Salud ya está conectado'}</b>
          <p style={{ margin: '0 0 8px', fontSize: 14, lineHeight: 1.45, color: KP.ink2 }}>Tu primer entreno con el reloj aparece aquí, con tu pulso y tu ruta. Tu recuperación, desde esta noche.</p>
        </section>
      )}
      <TarjetaHeroe
        etiqueta="Esta semana"
        titulo={semana.entrenos ? duracionTexto(semana.duracion_s) : 'Sin entrenos'}
        detalle={semana.entrenos ? `${semana.entrenos} ${semana.entrenos === 1 ? 'entreno' : 'entrenos'}${km}` : null}
      />

      {maximos.length > 0 && (
        <Grupo titulo="Tus máximos">
          {maximos.map((l) => (
            <Fila key={l.key} texto={`${l.nombre} · 1RM`} valor={`${desdeKilos(oneRMs[l.key], unidad)} ${etiquetaUnidad(unidad)}`} valorTono="neutro" />
          ))}
        </Grupo>
      )}

      {hayReloj && (
        <Grupo titulo="Salud">
          <Fila texto="Pulso en reposo" valor={recientes.reposo ? `${recientes.reposo.valor} lpm` : '—'} valorTono="neutro" />
          <Fila texto="HRV" valor={recientes.hrv ? `${recientes.hrv.valor} ms` : '—'} valorTono="neutro" />
          <Fila texto="Sueño" valor={recientes.sueno ? `${recientes.sueno.valor} h` : '—'} valorTono="neutro" />
        </Grupo>
      )}

      <Grupo pie="Tu coach también las ve, para entrenarte mejor.">
        <Fila izquierda={<IconoDeFila><Activity size={18} /></IconoDeFila>} texto="Ver mis métricas" detalle="Pulso, ritmo, carga y recuperación" onClick={() => setAbierta('ver')} />
        <Fila izquierda={<IconoDeFila><Upload size={18} /></IconoDeFila>} texto="Importar entrenos" detalle={enLaApp ? 'Un archivo de Garmin, Strava u otra app' : 'Del Apple Watch, Garmin, Strava…'} onClick={() => setAbierta('importar')} />
      </Grupo>
      {abierta && <AbreMetricas atleta={atleta} esAtleta abrirEn={abierta === 'importar' ? 'importar' : null} onCerrar={() => setAbierta(null)} />}
    </>
  );
}
