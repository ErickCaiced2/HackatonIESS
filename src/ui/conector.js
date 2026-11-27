// Origen «Base de datos» del paso 1: habla con el conector local (carpeta conector/), que lee PostgreSQL
// con un usuario de solo lectura. El navegador nunca recibe la contraseña de la base.
// El código de acceso solo vive en memoria; la dirección se recuerda en esta pestaña.
import { h, boton, aviso, datosClave } from './dom.js';

const CLAVE = 'sead.conector.v1';
// Solo direcciones de este equipo: los datos no deben ir a otro servidor.
const LOCAL = /^http:\/\/(127\.0\.0\.1|localhost):\d{2,5}\/?$/;
const estado = { url: 'http://127.0.0.1:8790', codigo: '', info: null, tabla: '', error: '', ocupado: false };
try {
  const guardado = JSON.parse(globalThis.sessionStorage?.getItem(CLAVE) ?? 'null');
  if (LOCAL.test(guardado?.url ?? '')) estado.url = guardado.url;
} catch { /* sin almacenamiento: se usa la dirección por defecto */ }

async function pedir(ruta, opciones = {}) {
  if (!LOCAL.test(estado.url)) throw new Error('La dirección del conector debe ser de este equipo: http://127.0.0.1:PUERTO o http://localhost:PUERTO.');
  if (!estado.codigo.trim()) throw new Error('Escriba el código de acceso que muestra el conector al iniciarse.');
  let r;
  try {
    r = await fetch(estado.url.replace(/\/$/, '') + ruta, { ...opciones, cache: 'no-store',
      headers: { 'X-Conector-Codigo': estado.codigo.trim(), ...(opciones.body ? { 'Content-Type': 'application/json' } : {}) } });
  } catch {
    throw new Error('No se pudo contactar al conector. Revise que esté iniciado (npm start en la carpeta conector) y que la dirección sea correcta.');
  }
  if (!r.ok) {
    let mensaje = 'El conector respondió con un error.';
    try { mensaje = (await r.json()).error ?? mensaje; } catch { /* respuesta sin cuerpo */ }
    throw new Error(mensaje);
  }
  return r;
}

export function panelBaseDatos({ repintar, alTraer, registrar }) {
  const correr = async fn => {
    estado.ocupado = true; estado.error = ''; repintar();
    try { await fn(); } catch (e) { estado.error = e.message; }
    estado.ocupado = false; repintar();
  };
  const conectar = () => correr(async () => {
    estado.info = null;
    estado.info = await (await pedir('/estado')).json();
    estado.tabla = estado.info.tablas.some(t => t.id === estado.tabla) ? estado.tabla : (estado.info.tablas[0]?.id ?? '');
    try { globalThis.sessionStorage?.setItem(CLAVE, JSON.stringify({ url: estado.url })); } catch { /* opcional */ }
    registrar('Conexión a la base de datos', `${estado.info.base} · usuario ${estado.info.usuario}`);
  });
  const traer = () => correr(async () => {
    const r = await pedir('/extraer', { method: 'POST', body: JSON.stringify({ tabla: estado.tabla }) });
    const texto = await r.text();
    registrar('Datos traídos de la base de datos', `${estado.tabla} · ${r.headers.get('X-Filas') ?? '?'} fila(s)`);
    await alTraer(texto, `${estado.tabla} (base ${estado.info.base})`);
  });
  const i = estado.info;
  return h('div', { className: 'origen-bdd' },
    h('p', { className: 'nota' }, 'Lee una tabla o vista con un usuario de solo lectura, a través del conector que corre en este equipo. La contraseña de la base nunca pasa por el navegador.'),
    h('div', { className: 'fila' },
      h('label', {}, 'Dirección del conector',
        h('input', { id: 'bdd-url', value: estado.url, spellcheck: false, autocomplete: 'off', oninput: e => { estado.url = e.target.value.trim(); } })),
      h('label', {}, 'Código de acceso',
        h('input', { id: 'bdd-codigo', type: 'password', value: estado.codigo, autocomplete: 'off', oninput: e => { estado.codigo = e.target.value; } }),
        h('small', {}, 'Lo muestra el conector al iniciarse.'))),
    h('div', { className: 'acciones' }, boton(estado.ocupado ? 'Conectando…' : i ? 'Volver a conectar' : 'Conectar', conectar,
      { id: 'bdd-conectar', className: i ? '' : 'principal', disabled: estado.ocupado })),
    estado.error && aviso('mal', estado.error),
    i && [
      datosClave([['Base de datos', i.base], ['Usuario', `${i.usuario} · consultas de solo lectura`], ['Servidor', i.version], ['Máximo por lectura', `${i.maxFilas.toLocaleString('es-EC')} filas`]]),
      i.tablas.length === 0
        ? aviso('aviso', 'El usuario del conector no puede leer ninguna tabla. Pida al administrador permiso SELECT sobre la vista de atenciones.')
        : [h('label', {}, 'Tabla o vista con las atenciones',
          h('select', { id: 'bdd-tabla', onchange: e => { estado.tabla = e.target.value; repintar(); } },
            i.tablas.map(t => h('option', { value: t.id, selected: t.id === estado.tabla }, t.id + (t.vista ? ' (vista)' : ''))))),
        h('div', { className: 'acciones' }, boton(estado.ocupado ? 'Trayendo…' : 'Traer los datos', traer,
          { id: 'bdd-traer', className: 'principal', disabled: estado.ocupado || !estado.tabla }))],
    ]);
}
