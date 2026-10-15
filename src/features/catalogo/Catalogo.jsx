import { useState } from 'react';
import { Bell, Compass, Dumbbell, FolderOpen, Home, Library, MessageCircle, Store, Users, Watch } from 'lucide-react';
import {
  Avatar, BarraInferior, BarraLateral, Boton, BotonEnAzul, Buscador, CabeceraConBanda, Campo, FilaElegir, Fila, Grupo, IconoDeFila,
  Interruptor, Pasos, Pastilla, Pestanas, PestanasLaterales, Segmentado, TarjetaHeroe,
} from '@/components/ui';
import { FONT, KP, UI } from '@/lib/theme';

/**
 * CATÁLOGO DE PIEZAS (reestructura visual, 15 oct 2026) — `traininglabapp.com/catalogo`.
 *
 * Andrés pidió el cambio de estilo de toda la app con sus 43 capturas. Antes de tocar pantallas, cada
 * pieza se construye UNA vez y se aprueba aquí; luego las pantallas solo las usan. Si algo no le gusta,
 * se arregla en `components/ui/` y cambia en todos lados. No lee ni guarda nada: los datos son de ejemplo.
 */

const CATEGORIAS = ['Fuerza', 'Velocidad', 'Core', 'Movilidad', 'Pliometría'].map((t) => ({ valor: t, texto: t }));
const DISCIPLINAS = ['Football', 'Atletismo', 'Básquetbol', 'Hyrox', 'Natación'].map((t) => ({ valor: t, texto: t }));

function Seccion({ titulo, nota, children }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 13, fontWeight: 800, letterSpacing: 1.2, textTransform: 'uppercase', color: KP.blue }}>{titulo}</h2>
        {nota && <p style={{ margin: '4px 0 0', fontSize: 14, color: KP.ink2, lineHeight: 1.45 }}>{nota}</p>}
      </div>
      {children}
    </section>
  );
}

