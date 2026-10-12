import { Share2 } from 'lucide-react';
import { sellosDeActividad } from '@/lib/sello/datos';
import Widget from './Widget';

/* EL WIDGET «ACTIVITY CARD» de Home (12 oct 2026): oscuro, con una mini activity card inclinada que asoma y lleva los números REALES de su último entreno (los mismos que lleva su tarjeta).
   Sin entrenos todavía enseña una de ejemplo (dice «Ejemplo») para que se entienda qué es y qué se gana al entrenar. Tocarlo abre su última tarjeta; sin entrenos, la hoja de deportes. */

const EJEMPLO = [{ label: 'Distance', valor: '5.00', unidad: 'km' }, { label: 'Pace', valor: '5:30', unidad: '/km' }, { label: 'Time', valor: '27:30', unidad: 'min' }];

function MiniTarjeta({ filas, ejemplo }) {
  return (
    <span className="tl-w-mini" aria-hidden="true">
      {ejemplo && <em>Ejemplo</em>}
      {filas.map((f) => <span key={f.label}><b>{f.valor}</b><small>{f.unidad}</small></span>)}
      {!ejemplo && <i>T•LAB</i>}
    </span>
  );
}

export default function WidgetDeActivityCard({ ultimo, alTocar }) {
  const sello = ultimo ? sellosDeActividad({ fila: ultimo }).sellos[0] : null;
  const real = sello?.filas?.slice(0, 3);
  const ejemplo = !real?.length;
  return (
    <Widget
      tono="tinta" Icono={Share2} titulo="Activity card" alTocar={alTocar} flecha={false}
      sub="Para tus historias"
      etiqueta={ejemplo ? 'Activity card. Entrena y sácala para tus historias' : 'Abrir la activity card de tu último entreno'}
      decoracion={<MiniTarjeta filas={ejemplo ? EJEMPLO : real} ejemplo={ejemplo} />}
    />
  );
}
