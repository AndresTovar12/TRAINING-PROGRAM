/* El `@/contexts/VistaContext` de la app, de mentiras, para las pruebas de Node (`scripts/prueba-marcador-al-abrir.mjs`): la app propia de la cuenta que la prueba
   ponga en `globalThis.__cuentaFalsa` (nunca «Ver como»). Solo para pruebas. */
export function usePerfilDeLaVista() {
  const userId = globalThis.__cuentaFalsa ?? null;
  return { perfil: userId ? { id: userId } : null, userId, soloLectura: false };
}
