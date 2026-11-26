// Lista JSON persistente en el almacén del navegador (localStorage) o, si no existe, en memoria.
// Lo usan el registro de ejecuciones, las peticiones y los logs: simula el servidor del prototipo.
function memoria() {
  const m = new Map();
  return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) };
}

export function listaPersistente(clave, almacen = globalThis.localStorage) {
  let persistente = !!almacen;
  if (almacen) {
    try { almacen.setItem(clave + '.prueba', '1'); almacen.removeItem(clave + '.prueba'); } catch { persistente = false; }
  }
  const destino = persistente ? almacen : memoria();
  return {
    persistente,
    leer() {
      try {
        const v = JSON.parse(destino.getItem(clave) ?? '[]');
        return Array.isArray(v) ? v : [];
      } catch { return []; }
    },
    guardar(lista) {
      try { destino.setItem(clave, JSON.stringify(lista)); }
      catch { throw new Error('No se pudo guardar: el almacenamiento del navegador está lleno.'); }
    },
  };
}

// Identificador legible con fecha y parte aleatoria: PET-20261126-4821.
export function nuevoId(prefijo, ahora = new Date()) {
  const b = new Uint32Array(1);
  globalThis.crypto.getRandomValues(b);
  const dia = ahora.toISOString().slice(0, 10).replace(/-/g, '');
  return `${prefijo}-${dia}-${String(b[0] % 10000).padStart(4, '0')}`;
}
