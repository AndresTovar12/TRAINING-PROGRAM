import { useState } from 'react';
import { HeartPulse, Upload } from 'lucide-react';
import { LT, eyebrow } from '@/lib/theme';
import AbreMetricas from './AbreMetricas';
import { Boton, Tarjeta } from './Piezas';

/* Lo que ve el ATLETA en su perfil: qué son sus métricas, para qué sirven y dos botones (verlas e importar). El resto vive en `MetricasDelAtleta`. */
export default function TarjetaDeMisMetricas({ atleta }) {
  const [abierta, setAbierta] = useState(null); // null | 'ver' | 'importar'
  return (
    <>
      <Tarjeta style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={eyebrow(LT.text2)}>Mis métricas del reloj</div>
        <div style={{ fontSize: 15, lineHeight: 1.5, fontWeight: 500, color: LT.text }}>
          Trae tus entrenos del Apple Watch (o de Garmin, Strava…) y verás tu pulso, tu ritmo, tu carga y cómo recuperas. Tu coach también los ve, para entrenarte mejor.
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Boton principal icono={HeartPulse} onClick={() => setAbierta('ver')}>Ver mis métricas</Boton>
          <Boton icono={Upload} onClick={() => setAbierta('importar')}>Importar entrenos</Boton>
        </div>
      </Tarjeta>
      {abierta && <AbreMetricas atleta={atleta} esAtleta abrirEn={abierta === 'importar' ? 'importar' : null} onCerrar={() => setAbierta(null)} />}
    </>
  );
}
