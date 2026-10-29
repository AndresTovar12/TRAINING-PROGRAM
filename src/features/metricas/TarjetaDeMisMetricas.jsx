import { useEffect, useMemo, useState } from 'react';
import { Activity, Upload, Watch } from 'lucide-react';
import { AVISO_ABRE_PERFIL, abrePerfil } from '@/lib/abrePerfil';
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
    return () => window.removeEventListener(AVISO_ABRE_PERFIL, cierra);
  }, []);
  const enLaApp = saludDisponible();
  const { filas } = useEntrenosRecientes(atleta?.id, 40);
  const semana = useMemo(() => resumenDeLaSemana(filas ?? []), [filas]);
  const { oneRMs } = useUnRM();
  const { hayReloj, recientes } = useRecuperacionReciente();
  const unidad = atleta?.unidad_peso || 'kg';
  const maximos = LEVANTAMIENTOS.filter((l) => Number(oneRMs?.[l.key]) > 0);
  const km = semana.distancia_m >= 100 ? ` · ${(semana.distancia_m / 1000).toFixed(1)} km` : '';

  return (
    <>
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
        {/* En la app del iPhone el Apple Watch entra directo (Mi perfil → Dispositivos); importar un archivo queda para lo de otras apps. */}
        {enLaApp && <Fila izquierda={<IconoDeFila><Watch size={18} /></IconoDeFila>} texto="Conecta tu Apple Watch" detalle="En Mi perfil → Dispositivos" onClick={() => abrePerfil('dispositivos')} />}
        <Fila izquierda={<IconoDeFila><Upload size={18} /></IconoDeFila>} texto="Importar entrenos" detalle={enLaApp ? 'Un archivo de Garmin, Strava u otra app' : 'Del Apple Watch, Garmin, Strava…'} onClick={() => setAbierta('importar')} />
      </Grupo>
      {abierta && <AbreMetricas atleta={atleta} esAtleta abrirEn={abierta === 'importar' ? 'importar' : null} onCerrar={() => setAbierta(null)} />}
    </>
  );
}
