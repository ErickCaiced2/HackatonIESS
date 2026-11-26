// ZIP sin compresión, para descargar todo el paquete de una sola vez.
const TABLA = Array.from({ length: 256 }, (_, n) => {
  for (let i = 0; i < 8; i++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
function crc32(b) {
  let c = 0xffffffff;
  for (const x of b) c = TABLA[(c ^ x) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// campos: [bytes, valor] en little-endian
function registro(...campos) {
  const b = new Uint8Array(campos.reduce((s, [n]) => s + n, 0));
  const v = new DataView(b.buffer);
  let p = 0;
  for (const [n, x] of campos) {
    if (n === 2) v.setUint16(p, x, true); else v.setUint32(p, x, true);
    p += n;
  }
  return b;
}

const unir = partes => {
  const b = new Uint8Array(partes.reduce((s, x) => s + x.length, 0));
  let p = 0;
  for (const x of partes) { b.set(x, p); p += x.length; }
  return b;
};

export function zip(archivos) { // [[nombre, texto]]
  const cod = new TextEncoder();
  const locales = [], indice = [];
  let desplazamiento = 0;
  const FECHA = (46 << 9) | (11 << 5) | 26; // 2026-11-26
  for (const [nombre, texto] of archivos) {
    const n = cod.encode(nombre), d = cod.encode(texto), crc = crc32(d);
    // 0x0800: nombres en UTF-8
    const comun = [[2, 20], [2, 0x0800], [2, 0], [2, 0], [2, FECHA], [4, crc], [4, d.length], [4, d.length], [2, n.length], [2, 0]];
    const local = unir([registro([4, 0x04034b50], ...comun), n, d]);
    indice.push(unir([registro([4, 0x02014b50], [2, 20], ...comun, [2, 0], [2, 0], [2, 0], [4, 0], [4, desplazamiento]), n]));
    locales.push(local);
    desplazamiento += local.length;
  }
  const central = unir(indice);
  return unir([...locales, central, registro([4, 0x06054b50], [2, 0], [2, 0],
    [2, archivos.length], [2, archivos.length], [4, central.length], [4, desplazamiento], [2, 0])]);
}
