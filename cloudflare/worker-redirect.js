/* `traininglabapp.com` y `www.traininglabapp.com` llevan a la app (`app.traininglabapp.com`), conservando la ruta.
   Es una redirección TEMPORAL (302) a propósito: si algún día esas direcciones tienen una página de presentación, los navegadores no se quedan con la redirección guardada. */
export default {
  fetch(peticion) {
    const url = new URL(peticion.url);
    return Response.redirect(`https://app.traininglabapp.com${url.pathname}${url.search}`, 302);
  },
};
