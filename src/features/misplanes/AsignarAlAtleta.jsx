import { useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { planDe } from '@/lib/api';
import { asignarPlan } from '@/lib/asignar';
import { abrirItem } from '@/lib/misPlanes';
import { esProgramaFantasma } from '@/lib/programas';
import { TIPOS, planDePrograma, planDeRutina } from '@/lib/misPlanesDatos';
import Ventana from '@/features/misplanes/Ventana';
import SelectorDeMisPlanes from '@/features/misplanes/SelectorDeMisPlanes';
import ElegirDiaDelAtleta from '@/features/misplanes/ElegirDiaDelAtleta';
import { botonBlanco, botonPrincipal } from '@/features/misplanes/estilos';
import { T } from '@/lib/theme';

/**
 * «Asignar de Mis planes» desde la ficha de UN atleta: se elige algo de lo guardado y se le da.
 *
 *   programa o rutina — se confirma (si ya tiene plan, se dice que se reemplaza y que se recupera en «Cambios
 *                       del plan») y se le da una copia, que empieza en la semana 1.
 *   workout           — se elige en qué día de su plan va (la hoja de siempre).
 *
 * `clave`: de quién es el programa que se toca (`null` = el del coach principal). `onAsignado(fila)` recibe el
 * plan ya actualizado, para que la ficha lo enseñe.
 */
export default function AsignarAlAtleta({ atleta, clave = null, onAsignado, onCerrar }) {
  const { user } = useAuth();
  const nombre = atleta.full_name || atleta.username;
  const [item, setItem] = useState(null);
  const [datos, setDatos] = useState(null);
  const [actual, setActual] = useState(undefined); // el plan que ya tiene; `undefined` = leyendo
  const [error, setError] = useState('');
  const [trabajando, setTrabajando] = useState(false);

  async function elegir(elegido) {
    setError('');
    setItem(elegido);
    try {
      const [d, plan] = await Promise.all([abrirItem(elegido), planDe(atleta.id, clave)]);
      setDatos(d);
      setActual(plan && !esProgramaFantasma(plan.data) ? plan : null);
    } catch (e) {
      setError(e.message || 'No se pudo abrir');
    }
  }

  const volverAElegir = () => { setItem(null); setDatos(null); setActual(undefined); setError(''); };

  async function asignar() {
    setTrabajando(true);
    setError('');
    try {
      const plan = item.tipo === 'programa' ? planDePrograma(datos) : planDeRutina(datos);
      const { fila } = await asignarPlan({ atletaId: atleta.id, profesionalId: clave, creadorId: user?.id, nombre: item.nombre, plan });
      onAsignado?.(fila);
      onCerrar();
    } catch (e) {
      setError(e.message || 'No se pudo asignar');
      setTrabajando(false);
    }
  }

  if (!item) {
    return (
      <SelectorDeMisPlanes
        tipos={TIPOS} titulo={`Asignar a ${nombre}`} subtitulo="Elige lo que quieres darle. Siempre es una copia." onElegir={elegir} onCerrar={onCerrar}
      />
    );
  }

  const cargando = !error && (datos === null || actual === undefined);

  if (item.tipo === 'workout') {
    return (
      <Ventana titulo={`«${item.nombre}» para ${nombre}`} subtitulo="Elige el día de su plan donde va." onCerrar={onCerrar} ancho={620}>
        {cargando ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.text2, fontWeight: 600, padding: 16 }}><Loader2 size={16} className="spin" /> Cargando…</div>
        ) : error ? (
          <div style={{ color: T.danger, fontWeight: 700, fontSize: 13.5 }}>{error}</div>
        ) : (
          <ElegirDiaDelAtleta
            atleta={atleta} clave={clave} data={datos} nombre={item.nombre}
            onListo={(fila) => { onAsignado?.(fila); onCerrar(); }}
          />
        )}
      </Ventana>
    );
  }

  return (
    <Ventana
      titulo={`¿Darle «${item.nombre}» a ${nombre}?`}
      onCerrar={onCerrar}
      pie={(
        <>
          <button type="button" onClick={volverAElegir} disabled={trabajando} style={botonBlanco(false, trabajando)}>Elegir otra cosa</button>
          <button type="button" onClick={asignar} disabled={cargando || trabajando} style={botonPrincipal(cargando || trabajando)}>
            {trabajando ? <Loader2 size={16} className="spin" /> : <Check size={16} />} Asignar
          </button>
        </>
      )}
    >
      {cargando ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.text2, fontWeight: 600, padding: 16 }}><Loader2 size={16} className="spin" /> Cargando…</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14, fontWeight: 600, color: T.text2, lineHeight: 1.55 }}>
          <div>
            {actual
              ? <>Reemplaza su plan <b style={{ color: T.text }}>«{actual.title}»</b>. El anterior se guarda: lo recuperas en «Cambios del plan».</>
              : 'Será su primer plan.'}
          </div>
          <div>Empieza en la semana 1 hoy. Es una copia: si luego cambias lo guardado, lo que ya recibió no cambia. Lo que ya haya anotado se queda como historial.</div>
          {error && <div style={{ color: T.danger, fontWeight: 700 }}>{error}</div>}
        </div>
      )}
    </Ventana>
  );
}
