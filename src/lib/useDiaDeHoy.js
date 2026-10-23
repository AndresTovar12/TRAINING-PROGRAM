import { useEffect, useState } from 'react';

const claveDeHoy = (d = new Date()) => {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

/**
 * La fecha de hoy (un `Date` que solo se renueva cuando el día cambia). Cambia sola en cuanto el día cambia con la app abierta (pasa la medianoche, o el atleta regresa
 * a la app después de horas); así lo que se calcula «con la fecha de hoy» se vuelve a calcular y la tira no marca dos «hoy».
 */
export function useDiaDeHoy() {
  const [hoy, setHoy] = useState(() => new Date());
  useEffect(() => {
    const revisa = () => setHoy((antes) => (claveDeHoy(antes) === claveDeHoy() ? antes : new Date()));
    let tictac;
    const programa = () => {
      const m = new Date(); m.setHours(24, 0, 1, 0);
      tictac = setTimeout(() => { revisa(); programa(); }, m - Date.now());
    };
    programa();
    const alVolver = () => { if (document.visibilityState === 'visible') revisa(); };
    document.addEventListener('visibilitychange', alVolver);
    window.addEventListener('focus', revisa);
    return () => { clearTimeout(tictac); document.removeEventListener('visibilitychange', alVolver); window.removeEventListener('focus', revisa); };
  }, []);
  return hoy;
}
