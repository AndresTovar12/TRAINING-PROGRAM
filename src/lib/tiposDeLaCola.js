/* LOS TIPOS DE COSAS DE LA COLA DEL TELÉFONO (1 nov 2026, encargo «sin conexión», parte 2.2). Cada tipo dice cómo se sube; la cola (`lib/colaDelTelefono.js`) decide
   cuándo, en qué orden y qué hacer si falla. Se registran aquí, al arrancar la app (`main.jsx`), para que lo que ya esperaba en la cola pueda subir desde el primer momento.

   PARTE 3 (Apple Watch): registrar aquí sus tipos (p. ej. 'reloj-entreno'), cada uno con su `sube(cosa)`. Ver las reglas en `lib/colaDelTelefono.js`. */
import { registraTipoDeCola } from '@/lib/colaDelTelefono';
import { TIPO_ENTRENO_LIBRE, subeEntrenoLibre } from '@/lib/entrenoLibreApi';

// Un entreno libre con su ruta (ver `lib/entrenoLibreApi.js`).
registraTipoDeCola(TIPO_ENTRENO_LIBRE, { sube: (cosa) => subeEntrenoLibre(cosa) });
