// Servicios compartidos por las vistas: almacenes, sesión, logs y manejo de errores.
import { crearRegistro } from '../motor/registro.js';
import { crearPeticiones } from '../motor/peticiones.js';
import { crearLogs } from '../motor/logs.js';
import { h, notificar, cerrarNotificaciones } from './dom.js';

export const registro = crearRegistro();
export const peticiones = crearPeticiones();
export const logs = crearLogs();

// La sesión dura lo que la pestaña (sessionStorage); los datos compartidos viven en localStorage.
const CLAVE_SESION = 'iess.sesion.v1';
export const sesion = {
  actual() { try { return JSON.parse(globalThis.sessionStorage?.getItem(CLAVE_SESION) ?? 'null'); } catch { return null; } },
  iniciar(usuario) { globalThis.sessionStorage?.setItem(CLAVE_SESION, JSON.stringify({ ...usuario, desde: new Date().toISOString() })); },
  cerrar() { globalThis.sessionStorage?.removeItem(CLAVE_SESION); },
};

// Registra una entrada en la bitácora con el usuario de la sesión. Nunca interrumpe la acción.
export function log(tipo, accion, detalle = '', extra = {}) {
  const u = sesion.actual();
  try { return logs.registrar({ tipo, accion, detalle, usuario: u?.usuario ?? '', rol: u?.rol ?? '', ...extra }); } catch { return null; }
}

// Cada error explica cómo recuperarse.
const SOLUCIONES = [
  [/separador|encabezado|Excel|primera fila/, 'Use un archivo de texto con una fila de nombres de columna y una fila por atención.'],
  [/Faltan columnas|sin clasificar|repetidas/, 'Use un archivo con las 28 columnas del diccionario, sin cambiar sus nombres.'],
  [/Filas inválidas|comilla/, 'Corrija esas filas en el archivo original y vuelva a cargarlo.'],
  [/vacía|vacío|no tiene filas/, 'Revise que sea el archivo correcto y que el filtro de la petición tenga casos.'],
  [/provincia/, 'Corrija la columna provincia usando los nombres de las 24 provincias.'],
  [/digest|subtle/, 'Abra la página con la dirección 127.0.0.1 de Live Server, no con una IP de la red.'],
  [/almacenamiento/, 'Libere espacio del navegador o use otro navegador.'],
  [/no puede pasar|Solo el destinatario|Firme/, 'Actualice la página: la petición pudo cambiar de estado.'],
];

// Los errores se muestran como aviso rojo arriba a la derecha y quedan en los logs de TI.
export function mostrarError(mensaje, contexto = 'Error') {
  cerrarNotificaciones('mal');
  if (!mensaje) return;
  log('error', contexto, mensaje, { resultado: 'fallo' });
  const solucion = SOLUCIONES.find(([patron]) => patron.test(mensaje))?.[1] ?? 'Revise el último paso e inténtelo de nuevo.';
  notificar('mal', h('p', {}, h('strong', {}, 'No se pudo completar. '), mensaje), h('p', {}, h('strong', {}, 'Qué hacer: '), solucion));
}

export const fechaHora = iso => (iso ? new Date(iso).toLocaleString('es-EC', { dateStyle: 'medium', timeStyle: 'medium' }) : '—');
export const fechaCorta = iso => (iso ? new Date(iso).toLocaleString('es-EC', { dateStyle: 'short', timeStyle: 'short' }) : '—');

export async function sha256Bytes(buffer) {
  const hsh = await globalThis.crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(hsh)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export function descargar(nombre, contenido, tipo) {
  const url = URL.createObjectURL(contenido instanceof Blob ? contenido : new Blob([contenido], { type: tipo }));
  const enlace = h('a', { href: url, download: nombre });
  document.body.append(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
