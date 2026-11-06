import { useMemo } from 'react';
import { Tag } from 'lucide-react';
import { ICONO_NEUTRO, sugiereIcono } from '@/lib/iconosDeTipo';
import { useCatalogoDeIconos } from '@/lib/useCatalogoDeIconos';

/**
 * El dibujo de un ícono del catálogo de tipos de sesión, con las mismas propiedades que un ícono de lucide (`size`, `strokeWidth`, `color`,
 * `className`, `style`…), para que cualquier pantalla que ya pinta `<Icono size={22} />` pinte los dos sin enterarse.
 *
 * `svg` es el INTERIOR del dibujo y sale del catálogo del propio repo (`lib/iconosDeTipo.datos.js`), nunca de la base ni de una persona: por eso se
 * puede poner con `dangerouslySetInnerHTML`. Si algún día un dibujo viniera de fuera, hay que limpiarlo antes de llegar aquí.
 */
export function IconoSvg({ svg, size = 24, strokeWidth = 2, color = 'currentColor', caja = '0 0 24 24', relleno = false, ...resto }) {
  // Los de Phosphor son RELLENOS en una caja de 256 (`caja` y `relleno` en el catálogo): sin trazo y con el color de relleno. Los demás, de línea en 24.
  const trazo = relleno ? { fill: color, stroke: 'none' } : { fill: 'none', stroke: color, strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round' };
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg" viewBox={caja} width={size} height={size} {...trazo}
      aria-hidden="true" focusable="false" {...resto} dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

/**
 * El ícono de un tipo propio del coach: el que eligió (`id`), o —en un tipo que se creó antes de que hubiera íconos, o que escribió la IA— el que
 * mejor le va a su `nombre` («Boxeo» → guante), o una etiqueta.
 *
 * El catálogo baja la primera vez que alguien pinta uno (ver `lib/iconosDeTipo.js`); mientras tanto sale la etiqueta, que es el mismo dibujo que
 * el ícono «Etiqueta» del catálogo, así que si el tipo no tiene otro no hay ningún salto. `alternativo`: otro componente (de lucide) que sale en lugar de la
 * etiqueta mientras baja, para quien ya sabe cuál dibujo lleva (los tipos de la app).
 */
export default function IconoDeTipo({ id = null, nombre = '', size = 24, alternativo = null, ...resto }) {
  const catalogo = useCatalogoDeIconos();
  const dibujo = useMemo(() => {
    if (!catalogo) return null;
    return catalogo.porId.get(id) ?? catalogo.porId.get(sugiereIcono(catalogo, nombre)) ?? catalogo.porId.get(ICONO_NEUTRO) ?? null;
  }, [catalogo, id, nombre]);
  if (dibujo) return <IconoSvg svg={dibujo.svg} caja={dibujo.caja} relleno={dibujo.relleno} size={size} {...resto} />;
  const Alternativo = alternativo ?? Tag;
  return <Alternativo size={size} {...resto} />;
}
