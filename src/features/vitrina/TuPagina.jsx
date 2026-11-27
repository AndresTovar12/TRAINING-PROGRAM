import { useEffect, useState } from 'react';
import { ChevronRight, Plus, Trash2 } from 'lucide-react';
import { FONT, KP, UI } from '@/lib/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { enLaApp } from '@/lib/nativo';
import { ligaPublica } from '@/lib/vitrinaDatos';
import Ventana from '@/features/misplanes/Ventana';
import CampoDeFoto from '@/features/admin/CampoDeFoto';
import HojaFlotante from '@/components/HojaFlotante';
import { Avatar, Boton, Campo, Fila, Grupo } from '@/components/ui';
import PaginaDelCoach from '@/features/tienda/PaginaDelCoach';
import { especialidad } from '@/features/tienda/piezasDelPlan';

/* TU PÁGINA (encargo «Compra y dinero», 26 nov 2026; dibujos coach-b1 y coach-b2). «Así te ven tus atletas»: lo que sale arriba de tus planes en tu página.
   Foto de portada, «Qué logran tus atletas contigo», «Sobre mí», «Más sobre ti · Opcional» (años de coach, certificaciones, Instagram: en la página solo se ve lo que llenes)
   y los resultados de tus atletas (salen debajo de tus planes). La especialidad (tus disciplinas de Mi perfil) y cuántos atletas han entrenado contigo salen solos. */

const instagramDe = (redes) => String(redes?.instagram ?? '').replace(/^@/, '');

function HojaDeResultado({ r, planes, alCerrar, alGuardar }) {
  const [x, setX] = useState({ titulo: r?.titulo ?? '', atleta: r?.atleta ?? '', vitrina_plan_id: r?.vitrina_plan_id ?? null, foto_url: r?.foto_url ?? '' });
  const pon = (c) => setX((p) => ({ ...p, ...c }));
  return (
    <HojaFlotante titulo={r ? 'Resultado' : 'Agregar un resultado'} onCerrar={alCerrar} ancho={460}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Campo etiqueta="Qué logró" valor={x.titulo} onCambio={(v) => pon({ titulo: v })} marcador="+20 kg en sentadilla en 12 semanas" maxLength={120} />
        <Campo etiqueta="Quién (solo su nombre)" valor={x.atleta} onCambio={(v) => pon({ atleta: v })} marcador="Ana" maxLength={60} grande={false} />
        {planes.length > 0 && (
          <Grupo titulo="Qué plan compró · opcional">
            {[{ id: null, titulo: 'Ninguno' }, ...planes].map((p) => (
              <Fila key={p.id ?? 'no'} texto={p.titulo} valor={x.vitrina_plan_id === p.id ? '✓' : null} onClick={() => pon({ vitrina_plan_id: p.id })} />
            ))}
          </Grupo>
        )}
        <div style={{ background: UI.tarjeta, borderRadius: UI.rGrupo, padding: 8 }}>
          <CampoDeFoto valor={x.foto_url} onCambia={(url) => pon({ foto_url: url })} alto={110} />
          <div style={{ fontSize: 13, fontWeight: 600, color: KP.ink2, padding: '6px 4px 2px' }}>Foto · opcional</div>
        </div>
        <Boton ancho deshabilitado={!x.titulo.trim()} onClick={() => alGuardar(x)}>Guardar</Boton>
      </div>
    </HojaFlotante>
  );
}

