import { useEffect, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { usePerfilDeLaVista } from '@/contexts/VistaContext';
import { nombresDelEquipo, aceptarInvitacionDeEquipo } from '@/lib/api';
import { FONT, KP, LT, oficioCorto } from '@/lib/theme';
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

  return (
    <div role="region" aria-label="Invitación al equipo" style={{ margin: '0 18px 12px', background: LT.surface, borderRadius: 18, padding: '14px 15px', border: `1.5px solid ${LT.blueSoft}` }}>
      <div style={{ fontSize: 14.5, fontWeight: 700, color: LT.text, lineHeight: 1.45 }}>
        {nombre}{oficio ? `, ${oficio.toLowerCase()},` : ''} quiere atenderte. Podrá ver tu plan de entrenamiento y cómo vas. ¿Aceptas?
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 11 }}>
        <button
          type="button"
          onClick={aceptar}
          disabled={ocupado === p.profesional_id}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontFamily: FONT, fontSize: 14,
            fontWeight: 800, border: 'none', borderRadius: 12, padding: '11px 18px', color: '#fff',
            background: `linear-gradient(140deg, ${KP.blue}, ${KP.blueDk})`, touchAction: 'manipulation',
          }}
        >
          {ocupado === p.profesional_id ? <Loader2 size={15} className="spin" /> : <Check size={15} strokeWidth={3} />} Aceptar
        </button>
        <button
          type="button"
          onClick={ahoraNo}
          style={{
            cursor: 'pointer', fontFamily: FONT, fontSize: 14, fontWeight: 700, borderRadius: 12, padding: '11px 16px',
            border: `1.5px solid ${LT.border}`, background: LT.surface, color: LT.text2, touchAction: 'manipulation',
          }}
        >
          Ahora no
        </button>
      </div>
    </div>
  );
}
