import { Activity, Check, HeartPulse, Pause, Watch } from 'lucide-react';
import { KP } from '@/lib/theme';
import { subtitulo, titulo } from '@/features/inicio/estilos';
import { Beneficio, Beneficios, EstilosDelReloj, Pista, RelojDibujado } from './piezas';

/* «TRAINING LAB FUNCIONA CON TU APPLE WATCH» (fase 5, 29 oct 2026): el paso del reloj al crear la cuenta, para quien NO tiene un Apple Watch emparejado (o está
   en la web). Solo cuenta cómo lo seguiría el reloj al entrenar; no pide nada. Lo que dice es lo que hace hoy la app del reloj: cuenta el descanso y vibra al
   acabar (ModeloDelEntreno.swift), kilómetros y ritmo al correr (PantallaDeCarrera.jsx), pulso en vivo, y «Listo» y «Siguiente» (VistaDelEntreno.swift).
   Inicio nuevo (30 oct 2026): solo en la WEB. En la app del iPhone, sin reloj, el paso conecta Apple Salud (`CuerpoDeConectar`) en vez de solo contar. */
export default function AvisoDelReloj({ compu = false }) {
  return (
    <>
      <EstilosDelReloj />
      <div style={{ display: 'grid', placeItems: 'center', margin: '4px 0 6px' }}>
        <RelojDibujado modo="descanso" titulo="Descanso" tiempo="0:45" detalle="Sigue: Back Squat" pulso={126} />
      </div>
      <h1 style={titulo(compu)}>Training Lab funciona con tu Apple Watch</h1>
      <p style={subtitulo}>Mientras entrenas, lo ves todo en tu muñeca.</p>
      <Beneficios>
        <Beneficio Icono={Pause} titulo="El descanso cuenta en tu muñeca" texto="Y te vibra cuando toca la siguiente serie." />
        <Beneficio Icono={Activity} titulo="Tu ritmo cuando corres" texto="Tus kilómetros y tu ritmo por kilómetro." />
        <Beneficio Icono={HeartPulse} titulo="Tu pulso en vivo" texto="Lo mide el reloj mientras entrenas." />
        <Beneficio Icono={Check} titulo="«Listo» sin sacar el teléfono" texto="Marca cada serie desde el reloj." />
      </Beneficios>
      <Pista izquierda={<span style={{ width: 36, height: 36, borderRadius: 11, background: '#EBEDF1', color: KP.ink, display: 'grid', placeItems: 'center' }}><Watch size={18} /></span>}>
        <>Se conecta en la app del iPhone, en <b style={{ color: KP.ink }}>Mi perfil, Dispositivos</b>.</>
      </Pista>
    </>
  );
}
