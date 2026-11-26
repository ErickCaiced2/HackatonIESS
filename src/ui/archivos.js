// Archivos del prototipo (PDF de aprobación y entregables publicados) en IndexedDB del navegador.
// Simula el almacenamiento del servidor: los comparten los usuarios que entran en este navegador.
const BD = 'iess-archivos', TABLA = 'archivos';
const memoria = new Map();

function abrir() {
  return new Promise((resolver, rechazar) => {
    if (!globalThis.indexedDB) { resolver(null); return; }
    const pedido = indexedDB.open(BD, 1);
    pedido.onupgradeneeded = () => pedido.result.createObjectStore(TABLA);
    pedido.onsuccess = () => resolver(pedido.result);
    pedido.onerror = () => rechazar(new Error('No se pudo abrir el almacenamiento de archivos del navegador.'));
  });
}

async function operar(modo, fn) {
  const bd = await abrir();
  if (!bd) return fn(null);
  return new Promise((resolver, rechazar) => {
    const tx = bd.transaction(TABLA, modo);
    const pedido = fn(tx.objectStore(TABLA));
    tx.oncomplete = () => resolver(pedido?.result);
    tx.onerror = () => rechazar(new Error('No se pudo guardar el archivo: el almacenamiento del navegador está lleno o bloqueado.'));
  });
}

export const guardarArchivo = (clave, valor) => operar('readwrite', t => (t ? t.put(valor, clave) : memoria.set(clave, valor)));
export const leerArchivo = async clave => {
  const bd = await abrir();
  if (!bd) return memoria.get(clave) ?? null;
  return new Promise((resolver, rechazar) => {
    const pedido = bd.transaction(TABLA).objectStore(TABLA).get(clave);
    pedido.onsuccess = () => resolver(pedido.result ?? null);
    pedido.onerror = () => rechazar(new Error('No se pudo leer el archivo guardado.'));
  });
};
