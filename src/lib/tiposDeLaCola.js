/* LOS TIPOS DE COSAS DE LA COLA DEL TELÉFONO (1 nov 2026, encargo «sin conexión», parte 2.2). Cada tipo dice cómo se sube; la cola (`lib/colaDelTelefono.js`) decide
   cuándo, en qué orden y qué hacer si falla. Se registran aquí, al arrancar la app (`main.jsx`), para que lo que ya esperaba en la cola pueda subir desde el primer momento.

   PARTE 3 (el Apple Watch sin el iPhone, ver `lib/relojSinTelefono.js`): lo que llega del reloj entra con el id de su entreno en Apple Salud. Un entreno libre hecho
   en el reloj es un entreno libre más (el mismo tipo); una sesión del plan y el pulso de un entreno que guio el iPhone tienen el suyo. */
import { registraTipoDeCola } from '@/lib/colaDelTelefono';
import { TIPO_ENTRENO_LIBRE, subeEntrenoLibre } from '@/lib/entrenoLibreApi';
import { TIPO_PULSO_DEL_RELOJ, TIPO_SESION_DEL_RELOJ } from '@/lib/relojSinTelefono';
import { subePulsoDelReloj, subeSesionDelReloj } from '@/lib/relojSinTelefonoApi';

// Un entreno libre con su ruta (ver `lib/entrenoLibreApi.js`), hecho en el iPhone o en el reloj.
registraTipoDeCola(TIPO_ENTRENO_LIBRE, { sube: (cosa) => subeEntrenoLibre(cosa) });
// Una sesión del plan hecha en el reloj: sus series al estado del atleta y su pulso y su ruta a `actividades`.
registraTipoDeCola(TIPO_SESION_DEL_RELOJ, { sube: (cosa) => subeSesionDelReloj(cosa) });
// El pulso del reloj de un entreno que guio el iPhone (el reloj acompañó).
registraTipoDeCola(TIPO_PULSO_DEL_RELOJ, { sube: (cosa) => subePulsoDelReloj(cosa, { deporte: cosa.datos?.deporte ?? null }) });