export default function Catalogo() {
  const [categoria, setCategoria] = useState('Fuerza');
  const [disciplinas, setDisciplinas] = useState(['Football', 'Atletismo']);
  const [cobro, setCobro] = useState('membresia');
  const [vista, setVista] = useState('lista');
  const [turno, setTurno] = useState('am');
  const [veces, setVeces] = useState(3);
  const [reloj, setReloj] = useState(true);
  const [garmin, setGarmin] = useState(false);
  const [nombre, setNombre] = useState('Velocidad para receptores');
  const [busca, setBusca] = useState('');
  const [pestana, setPestana] = useState('perfil');
  const [barraAtleta, setBarraAtleta] = useState('home');
  const [barraCoach, setBarraCoach] = useState('atletas');
  const [lateral, setLateral] = useState('atletas');
  const [cargando, setCargando] = useState(false);

  const pestanas = ['Perfil', 'Cuenta', 'Compras', 'Dispositivos', 'Avisos', 'Mi equipo'].map((t) => ({ id: t.toLowerCase(), texto: t }));

  return (
    <div style={{ minHeight: '100dvh', background: UI.fondo, fontFamily: FONT, color: KP.ink }}>
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '28px 16px 80px' }}>
        <h1 style={{ margin: 0, fontSize: 30, fontWeight: 800, letterSpacing: -0.5 }}>Piezas de la app</h1>
        <p style={{ margin: '6px 0 28px', fontSize: 15, color: KP.ink2, maxWidth: 620, lineHeight: 1.5 }}>
          Cada pieza se hace una vez y la usan todas las pantallas. Todo aquí se puede tocar; nada se guarda.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))', gap: 36, alignItems: 'start' }}>
          <Seccion titulo="1 · Tarjeta azul" nota="Abre cada pantalla con lo más importante: un número o un nombre.">
            <TarjetaHeroe etiqueta="Vendido este mes" titulo="$13,400" detalle="41 ventas · siguiente depósito: viernes 18" />
            <TarjetaHeroe etiqueta="Esta semana" titulo="3 h 12 min" detalle="4 entrenos · 18.4 km" progreso={0.62} />
            <TarjetaHeroe etiqueta="Tu código de coach" titulo="AT-4821" accion={<BotonEnAzul>Copiar</BotonEnAzul>} />
          </Seccion>

          <Seccion titulo="2 · Botones" nota="Uno azul por pantalla; lo demás gris, blanco sobre azul o rojo para quitar.">
            <Boton ancho onClick={() => { setCargando(true); setTimeout(() => setCargando(false), 1400); }} cargando={cargando}>Publicar</Boton>
            <div style={{ display: 'flex', gap: 10 }}>
              <Boton tipo="secundario" estilo={{ flex: 1 }}>Guardar</Boton>
              <Boton estilo={{ flex: 2 }}>Publicar</Boton>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Boton tipo="secundario" chico>Editar</Boton>
              <Boton tipo="secundario" chico>Ver página</Boton>
              <Boton tipo="peligro" chico>Retirar</Boton>
              <Boton tipo="texto" chico>Copiar la liga</Boton>
            </div>
            <div style={{ background: UI.azul, borderRadius: UI.rTarjeta, padding: 16, display: 'flex', gap: 10 }}>
              <Boton tipo="blanco" ancho>▶ Empezar</Boton>
            </div>
          </Seccion>

          <Seccion titulo="3 · Lista agrupada" nota="Un dato por renglón: el nombre a la izquierda, lo que vale a la derecha en azul. Tocarlo lo cambia.">
            <Grupo>
              <Fila texto="Usuario" valor="@andrestovar" onClick={() => {}} />
              <Fila texto="Correo" valor="andres@correo.com" onClick={() => {}} />
              <Fila texto="Unidad de peso" valor="kg" onClick={() => {}} />
            </Grupo>
            <Grupo titulo="Seguridad">
              <Fila texto="Cerrar sesión en los demás aparatos" onClick={() => {}} />
            </Grupo>
            <Grupo titulo="Zona de cuidado">
              <Fila texto="Eliminar mi cuenta" tono="peligro" detalle="No se puede deshacer." onClick={() => {}} />
            </Grupo>
          </Seccion>

          <Seccion titulo="4 · Interruptor" nota="Para sí o no. Se guarda al tocarlo, sin botón de guardar.">
            <Grupo>
              <Fila izquierda={<IconoDeFila color={KP.ink} fondo={UI.relleno}><Watch size={18} /></IconoDeFila>} texto="Apple Watch" detalle={reloj ? 'Conectado · pulso, ritmo y sueño' : 'Sin conectar'} derecha={<Interruptor activo={reloj} onCambio={setReloj} etiqueta="Apple Watch" />} />
              <Fila izquierda={<IconoDeFila>G</IconoDeFila>} texto="Garmin" detalle={garmin ? 'Conectado' : 'Sin conectar'} derecha={<Interruptor activo={garmin} onCambio={setGarmin} etiqueta="Garmin" />} />
              <Fila izquierda={<IconoDeFila color="#C2620A" fondo="#FFF0E1">S</IconoDeFila>} texto="Strava" detalle="Importa tus entrenos anteriores" onClick={() => {}} />
            </Grupo>
          </Seccion>

          <Seccion titulo="5 · Elegir de una lista" nota="El reemplazo de los chips: toca el renglón y escoge abajo. Con una opción se cierra solo; con varias, «Listo».">
            <Grupo>
              <FilaElegir texto="Categoría" opciones={CATEGORIAS} valor={categoria} onCambio={setCategoria} acciones={[{ texto: 'Agregar categoría', onClick: () => {} }]} />
              <FilaElegir texto="Disciplinas" opciones={DISCIPLINAS} valor={disciplinas} multiple onCambio={setDisciplinas} />
            </Grupo>
          </Seccion>

          <Seccion titulo="6 · Una de dos o tres" nota="Cuando todas las opciones caben a la vista.">
            <Segmentado etiqueta="Cómo se cobra" opciones={[{ valor: 'membresia', texto: 'Membresía' }, { valor: 'unico', texto: 'Pago único' }]} valor={cobro} onCambio={setCobro} />
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <Segmentado chico ancho={false} etiqueta="Turno" opciones={[{ valor: 'no', texto: 'Sin turno' }, { valor: 'am', texto: 'AM' }, { valor: 'pm', texto: 'PM' }]} valor={turno} onCambio={setTurno} />
              <Segmentado chico ancho={false} etiqueta="Vista" opciones={[{ valor: 'lista', texto: 'Lista' }, { valor: 'tarjetas', texto: 'Tarjetas' }]} valor={vista} onCambio={setVista} />
            </div>
          </Seccion>

          <Seccion titulo="7 · Contar" nota="Subir o bajar de uno en uno.">
            <Grupo>
              <Fila texto="Se repite" valor={null} derecha={<Pasos etiqueta="veces" valor={veces} min={1} max={20} onCambio={setVeces} />} />
            </Grupo>
            <div style={{ background: UI.azul, borderRadius: 18, padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#fff', fontWeight: 800 }}>
              <span style={{ fontSize: 18 }}>Set 1</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, fontWeight: 600 }}>Se repite <Pasos enAzul etiqueta="veces" valor={veces} min={1} max={20} onCambio={setVeces} /> veces</span>
            </div>
          </Seccion>

          <Seccion titulo="8 · Estados" nota="Solo se leen.">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Pastilla tono="ok">Publicado</Pastilla>
              <Pastilla tono="neutro">Borrador</Pastilla>
              <Pastilla tono="aviso">Bajando</Pastilla>
              <Pastilla tono="malo">Sin plan</Pastilla>
              <Pastilla tono="azul">Mío</Pastilla>
              <Pastilla tono="lleno">AHORA</Pastilla>
            </div>
          </Seccion>

          <Seccion titulo="9 · Escribir y buscar">
            <Campo etiqueta="Nombre del plan" valor={nombre} onCambio={setNombre} />
            <Buscador valor={busca} onCambio={setBusca} marcador="Buscar atleta" />
          </Seccion>

          <Seccion titulo="10 · Personas">
            <Grupo>
              {['Andrés Tovar', 'Mariana Ruiz', 'Diego Salas', 'Sofía Paredes'].map((n, i) => (
                <Fila key={n} izquierda={<Avatar nombre={n} />} texto={n} detalle={['Off-season WR · 3/4 esta semana', 'Hipertrofia 12 sem · 5/5', 'Fuerza para fútbol · 1/4', 'Sin plan asignado'][i]}
                  derecha={i === 2 ? <Pastilla tono="aviso">Bajando</Pastilla> : i === 3 ? <Pastilla tono="malo">Sin plan</Pastilla> : undefined} onClick={() => {}} />
              ))}
            </Grupo>
          </Seccion>

          <Seccion titulo="11 · Pestañas" nota="Teléfono: arriba y subrayadas, se deslizan si no caben. Computadora: menú a la izquierda.">
            <div style={{ background: '#fff', borderRadius: 18, overflow: 'hidden' }}>
              <Pestanas pestanas={pestanas} activa={pestana} onCambio={setPestana} />
              <div style={{ padding: 16, fontSize: 14, color: KP.ink2 }}>Contenido de «{pestanas.find((p) => p.id === pestana)?.texto}»</div>
            </div>
            <div style={{ maxWidth: 260 }}>
              <PestanasLaterales pestanas={pestanas} activa={pestana} onCambio={setPestana} />
            </div>
          </Seccion>

          <Seccion titulo="12 · Barra de abajo (teléfono)" nota="Atleta: blanca. Coach: azul y flotante.">
            <div style={{ borderRadius: 20, overflow: 'hidden', boxShadow: UI.sombraGrupo }}>
              <BarraInferior activa={barraAtleta} onCambio={setBarraAtleta} secciones={[
                { id: 'home', texto: 'Home', Icono: Home }, { id: 'entrenar', texto: 'Entrenar', Icono: Dumbbell },
                { id: 'mensajes', texto: 'Mensajes', Icono: MessageCircle, aviso: 2 }, { id: 'explorar', texto: 'Explorar', Icono: Compass },
              ]} />
            </div>
            <div style={{ background: '#E9EBF0', borderRadius: 20, paddingTop: 14 }}>
              <BarraInferior variante="coach" activa={barraCoach} onCambio={setBarraCoach} secciones={[
                { id: 'atletas', texto: 'Atletas', Icono: Users }, { id: 'mensajes', texto: 'Mensajes', Icono: MessageCircle, aviso: 3 },
                { id: 'ejercicios', texto: 'Ejercicios', Icono: Library }, { id: 'planes', texto: 'Planes', Icono: FolderOpen }, { id: 'vitrina', texto: 'Vitrina', Icono: Store },
              ]} />
            </div>
          </Seccion>

          <Seccion titulo="13 · Cabecera del coach (teléfono)">
            <div style={{ borderRadius: 24, overflow: 'hidden', background: UI.fondo, paddingBottom: 14 }}>
              <CabeceraConBanda fecha="Hoy, lun 5" saludo="¡Hola, Andrés! 👋" avatar={<Avatar nombre="Andrés Tovar" tamano={48} />} titulo="Mis atletas" detalle="7 atletas · 5 entrenan hoy" />
            </div>
          </Seccion>
        </div>

        <div style={{ marginTop: 40 }}>
          <Seccion titulo="14 · Barra lateral (computadora)" nota="En computadora la barra de abajo se vuelve esta barra a la izquierda.">
            <div style={{ display: 'flex', height: 500, borderRadius: 22, overflow: 'hidden', boxShadow: KP.shRaise, background: UI.fondo }}>
              <BarraLateral subtitulo="Training Lab · Coach" marca="Andrés Tovar" activa={lateral} onCambio={setLateral} secciones={[
                { id: 'atletas', texto: 'Mis atletas', Icono: Users }, { id: 'mensajes', texto: 'Mensajes', Icono: MessageCircle, aviso: 3 },
                { id: 'ejercicios', texto: 'Ejercicios', Icono: Library }, { id: 'planes', texto: 'Mis planes', Icono: FolderOpen },
                { id: 'vitrina', texto: 'Mi vitrina', Icono: Store }, { id: 'avisos', texto: 'Avisos', Icono: Bell },
              ]} pie={<><div style={{ fontSize: 12.5, opacity: 0.75, fontWeight: 600 }}>Tu código de coach</div><div style={{ fontSize: 20, fontWeight: 800, letterSpacing: 1.5 }}>AT-4821</div></>} />
              <div style={{ flex: 1, padding: 24, minWidth: 0 }}>
                <div style={{ fontSize: 26, fontWeight: 800 }}>Mis atletas</div>
                <div style={{ color: KP.ink2, fontSize: 14, marginBottom: 16 }}>7 atletas · 5 entrenan hoy</div>
                <div style={{ display: 'flex', gap: 10, maxWidth: 520 }}>
                  <Buscador valor={busca} onCambio={setBusca} marcador="Buscar atleta…" estilo={{ flex: 1 }} />
                  <Boton>Agregar atleta</Boton>
                </div>
              </div>
            </div>
          </Seccion>
        </div>
      </div>
    </div>
  );
}