export default function TuPagina({ alCerrar }) {
  const { profile, updateProfile } = useAuth();
  const [f, setF] = useState(() => ({
    portada_url: profile?.portada_url ?? '', logros: profile?.logros ?? '', bio: profile?.bio ?? '',
    anos_coach: profile?.anos_coach ?? '', certificaciones: profile?.certificaciones ?? '', instagram: instagramDe(profile?.redes),
  }));
  const [mas, setMas] = useState(() => ({ anos: !!profile?.anos_coach, cert: !!profile?.certificaciones, ig: !!instagramDe(profile?.redes) }));
  const [resultados, setResultados] = useState([]);
  const [planes, setPlanes] = useState([]);
  const [atletas, setAtletas] = useState(null);
  const [editando, setEditando] = useState(undefined); // undefined = cerrada · null = nuevo · fila
  const [viendo, setViendo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const pon = (c) => setF((p) => ({ ...p, ...c }));

  const leeResultados = async () => {
    const { data } = await supabase.from('resultados_de_atletas').select('*').eq('coach_id', profile.id).order('orden').order('creado_en');
    setResultados(data ?? []);
  };
  useEffect(() => {
    if (!profile?.id) return;
    leeResultados();
    supabase.from('vitrina_planes').select('id, titulo').eq('coach_id', profile.id).eq('estado', 'publicado').then(({ data }) => setPlanes(data ?? []));
    supabase.rpc('atletas_del_coach', { p_coach: profile.id }).then(({ data }) => setAtletas(data ?? 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- se lee una vez al abrir
  }, [profile?.id]);

  async function guarda() {
    setGuardando(true);
    setError(null);
    const anos = Number.parseInt(String(f.anos_coach), 10);
    const ig = f.instagram.trim().replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/\/.*$/, '');
    const { error: e } = await updateProfile({
      portada_url: f.portada_url || null, logros: f.logros.trim() || null, bio: f.bio.trim() || null,
      anos_coach: Number.isFinite(anos) && anos >= 0 ? anos : null, certificaciones: f.certificaciones.trim() || null,
      redes: { ...(profile?.redes ?? {}), instagram: ig || null },
    });
    setGuardando(false);
    if (e) { setError(e.message ?? 'No se pudo guardar.'); return; }
    alCerrar();
  }
  async function guardaResultado(x) {
    const fila = { titulo: x.titulo.trim(), atleta: x.atleta.trim() || null, vitrina_plan_id: x.vitrina_plan_id, foto_url: x.foto_url || null };
    const { error: e } = editando
      ? await supabase.from('resultados_de_atletas').update(fila).eq('id', editando.id)
      : await supabase.from('resultados_de_atletas').insert({ ...fila, coach_id: profile.id, orden: resultados.length });
    if (e) { setError(e.message); return; }
    setEditando(undefined);
    leeResultados();
  }
  async function quitaResultado(r) {
    await supabase.from('resultados_de_atletas').delete().eq('id', r.id);
    setEditando(undefined);
    leeResultados();
  }

  const chipMas = (activo, texto, al) => !activo && (
    <button type="button" onClick={al} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderRadius: 16, border: 'none', background: KP.blueSoft, color: KP.blue, fontFamily: FONT, fontSize: 16, fontWeight: 700, cursor: 'pointer' }}><Plus size={18} />{texto}</button>
  );
  const esp = especialidad(profile);
  return (
    <>
      <Ventana titulo="Tu página" subtitulo="Así te ven tus atletas" onCerrar={alCerrar} ancho={560} pie={<Boton ancho cargando={guardando} onClick={guarda}>Guardar</Boton>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontFamily: FONT }}>
          <div style={{ background: UI.tarjeta, borderRadius: UI.rGrupo, padding: 10 }}>
            <CampoDeFoto valor={f.portada_url} onCambia={(url) => pon({ portada_url: url })} alto={190} />
            <div style={{ fontSize: 13.5, fontWeight: 500, color: KP.ink2, padding: '8px 6px 2px' }}>Foto de portada · la de arriba de tu página</div>
          </div>
          <Campo etiqueta="Qué logran tus atletas contigo" valor={f.logros} onCambio={(v) => pon({ logros: v })} marcador="Sube tus marcas en 12 semanas sin lesionarte." maxLength={160} grande={false} />
          <Campo etiqueta="Sobre mí" valor={f.bio} onCambio={(v) => pon({ bio: v })} marcador="Cuéntales quién eres y cómo entrenas." multilinea maxLength={1200} />

          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '6px 4px 0' }}>
            <span style={{ fontSize: 18, fontWeight: 800 }}>Más sobre ti</span><span style={{ fontSize: 14.5, color: KP.ink2 }}>Opcional</span>
          </div>
          {mas.anos && <Campo etiqueta="Años de experiencia" valor={String(f.anos_coach)} onCambio={(v) => pon({ anos_coach: v.replace(/\D/g, '').slice(0, 2) })} inputMode="numeric" marcador="10" />}
          {mas.cert && <Campo etiqueta="Certificaciones" valor={f.certificaciones} onCambio={(v) => pon({ certificaciones: v })} marcador="NSCA-CPT" maxLength={120} />}
          {mas.ig && <Campo etiqueta="Instagram" valor={f.instagram} onCambio={(v) => pon({ instagram: v })} marcador="@tuusuario" autoCapitalize="none" maxLength={60} />}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {chipMas(mas.anos, 'Años de experiencia', () => setMas((m) => ({ ...m, anos: true })))}
            {chipMas(mas.cert, 'Certificaciones', () => setMas((m) => ({ ...m, cert: true })))}
            {chipMas(mas.ig, 'Instagram', () => setMas((m) => ({ ...m, ig: true })))}
          </div>
          <p style={{ margin: '-2px 6px 0', fontSize: 14, color: KP.ink2 }}>En tu página solo se ve lo que llenes.</p>

          <Grupo titulo="Resultados de tus atletas" pie="Salen en tu página, debajo de tus planes.">
            {resultados.map((r) => (
              <Fila key={r.id} izquierda={<Avatar nombre={r.atleta || r.titulo} foto={r.foto_url} tamano={48} />} texto={r.titulo}
                detalle={[r.atleta, planes.find((p) => p.id === r.vitrina_plan_id)?.titulo ? `compró ${planes.find((p) => p.id === r.vitrina_plan_id).titulo}` : null].filter(Boolean).join(' · ') || undefined}
                onClick={() => setEditando(r)} />
            ))}
            <Fila izquierda={<span style={{ width: 44, height: 44, borderRadius: 13, background: KP.blueSoft, color: KP.blue, display: 'grid', placeItems: 'center' }}><Plus size={20} /></span>} texto="Agregar un resultado" tono="enlace" onClick={() => setEditando(null)} />
          </Grupo>

          <Grupo titulo="Esto sale solo">
            <Fila texto="Tu especialidad" detalle="De tus disciplinas en Mi perfil" valor={esp ?? 'Sin disciplinas'} valorTono="neutro" />
            <Fila texto="Atletas que han entrenado contigo" detalle="Se cuenta solo" valor={atletas == null ? '…' : String(atletas)} valorTono="neutro" />
          </Grupo>
          <Grupo>
            <Fila izquierda={<Avatar nombre={profile?.full_name} foto={f.portada_url || profile?.avatar_url} tamano={48} />} texto="Ver cómo se ve" detalle="Tu página como la ven tus atletas, en la app y en la web"
              onClick={() => (enLaApp() ? setViendo(true) : window.open(ligaPublica(profile?.username), '_blank', 'noopener'))} derecha={<ChevronRight size={18} color={KP.ink3} />} />
          </Grupo>
          {error && <div role="alert" style={{ background: KP.dangerSoft, color: KP.danger, borderRadius: 14, padding: '12px 14px', fontSize: 15, fontWeight: 700 }}>{error}</div>}
        </div>
      </Ventana>
      {editando !== undefined && (
        <HojaDeResultado r={editando} planes={planes} alCerrar={() => setEditando(undefined)} alGuardar={guardaResultado} />
      )}
      {editando && (
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 'calc(16px + env(safe-area-inset-bottom))', zIndex: 4000, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
          <span style={{ pointerEvents: 'auto' }}><Boton tipo="peligro" chico icono={Trash2} onClick={() => quitaResultado(editando)}>Quitar este resultado</Boton></span>
        </div>
      )}
      {viendo && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 5000, overflowY: 'auto', background: UI.fondo }}>
          <PaginaDelCoach usuario={profile?.username} enLaApp alVolver={() => setViendo(false)} alAbrirPlan={() => {}} />
        </div>
      )}
    </>
  );
}
