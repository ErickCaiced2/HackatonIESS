// Conector local de SEAD-IESS a PostgreSQL.
// El navegador no puede abrir una conexión a la base de datos: este servicio corre en el mismo equipo,
// lee una tabla o vista con un usuario de SOLO LECTURA y entrega las filas a la app como texto CSV.
//
// Seguridad:
// - Escucha solo en 127.0.0.1 y rechaza cualquier Host que no sea local (evita «DNS rebinding»).
// - Exige el código de acceso que imprime al arrancar (cabecera X-Conector-Codigo) y solo responde a los
//   orígenes permitidos (CORS). Otra página web no puede usarlo.
// - Las credenciales de la base viven en variables de entorno de este proceso, nunca en el navegador.
// - Solo lee tablas o vistas que el usuario puede consultar (lista blanca); nada de SQL libre.
// - Cada consulta corre en una transacción READ ONLY con tiempo límite y un máximo de filas.
// - No escribe valores de las filas en la consola ni en archivos: solo tabla, cantidad de filas y hora.
import http from 'node:http';
import crypto from 'node:crypto';
import pg from 'pg';

const env = process.env;
const PUERTO = Number(env.SEAD_PUERTO ?? 8790);
const MAX_FILAS = Number(env.SEAD_MAX_FILAS ?? 200000);
const ORIGENES = (env.SEAD_ORIGENES ?? 'http://127.0.0.1:5500,http://localhost:5500').split(',').map(x => x.trim()).filter(Boolean);
const CODIGO = env.SEAD_CODIGO ?? crypto.randomBytes(9).toString('base64url');
const HOSTS = new Set([`127.0.0.1:${PUERTO}`, `localhost:${PUERTO}`]);

// Fechas y números tal como vienen de la base (texto), sin convertirlos a la zona horaria local.
for (const oid of [1082, 1114, 1184, 1700]) pg.types.setTypeParser(oid, v => v);

const pool = new pg.Pool({
  host: env.SEAD_PGHOST ?? '127.0.0.1', port: Number(env.SEAD_PGPORT ?? 5432),
  database: env.SEAD_PGDATABASE, user: env.SEAD_PGUSER, password: env.SEAD_PGPASSWORD,
  ssl: env.SEAD_PGSSL === '1' ? { rejectUnauthorized: true } : undefined,
  max: 2, statement_timeout: 30000, query_timeout: 35000, connectionTimeoutMillis: 8000,
  application_name: 'sead-iess-conector',
});

const registrar = (...partes) => console.log(new Date().toISOString(), ...partes);

// Tablas y vistas que este usuario puede leer.
async function tablasPermitidas(cliente) {
  const r = await cliente.query(`
    SELECT table_schema AS esquema, table_name AS nombre, table_type AS tipo
    FROM information_schema.tables
    WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
      AND has_table_privilege(quote_ident(table_schema) || '.' || quote_ident(table_name), 'SELECT')
    ORDER BY 1, 2`);
  return r.rows.map(t => ({ id: `${t.esquema}.${t.nombre}`, esquema: t.esquema, nombre: t.nombre, vista: t.tipo === 'VIEW' }));
}

async function enSoloLectura(fn) {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN TRANSACTION READ ONLY');
    const resultado = await fn(cliente);
    await cliente.query('COMMIT');
    return resultado;
  } catch (e) {
    await cliente.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    cliente.release();
  }
}

