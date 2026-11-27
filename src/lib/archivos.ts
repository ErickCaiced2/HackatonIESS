"use client";

// Archivos del prototipo (PDF de aprobación y entregables publicados) en IndexedDB del navegador.
// Mantiene exactamente el mismo esquema BD/tabla que el prototipo original.
const BD = "iess-archivos";
const TABLA = "archivos";
const memoria = new Map<string, unknown>();

function abrir(): Promise<IDBDatabase | null> {
  return new Promise((resolver, rechazar) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      resolver(null);
      return;
    }
    const pedido = window.indexedDB.open(BD, 1);
    pedido.onupgradeneeded = () => {
      if (!pedido.result.objectStoreNames.contains(TABLA)) {
        pedido.result.createObjectStore(TABLA);
      }
    };
    pedido.onsuccess = () => resolver(pedido.result);
    pedido.onerror = () =>
      rechazar(
        new Error(
          "No se pudo abrir el almacenamiento de archivos del navegador."
        )
      );
  });
}

async function operar<T>(
  modo: IDBTransactionMode,
  fn: (store: IDBObjectStore | null) => IDBRequest<T> | unknown
): Promise<T | undefined> {
  const bd = await abrir();
  if (!bd) return fn(null) as T | undefined;
  return new Promise((resolver, rechazar) => {
    const tx = bd.transaction(TABLA, modo);
    const pedido = fn(tx.objectStore(TABLA)) as IDBRequest<T> | undefined;
    tx.oncomplete = () => resolver(pedido?.result);
    tx.onerror = () =>
      rechazar(
        new Error(
          "No se pudo guardar el archivo: el almacenamiento del navegador está lleno o bloqueado."
        )
      );
  });
}

export const guardarArchivo = (clave: string, valor: unknown) =>
  operar("readwrite", (t) => (t ? t.put(valor, clave) : memoria.set(clave, valor)));

export const leerArchivo = async <T = unknown>(
  clave: string
): Promise<T | null> => {
  const bd = await abrir();
  if (!bd) return (memoria.get(clave) as T) ?? null;
  return new Promise((resolver, rechazar) => {
    const pedido = bd.transaction(TABLA).objectStore(TABLA).get(clave);
    pedido.onsuccess = () => resolver((pedido.result as T) ?? null);
    pedido.onerror = () =>
      rechazar(new Error("No se pudo leer el archivo guardado."));
  });
};
