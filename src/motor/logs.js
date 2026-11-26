// Bitácora del sistema para TI: inicios de sesión, peticiones, descargas y errores.
// Solo se agregan entradas; no hay operación para borrarlas ni editarlas.
import { listaPersistente, nuevoId } from './almacen.js';

export const TIPOS_LOG = Object.freeze({
  sesion: 'Inicio de sesión',
  peticion: 'Peticiones',
  descarga: 'Descargas',
  error: 'Errores',
});

export function crearLogs(almacen = globalThis.localStorage) {
  const base = listaPersistente('iess.logs.v1', almacen);
  return {
    persistente: base.persistente,
    // resultado: 'ok' o 'fallo'. detalle: texto sin datos de personas atendidas.
    registrar({ tipo, accion, usuario = '', rol = '', detalle = '', resultado = 'ok', referencia = '' }) {
      if (!TIPOS_LOG[tipo]) throw new Error(`Tipo de log desconocido: ${tipo}`);
      const entrada = { id: nuevoId('LOG'), fecha: new Date().toISOString(), tipo, accion, usuario, rol, detalle, resultado, referencia };
      base.guardar([entrada, ...base.leer()]);
      return entrada;
    },
    lista: tipo => base.leer().filter(l => !tipo || l.tipo === tipo),
  };
}

const dia = iso => {
  const d = new Date(iso);
  const dos = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
};

// Conteo por día de los últimos `dias` días (incluido hoy) para el gráfico de actividad.
export function actividadPorDia(logs, dias = 14, hoy = new Date()) {
  const serie = [];
  for (let i = dias - 1; i >= 0; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - i);
    serie.push({ dia: dia(d.toISOString()), sesion: 0, peticion: 0, descarga: 0, error: 0 });
  }
  const porDia = new Map(serie.map(s => [s.dia, s]));
  for (const l of logs) {
    const s = porDia.get(dia(l.fecha));
    if (s && s[l.tipo] !== undefined) s[l.tipo]++;
  }
  return serie;
}

// Incidencias: errores, inicios de sesión fallidos y peticiones devueltas.
export function incidencias(logs) {
  return {
    errores: logs.filter(l => l.tipo === 'error').length,
    sesionesFallidas: logs.filter(l => l.tipo === 'sesion' && l.resultado === 'fallo').length,
    devoluciones: logs.filter(l => l.tipo === 'peticion' && l.accion === 'Devuelta al comité').length,
  };
}
