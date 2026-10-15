import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { usePerfilDeLaVista } from '@/contexts/VistaContext';
import { nombresDelEquipo, aceptarInvitacionDeEquipo } from '@/lib/api';
import { FONT, LT, oficioCorto } from '@/lib/theme';
import { Avatar, Boton } from '@/components/ui';
import { nombreCorto } from '@/lib/programas';

/* «Juan, fisioterapeuta, quiere atenderte. Podrá ver tu plan de entrenamiento y
   cómo vas. ¿Aceptas?» Arriba de «Hoy», solo al atleta y solo mientras hay una
   invitación pendiente. «Ahora no» la esconde en ESTE teléfono (se guarda aquí,
   no en la base); sigue en Perfil → «Mi equipo», donde también se rechaza.

   Quien mira la app de un atleta desde su panel (`soloLectura`) no la ve: no le
   toca a él contestar. */

const CLAVE = (id) => `tl:invita-oculta:${id}`;
const leeOcultas = (id) => {
  try { return JSON.parse(localStorage.getItem(CLAVE(id)) || '[]'); } catch { return []; }
};
const guardaOcultas = (id, lista) => {
  try { localStorage.setItem(CLAVE(id), JSON.stringify(lista)); } catch { /* sin almacenamiento */ }
};

export default function AvisoDeInvitacion() {
  const { userId, perfil, soloLectura } = usePerfilDeLaVista();
  const [pendientes, setPendientes] = useState([]);
  const [ocultas, setOcultas] = useState(() => leeOcultas(userId));
  const [ocupado, setOcupado] = useState(null);

  const esAtleta = perfil?.role !== 'admin' && !soloLectura;

  useEffect(() => {
    if (!esAtleta || !userId) return undefined;
    let vivo = true;
    nombresDelEquipo(userId)
      .then((filas) => { if (vivo) setPendientes(filas.filter((f) => !f.es_principal && f.estado === 'pendiente')); })
      .catch(() => {});
    return () => { vivo = false; };
  }, [esAtleta, userId]);

  const visibles = pendientes.filter((p) => !ocultas.includes(p.profesional_id));
  if (!esAtleta || !visibles.length) return null;
  const p = visibles[0];
  const nombre = nombreCorto(p.full_name) || p.username;
  const oficio = oficioCorto(p.profesion);

  const aceptar = async () => {
    setOcupado(p.profesional_id);
    try {
      await aceptarInvitacionDeEquipo(p.profesional_id);
      setPendientes((lista) => lista.filter((x) => x.profesional_id !== p.profesional_id));
    } catch {
      setOcupado(null);
    }
  };
  const ahoraNo = () => {
    const nuevas = [...ocultas, p.profesional_id];
    setOcultas(nuevas);
    guardaOcultas(userId, nuevas);
  };

  // Reestructura visual (15 oct 2026): tarjeta blanca con la persona (su avatar de iniciales) y los dos botones de `components/ui`.
  return (
    <div role="region" aria-label="Invitación al equipo" style={{ margin: '12px 18px 0', background: '#fff', borderRadius: 20, padding: 16, boxShadow: '0 2px 10px rgba(17,19,24,0.06)', fontFamily: FONT }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <Avatar nombre={p.full_name || p.username} tamano={44} />
        <div style={{ fontSize: 15.5, fontWeight: 600, color: LT.text, lineHeight: 1.45 }}>
          <b>{nombre}</b>{oficio ? `, ${oficio.toLowerCase()},` : ''} quiere atenderte. Podrá ver tu plan de entrenamiento y cómo vas. ¿Aceptas?
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <Boton tipo="secundario" chico onClick={ahoraNo} estilo={{ flex: 1 }}>Ahora no</Boton>
        <Boton chico icono={Check} cargando={ocupado === p.profesional_id} onClick={aceptar} estilo={{ flex: 1 }}>Aceptar</Boton>
      </div>
    </div>
  );
}