const celda = v => {
  if (v === null || v === undefined) return '';
  const s = v instanceof Date ? v.toISOString() : typeof v === 'object' ? JSON.stringify(v) : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const aCSV = (campos, filas) => [campos.map(celda).join(','), ...filas.map(f => campos.map(c => celda(f[c])).join(','))].join('\r\n') + '\r\n';

// Errores para la app: nunca incluyen valores de las filas ni la contraseña.
function mensajeDeError(e) {
  if (e.code === '28P01' || e.code === '28000') return 'La base rechazó el usuario o la contraseña del conector.';
  if (e.code === '3D000') return 'La base de datos configurada en el conector no existe.';
  if (e.code === 'ECONNREFUSED' || e.code === 'ENOTFOUND' || e.code === 'ETIMEDOUT') return 'El conector no pudo llegar al servidor de la base de datos.';
  if (e.code === '57014') return 'La consulta tardó demasiado y se canceló.';
  if (e.code === '42501') return 'El usuario del conector no tiene permiso de lectura sobre esa tabla.';
  return 'No se pudo leer la base de datos.';
}

function responder(res, codigo, cuerpo, cabeceras = {}) {
  const texto = typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo);
  res.writeHead(codigo, { 'Content-Type': typeof cuerpo === 'string' ? 'text/csv; charset=utf-8' : 'application/json; charset=utf-8',
    'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...cabeceras });
  res.end(texto);
}

const leerCuerpo = req => new Promise((resolver, rechazar) => {
  let datos = '';
  req.on('data', c => { datos += c; if (datos.length > 10000) { rechazar(new Error('cuerpo')); req.destroy(); } });
  req.on('end', () => resolver(datos));
  req.on('error', rechazar);
});

const iguales = (a, b) => {
  const x = Buffer.from(String(a ?? '')), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

const servidor = http.createServer(async (req, res) => {
  const origen = req.headers.origin;
  const cors = ORIGENES.includes(origen)
    ? { 'Access-Control-Allow-Origin': origen, Vary: 'Origin', 'Access-Control-Expose-Headers': 'X-Filas, X-Tabla' } : {};
  if (!HOSTS.has(req.headers.host)) return responder(res, 421, { error: 'Host no permitido.' });
  if (origen && !ORIGENES.includes(origen)) return responder(res, 403, { error: 'Origen no permitido.' });
  if (req.method === 'OPTIONS') {
    return responder(res, 204, '', { ...cors, 'Access-Control-Allow-Methods': 'GET, POST',
      'Access-Control-Allow-Headers': 'Content-Type, X-Conector-Codigo', 'Access-Control-Max-Age': '600' });
  }
  if (!iguales(req.headers['x-conector-codigo'], CODIGO)) {
    registrar('rechazado: código de acceso incorrecto', req.method, req.url);
    return responder(res, 401, { error: 'Código de acceso del conector incorrecto.' }, cors);
  }
  try {
    if (req.method === 'GET' && req.url === '/estado') {
      const datos = await enSoloLectura(async c => {
        const info = (await c.query('SELECT current_database() AS base, current_user AS usuario, version() AS version')).rows[0];
        return { ...info, version: info.version.split(',')[0], soloLectura: true, maxFilas: MAX_FILAS, tablas: await tablasPermitidas(c) };
      });
      registrar('estado consultado:', datos.tablas.length, 'tabla(s) visibles');
      return responder(res, 200, datos, cors);
    }
    if (req.method === 'POST' && req.url === '/extraer') {
      let pedido;
      try { pedido = JSON.parse(await leerCuerpo(req)); } catch { return responder(res, 400, { error: 'Petición no válida.' }, cors); }
      const resultado = await enSoloLectura(async c => {
        const tabla = (await tablasPermitidas(c)).find(t => t.id === pedido?.tabla);
        if (!tabla) return { error: 'Esa tabla no existe o el usuario del conector no puede leerla.' };
        const nombre = `${c.escapeIdentifier(tabla.esquema)}.${c.escapeIdentifier(tabla.nombre)}`;
        const r = await c.query(`SELECT * FROM ${nombre} LIMIT ${MAX_FILAS + 1}`);
        if (r.rows.length > MAX_FILAS) return { error: `La tabla tiene más de ${MAX_FILAS} filas. Pida al administrador de la base una vista filtrada por periodo y diagnóstico.` };
        return { tabla: tabla.id, filas: r.rows.length, csv: aCSV(r.fields.map(f => f.name), r.rows) };
      });
      if (resultado.error) return responder(res, 400, { error: resultado.error }, cors);
      registrar('extracción:', resultado.tabla, resultado.filas, 'fila(s)');
      return responder(res, 200, resultado.csv, { ...cors, 'X-Filas': String(resultado.filas), 'X-Tabla': resultado.tabla });
    }
    return responder(res, 404, { error: 'Ruta no encontrada.' }, cors);
  } catch (e) {
    registrar('error:', e.code ?? e.name);
    return responder(res, 502, { error: mensajeDeError(e) }, cors);
  }
});

servidor.listen(PUERTO, '127.0.0.1', () => {
  console.log(`Conector SEAD-IESS escuchando en http://127.0.0.1:${PUERTO}`);
  console.log(`Base: ${env.SEAD_PGDATABASE ?? '(sin definir)'} en ${env.SEAD_PGHOST ?? '127.0.0.1'}:${env.SEAD_PGPORT ?? 5432} · usuario ${env.SEAD_PGUSER ?? '(sin definir)'}`);
  console.log(`Orígenes permitidos: ${ORIGENES.join(', ')}`);
  console.log(`Código de acceso para la app: ${CODIGO}`);
});
