/**
 * Prueba de `estructuraDe` y `lectorRemoto` (src/lib/indiceDeVideo.js) con
 * archivos armados a mano: solo las cajas de arriba, sin imagen ni sonido.
 *
 * QUÉ CUIDA. `estructuraDe` decide si un video necesita que le pongan el
 * índice. Un error en un sentido sube un video lento sin que nadie lo note; en
 * el otro, reempaqueta uno que ya estaba bien (trabajo de más, y un riesgo de
 * más). Y `lectorRemoto` es lo que revisa los videos que ya están en Cloudflare:
 * no debe bajarlos enteros si el servidor no entiende «dame este pedazo».
 *
 *   node scripts/prueba-indice-de-video.mjs
 *
 * La conversión en sí (paquete por paquete contra el original) se probó con los
 * 17 videos reales y no cabe aquí: necesita los archivos.
 */
import http from 'node:http';
import assert from 'node:assert/strict';
import { estructuraDe, lectorDeArchivo, lectorRemoto } from '../src/lib/indiceDeVideo.js';

const u32 = (n) => { const b = Buffer.alloc(4); b.writeUInt32BE(n); return b; };
const caja = (tipo, ...cuerpo) => {
  const dentro = Buffer.concat(cuerpo);
  return Buffer.concat([u32(8 + dentro.length), Buffer.from(tipo, 'latin1'), dentro]);
};
const relleno = (n) => Buffer.alloc(n, 7);
const ftyp = caja('ftyp', Buffer.from('isom'), u32(0), Buffer.from('isomiso5'));
const mvhd = caja('mvhd', relleno(100));
const trak = caja('trak', relleno(300));
const mvex = caja('mvex', caja('trex', relleno(20)));
const soloAlgo = (buf) => new Blob([buf]);

let malos = 0;
const prueba = async (nombre, buf, esperado) => {
  const f = soloAlgo(buf);
  const { tipo } = await estructuraDe(lectorDeArchivo(f), f.size);
  const bien = tipo === esperado;
  if (!bien) malos += 1;
  console.log(`${bien ? '  ✔' : '  ✘'} ${nombre} → ${tipo}${bien ? '' : `  (debía ser ${esperado})`}`);
};

console.log('estructuraDe');
await prueba('lo que graba el navegador (moov con mvex, moof, mdat, mfra)',
  Buffer.concat([ftyp, caja('moov', mvhd, trak, mvex), caja('moof', relleno(60)), caja('mdat', relleno(900)), caja('mfra', relleno(40))]), 'fragmentado');
await prueba('mvex es lo ÚLTIMO dentro del moov',
  Buffer.concat([ftyp, caja('moov', mvhd, trak, trak, trak, mvex), caja('mdat', relleno(100))]), 'fragmentado');
await prueba('un segmento (styp) con moof', Buffer.concat([caja('styp', Buffer.from('msdh')), caja('moof', relleno(60)), caja('mdat', relleno(100))]), 'fragmentado');
await prueba('índice al principio y datos de corrido', Buffer.concat([ftyp, caja('moov', mvhd, trak), caja('free', relleno(20)), caja('mdat', relleno(5000))]), 'bueno');
await prueba('índice al final (típico del carrete)', Buffer.concat([ftyp, caja('wide'), caja('mdat', relleno(5000)), caja('moov', mvhd, trak)]), 'moov-al-final');
{
  // mdat con tamaño de 64 bits (`size === 1`), como los archivos grandes
  const dentro = relleno(3000);
  const mdatGrande = Buffer.concat([u32(1), Buffer.from('mdat'), Buffer.from([0, 0, 0, 0, 0, 0, 0x0b, 0xc8]), dentro]); // 16 + 3000 = 3016 = 0x0BC8
  await prueba('mdat de 64 bits y el índice después', Buffer.concat([ftyp, mdatGrande, caja('moov', mvhd, trak)]), 'moov-al-final');
}
await prueba('mdat «hasta el final» y sin índice: no se puede', Buffer.concat([ftyp, u32(0), Buffer.from('mdat'), relleno(400)]), 'otro');
await prueba('un WebM', Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), relleno(500)]), 'otro');
await prueba('basura', Buffer.from(Array.from({ length: 4000 }, (_, i) => (i * 37 + 11) % 251)), 'otro');
await prueba('vacío', Buffer.alloc(0), 'otro');
await prueba('cortado a media caja', Buffer.concat([ftyp, caja('moov', mvhd, trak, mvex)]).subarray(0, 60), 'otro');

console.log('\nlectorRemoto');
const fragmentado = Buffer.concat([ftyp, caja('moov', mvhd, trak, mvex), caja('moof', relleno(60)), caja('mdat', relleno(900))]);
let pedidos = 0;
let aceptaRango = true;
const servidor = http.createServer((req, res) => {
  pedidos += 1;
  const m = /bytes=(\d+)-(\d*)/.exec(req.headers.range || '');
  if (!aceptaRango || !m) { res.writeHead(200, { 'content-length': fragmentado.length }); res.end(fragmentado); return; }
  const ini = Number(m[1]);
  const fin = Math.min(m[2] ? Number(m[2]) : fragmentado.length - 1, fragmentado.length - 1);
  res.writeHead(206, { 'content-range': `bytes ${ini}-${fin}/${fragmentado.length}`, 'content-length': fin - ini + 1 });
  res.end(fragmentado.subarray(ini, fin + 1));
});
await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
const url = `http://127.0.0.1:${servidor.address().port}/v.mp4`;
{
  const { tipo } = await estructuraDe(lectorRemoto(url), fragmentado.length);
  const bien = tipo === 'fragmentado' && pedidos === 1;
  if (!bien) malos += 1;
  console.log(`${bien ? '  ✔' : '  ✘'} revisa un video remoto con UN solo pedido → ${tipo}, ${pedidos} pedido(s)`);
}
{
  aceptaRango = false;
  pedidos = 0;
  const { tipo } = await estructuraDe(lectorRemoto(url), fragmentado.length);
  const bien = tipo === 'otro';
  if (!bien) malos += 1;
  console.log(`${bien ? '  ✔' : '  ✘'} un servidor que ignora «Range» no se toma por bueno ni se baja entero → ${tipo}`);
}
servidor.close();

assert.equal(malos, 0, `${malos} pruebas fallaron`);
console.log('\n✔ todo en orden');
