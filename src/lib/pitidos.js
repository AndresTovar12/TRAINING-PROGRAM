/**
 * Los pitidos del reloj de un Set con formato: los tres últimos segundos de cada tramo, el
 * cambio de tramo y el final.
 *
 * Con WebAudio y un oscilador, sin archivos de sonido: no hay nada que bajar ni que se pueda
 * quedar sin red. Un navegador solo deja sonar después de un toque del usuario, así que
 * `preparaAudio` se llama desde el botón de «Iniciar» (o de «Seguir»), que es justo ese toque.
 * Si el teléfono está en silencio o el navegador no tiene audio, no pasa nada: el reloj sigue
 * funcionando igual, solo sin sonido.
 */

let audio = null;

/** Despierta el audio. Va dentro de un toque del atleta (iniciar, seguir, quitar el silencio). */
export function preparaAudio() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    audio = audio ?? new AudioCtx();
    if (audio.state === 'suspended') audio.resume();
  } catch {
    audio = null;
  }
}

function tono(frecuencia, inicio, duracion, volumen = 0.3) {
  if (!audio) return;
  const t0 = audio.currentTime + inicio;
  const osc = audio.createOscillator();
  const ganancia = audio.createGain();
  osc.type = 'sine';
  osc.frequency.value = frecuencia;
  // Sube y baja el volumen en vez de cortar de golpe: un corte seco suena a «clic».
  ganancia.gain.setValueAtTime(0.0001, t0);
  ganancia.gain.exponentialRampToValueAtTime(volumen, t0 + 0.01);
  ganancia.gain.exponentialRampToValueAtTime(0.0001, t0 + duracion);
  osc.connect(ganancia).connect(audio.destination);
  osc.start(t0);
  osc.stop(t0 + duracion + 0.02);
}

/** 'cuenta' (3, 2, 1) · 'cambio' (empieza otro tramo) · 'fin' (se acabó). */
export function pitido(tipo) {
  try {
    if (tipo === 'cuenta') tono(880, 0, 0.12);
    else if (tipo === 'cambio') tono(1320, 0, 0.35);
    else if (tipo === 'fin') { tono(1320, 0, 0.25); tono(1320, 0.35, 0.25); tono(1760, 0.7, 0.6); }
  } catch {
    // Sin sonido: el reloj no depende de él.
  }
}
