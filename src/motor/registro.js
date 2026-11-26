// Registro de ejecuciones y descargas para el tablero.
// Solo guarda metadatos de cada ejecución: nunca filas, cédulas ni valores de celdas.
const CLAVE = 'iess.registro.v1';
const MAXIMO = 200;

const cuantos = (lista, clave) => lista.reduce((a, x) => ({ ...a, [x[clave]]: (a[x[clave]] ?? 0) + 1 }), {});

// Resume una ejecución del motor en una entrada del registro.
export function entradaDeEjecucion(r, { archivo = '', solicitadoEn = r.fecha } = {}) {
  const aplicadas = r.traza.filter(t => t.estado === 'Aplicada' && t.tecnica !== 'Conservar');
  const clasificadas = r.traza.filter(t => t.clasificacion);
  return {
    id: r.id,
    archivo,
    configuracion: r.config.tipo,
    solicitadoEn,
    elaboradoEn: r.fecha,
    kMeta: r.config.k,
    kAntes: r.antes.kMin,
    kDespues: r.despues.kMin,
    anonimizaciones: aplicadas.length,
    tecnicas: cuantos(aplicadas, 'tecnica'),
    celdasModificadas: aplicadas.reduce((a, t) => a + t.valores_modificados, 0),
    personasAntes: r.cohorte.personas,
    personasDespues: r.despues.personas,
    columnasClasificadas: clasificadas.length,
    totalColumnas: r.traza.length,
    clasificaciones: cuantos(clasificadas, 'clasificacion'),
    verificacionesCorrectas: r.verificaciones.filter(v => v.ok).length,
    verificacionesTotal: r.verificaciones.length,
    apto: r.apto,
    descargas: [],
  };
}

// Totales para las tarjetas del tablero.
export function resumenRegistro(lista) {
  const descargas = lista.flatMap(e => e.descargas.map(d => ({ ...d, id: e.id })))
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
  return {
    ejecuciones: lista.length,
    aptas: lista.filter(e => e.apto).length,
    anonimizaciones: lista.reduce((a, e) => a + e.anonimizaciones, 0),
    descargas: descargas.length,
    ultima: lista[0] ?? null,
    ultimaDescarga: descargas[0] ?? null,
  };
}

function memoria() {
  const m = new Map();
  return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) };
}

// El almacén por defecto es el localStorage del navegador; si no existe, la memoria.
export function crearRegistro(almacen = globalThis.localStorage) {
  let persistente = !!almacen;
  if (almacen) {
    try { almacen.setItem(CLAVE + '.prueba', '1'); almacen.removeItem(CLAVE + '.prueba'); } catch { persistente = false; }
  }
  const destino = persistente ? almacen : memoria();
  const lista = () => {
    try {
      const v = JSON.parse(destino.getItem(CLAVE) ?? '[]');
      return Array.isArray(v) ? v : [];
    } catch { return []; }
  };
  const guardar = l => destino.setItem(CLAVE, JSON.stringify(l.slice(0, MAXIMO)));
  return {
    persistente,
    lista,
    // La más reciente primero.
    agregar(entrada) { guardar([entrada, ...lista().filter(e => e.id !== entrada.id)]); },
    descarga(id, archivo, fecha = new Date().toISOString()) {
      const l = lista();
      const e = l.find(x => x.id === id);
      if (!e) return false;
      e.descargas.push({ archivo, fecha });
      guardar(l);
      return true;
    },
    borrar() { destino.removeItem(CLAVE); },
  };
}
