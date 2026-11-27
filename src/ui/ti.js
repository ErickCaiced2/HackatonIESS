// TI: bandeja de peticiones (revisar, devolver, procesar), logs por sección y tablero con gráficos.
import { h, boton, aviso, etiqueta, tablaAdaptable, notificar, confirmar, datosClave, pestanas } from './dom.js';
import { ESTADOS } from '../motor/peticiones.js';
import { TIPOS_LOG, actividadPorDia, incidencias } from '../motor/logs.js';
import { etiquetaDestinatario } from '../motor/destinatario.js';
import { paginar, TAMANOS_PAGINA, ejecucionCompleta } from '../motor/registro.js';
import { describirFiltro } from './campos.js';
import { etiquetaEstado, abrirPdf, historialPeticion } from './comite.js';
import { peticiones, logs, registro, sesion, log, mostrarError, fechaCorta, fechaHora } from './servicios.js';
import { graficoLineas, graficoBarras } from './graficos.js';
import { ACUERDO, acuerdoTexto, sha256 } from '../motor/entregables.js';
import { zip } from '../motor/zip.js';
import { leerArchivo } from './archivos.js';
import { sha256Bytes, descargar } from './servicios.js';

// ---------- Bandeja de peticiones ----------
let filtroEstado = 'pendientes';
let paginaTi = 1, porPaginaTi = TAMANOS_PAGINA[0];

function revisar(p, { procesar, repintar }) {
  const d = document.getElementById('dialogo');
  const motivo = h('textarea', { id: 'motivo-devolucion', placeholder: 'Explique al comité qué debe corregir' });
  const error = h('p', { className: 'error-campo mal', role: 'status' });
  const devolver = () => {
    if (!motivo.value.trim()) { error.textContent = 'Escriba el motivo de la devolución.'; motivo.focus(); return; }
    try {
      peticiones.devolver(p.id, motivo.value, sesion.actual().usuario);
      log('peticion', 'Devuelta al comité', motivo.value.trim(), { referencia: p.id });
      notificar('aviso', `Petición ${p.id} devuelta al comité.`);
      d.close(); repintar();
    } catch (e) { mostrarError(e.message, 'Devolver petición'); }
  };
  d.replaceChildren(h('div', {},
    h('h2', {}, `Revisar ${p.id}`),
    datosClave([
      ['Estado', etiquetaEstado(p.estado)],
      ['Creada', `${fechaHora(p.creadaEn)} por ${p.creadaPor}`],
      ['Para', etiquetaDestinatario(p.destinatario)],
      ['Datos pedidos', describirFiltro(p.filtro)],
      ['Solicitud aprobada', h('span', {}, `${p.aprobacion.nombre} · `, boton('Abrir PDF', () => abrirPdf(p.id), { id: 'abrir-pdf' }))],
    ]),
    h('h3', {}, 'Devolver al comité'),
    h('label', {}, 'Motivo de la devolución', motivo), error,
    h('div', { className: 'acciones' },
      boton('Procesar petición', () => { d.close(); procesar(p.id); }, { className: 'principal', id: 'procesar' }),
      boton('Devolver con motivo', devolver, { className: 'peligro', id: 'devolver' }),
      boton('Cerrar', () => d.close()))));
  d.showModal();
}

export function pintarTiPeticiones(contenedor, ctx) {
  const todas = peticiones.lista();
  const filtros = {
    pendientes: ['Pendientes', p => p.estado === 'enviada' || p.estado === 'en_proceso'],
    todas: ['Todas', () => true],
    ...Object.fromEntries(Object.entries(ESTADOS).map(([k, v]) => [k, [v, p => p.estado === k]])),
  };
  const lista = todas.filter(filtros[filtroEstado][1]);
  const accion = p => {
    if (p.estado === 'enviada') return boton('Revisar', () => revisar(p, ctx), { id: 'revisar-' + p.id, className: 'principal' });
    if (p.estado === 'en_proceso') return boton('Continuar', () => ctx.procesar(p.id, true), { id: 'continuar-' + p.id });
    if (p.ejecucion) return boton('Archivos de TI', () => verDetalle(p, true), { id: 'archivos-' + p.id });
    return h('span', { className: 'nota' }, 'Sin acción pendiente');
  };
  const pag = paginar(lista, paginaTi, porPaginaTi);
  paginaTi = pag.pagina;
  const repintar = foco => { pintarTiPeticiones(contenedor, ctx); document.getElementById(foco)?.focus(); };
  contenedor.replaceChildren(h('section', { className: 'panel', 'aria-labelledby': 'tip-h' },
    h('h2', { id: 'tip-h', tabIndex: -1 }, 'Peticiones'),
    h('p', { className: 'descripcion' }, 'Revise cada petición del comité con su solicitud aprobada. Puede devolverla con un motivo o procesarla: cargar la base, configurar la protección, revisar resultados y trazabilidad, y publicarla al destinatario.'),
    h('div', { className: 'verificar-csv' },
      h('div', {}, h('strong', {}, '¿Le llegó un CSV y quiere saber de dónde salió?'),
        h('p', { className: 'nota' }, 'Se compara su huella SHA-256 con la de cada CSV entregado. El archivo no sale de este equipo.')),
      h('label', { className: 'boton-archivo' }, 'Verificar un CSV',
        h('input', { type: 'file', id: 'verificar-csv', accept: '.csv,text/csv', className: 'solo-lector',
          onchange: e => { const f = e.target.files[0]; if (f) verificarCSV(f, () => pintarTiPeticiones(contenedor, ctx)); } }))),
    resultadoVerificacion(),
    h('label', { className: 'por-pagina' }, 'Mostrar',
      h('select', { id: 'ti-estado', onchange: e => { filtroEstado = e.target.value; paginaTi = 1; repintar('ti-estado'); } },
        Object.entries(filtros).map(([k, [t, f]]) => h('option', { value: k, selected: k === filtroEstado }, `${t} (${todas.filter(f).length})`)))),
    lista.length === 0
      ? h('div', { className: 'vacio' }, h('p', {}, 'No hay peticiones en este estado.'))
      : [h('p', { className: 'nota', role: 'status' }, `Mostrando ${pag.desde}–${pag.hasta} de ${pag.total} peticiones.`),
        tablaAdaptable(['Petición', 'Recibida', 'Para', 'Datos pedidos', 'Estado', 'Acción', 'Detalle'],
          pag.filas.map(p => [p.id, fechaCorta(p.creadaEn), etiquetaDestinatario(p.destinatario), describirFiltro(p.filtro), etiquetaEstado(p.estado), accion(p),
            boton('Ver detalle', () => verDetalle(p), { id: 'ver-pet-' + p.id, 'aria-haspopup': 'dialog', 'aria-label': `Ver detalle de ${p.id}` })])),
        h('div', { className: 'paginacion' },
          h('label', { className: 'por-pagina' }, 'Filas por página',
            h('select', { id: 'ti-por-pagina', onchange: e => { porPaginaTi = Number(e.target.value); paginaTi = 1; repintar('ti-por-pagina'); } },
              TAMANOS_PAGINA.map(n => h('option', { value: n, selected: n === porPaginaTi }, String(n))))),
          h('div', { className: 'paginas' },
            boton('Anterior', () => { paginaTi--; repintar('ti-anterior'); }, { id: 'ti-anterior', disabled: pag.pagina <= 1 }),
            h('span', {}, `Página ${pag.pagina} de ${pag.paginas}`),
            boton('Siguiente', () => { paginaTi++; repintar('ti-siguiente'); }, { id: 'ti-siguiente', disabled: pag.pagina >= pag.paginas })))]));
}

// Archivos de uso interno de TI: configuración, trazabilidad y PTA (y el paquete completo). El destinatario no los recibe.
async function descargarInterno(p, tipo) {
  try {
    const e = await leerArchivo('entrega:' + p.id);
    if (!e) throw new Error('No se encontraron los archivos publicados de esta petición en este navegador.');
    const traza = JSON.stringify({ ...JSON.parse(e.traza),
      entregado_a: p.descargas.length ? { ...p.destinatario } : null,
      acuerdo_confidencialidad: p.firmadoEn ? { version: ACUERDO.version, firmado_en: p.firmadoEn } : null,
      sha256_csv_publicado: p.ejecucion?.sha256CSV ?? e.sha256CSV ?? null,
      descargas_del_destinatario: p.descargas.map(({ archivo, fecha, sha256: huella }) => ({ archivo, fecha, sha256: huella ?? null })) }, null, 2);
    const archivos = {
      config: [e.base + '_configuracion.json', e.config, 'application/json'],
      traza: [e.base + '_trazabilidad.json', traza, 'application/json'],
      pta: [e.base + '_PTA.html', e.pta, 'text/html;charset=utf-8'],
    };
    const elegido = tipo === 'zip'
      ? [e.base + '_paquete_TI.zip', zip([...Object.values(archivos).map(([n, c]) => [n, c]), [e.base + '_salida.csv', e.csv],
        ...(p.firmadoEn ? [[e.base + '_acuerdo.txt', acuerdoTexto(e.ejecucionId, p.firmadoEn, p.destinatario)]] : [])]), 'application/zip']
      : archivos[tipo];
    log('descarga', `Descarga interna de TI: ${tipo.toUpperCase()}`, elegido[0], { referencia: p.id });
    descargar(...elegido);
    notificar('ok', `Se envió a descargas: ${elegido[0]}.`);
  } catch (err) { mostrarError(err.message, 'Descarga interna de TI'); }
}

// Huella SHA-256 de cada CSV publicado (las peticiones antiguas sin huella se calculan desde el archivo guardado).
async function huellasPublicadas() {
  const lista = [];
  for (const p of peticiones.lista().filter(x => x.ejecucion)) {
    let huella = p.ejecucion.sha256CSV;
    if (!huella) { const e = await leerArchivo('entrega:' + p.id); if (e) huella = await sha256(e.csv); }
    if (huella) lista.push([huella, p]);
  }
  return lista;
}

// Compara un CSV recibido con todas las entregas: dice si está intacto y de qué petición salió.
let verificacion = null;
async function verificarCSV(archivo, repintar) {
  try {
    const huella = await sha256Bytes(await archivo.arrayBuffer());
    const p = (await huellasPublicadas()).find(([x]) => x === huella)?.[1] ?? null;
    verificacion = { nombre: archivo.name, huella, peticion: p };
    log('peticion', 'Verificación de un CSV', `${p ? 'Coincide con ' + p.id : 'Sin coincidencia'} · SHA-256 ${huella}`, { referencia: p?.id ?? '', resultado: p ? 'ok' : 'fallo' });
  } catch (err) { mostrarError(err.message, 'Verificar CSV'); }
  repintar();
}

function resultadoVerificacion() {
  if (!verificacion) return null;
  const { nombre, huella, peticion: p } = verificacion;
  const ultima = p?.descargas.at(-1);
  return h('div', { role: 'status' },
    p ? aviso('ok', h('strong', {}, `«${nombre}» coincide con el CSV de ${p.id}. `),
      `Se entregó a ${etiquetaDestinatario(p.destinatario)}${ultima ? `, descargado el ${fechaHora(ultima.fecha)}` : ' (todavía no lo descarga)'}. El archivo no fue modificado.`)
      : aviso('mal', h('strong', {}, `«${nombre}» no coincide con ningún CSV entregado. `),
        'Fue modificado, está incompleto o no salió de este sistema.'),
    datosClave([['Huella SHA-256 calculada', h('code', { className: 'huella' }, huella)]]));
}

function verDetalle(p, irAArchivos = false) {
  const d = document.getElementById('detalle-ejecucion');
  const huella = p.ejecucion?.sha256CSV;
  d.replaceChildren(h('div', { className: 'contenido-dialogo' },
    h('div', { className: 'cabeza-dialogo' }, h('h2', { id: 'detalle-titulo' }, `Petición ${p.id}`), boton('Cerrar ×', () => d.close())),
    datosClave([
      ['Para', etiquetaDestinatario(p.destinatario)],
      ['Datos pedidos', describirFiltro(p.filtro)],
      ['Ejecución publicada', p.ejecucion?.id ?? '—'],
      ['Huella SHA-256 del CSV', huella ? h('code', { className: 'huella' }, huella) : '—'],
      ['Acuerdo firmado', p.firmadoEn ? fechaHora(p.firmadoEn) : '—'],
    ]),
    p.ejecucion && [h('h3', { id: 'archivos-ti' }, 'Archivos internos de TI'),
      h('p', { className: 'nota' }, 'El destinatario solo descarga el CSV. Estos archivos son para TI y la auditoría.'),
      h('div', { className: 'acciones' },
        boton('Configuración (JSON)', () => descargarInterno(p, 'config'), { id: 'ti-bajar-config' }),
        boton('Trazabilidad (JSON)', () => descargarInterno(p, 'traza'), { id: 'ti-bajar-traza' }),
        boton('PTA (HTML)', () => descargarInterno(p, 'pta'), { id: 'ti-bajar-pta' }),
        boton('Paquete completo (ZIP)', () => descargarInterno(p, 'zip'), { id: 'ti-bajar-zip' }))],
    h('h3', {}, 'Descargas del destinatario'),
    p.descargas.length > 0
      ? tablaAdaptable(['Archivo', 'Fecha', 'Por', 'Huella SHA-256'], p.descargas.map(x => [x.archivo, fechaHora(x.fecha), x.por,
        x.sha256 ? h('code', { className: 'huella', title: x.sha256 }, x.sha256.slice(0, 16) + '…') : '—']))
      : h('p', { className: 'nota' }, 'Todavía no descarga el CSV.'),
    h('h3', {}, 'Historial'), historialPeticion(p),
    h('div', { className: 'acciones' }, boton('Abrir PDF aprobado', () => abrirPdf(p.id)))));
  d.showModal();
  d.scrollTop = 0;
  if (irAArchivos) document.getElementById('ti-bajar-config')?.focus();
}

// ---------- Logs ----------
const ROL_CORTO = { ti: 'TI', ce: 'Comité de ética', receptor: 'Destinatario' };
let tipoLog = 'sesion', textoLog = '', paginaLog = 1, porPaginaLog = TAMANOS_PAGINA[0];

export function pintarTiLogs(contenedor) {
  const todos = logs.lista();
  const q = textoLog.trim().toLowerCase();
  const lista = todos.filter(l => l.tipo === tipoLog && (!q || [l.usuario, l.accion, l.detalle, l.referencia].some(v => String(v).toLowerCase().includes(q))));
  const p = paginar(lista, paginaLog, porPaginaLog);
  paginaLog = p.pagina;
  const repintar = () => pintarTiLogs(contenedor);
  const cajaTabla = p.total
    ? tablaAdaptable(['Fecha', 'Usuario', 'Rol', 'Acción', 'Detalle', 'Referencia', 'Resultado'],
      p.filas.map(l => [fechaHora(l.fecha), l.usuario || '—', ROL_CORTO[l.rol] ?? '—', l.accion, l.detalle || '—', l.referencia || '—',
        etiqueta(l.resultado === 'fallo' ? 'mal' : 'ok', l.resultado === 'fallo' ? 'Fallo' : 'Correcto')]))
    : h('div', { className: 'vacio' }, h('p', {}, 'No hay registros en esta sección.'));
  contenedor.replaceChildren(h('section', { className: 'panel', 'aria-labelledby': 'logs-h' },
    h('h2', { id: 'logs-h', tabIndex: -1 }, 'Logs del sistema'),
    h('p', { className: 'descripcion' }, 'Todo lo que pasa en el sistema, por sección. Los logs solo se agregan: no se pueden borrar ni editar.'),
    h('div', { className: 'segmentos', role: 'group', 'aria-label': 'Sección de logs' },
      Object.entries(TIPOS_LOG).map(([k, t]) => boton(`${t} (${todos.filter(l => l.tipo === k).length})`,
        () => { tipoLog = k; paginaLog = 1; repintar(); document.getElementById('log-' + k)?.focus(); },
        { id: 'log-' + k, 'aria-pressed': String(k === tipoLog) }))),
    h('label', { className: 'busqueda' }, 'Buscar por usuario, acción, detalle o referencia',
      h('input', { type: 'search', id: 'log-buscar', value: textoLog, oninput: e => { textoLog = e.target.value; paginaLog = 1; repintar(); document.getElementById('log-buscar')?.focus(); } })),
    h('p', { className: 'nota', role: 'status' }, p.total ? `Mostrando ${p.desde}–${p.hasta} de ${p.total}.` : ''),
    cajaTabla,
    h('div', { className: 'paginacion' },
      h('label', { className: 'por-pagina' }, 'Filas por página',
        h('select', { id: 'log-por-pagina', onchange: e => { porPaginaLog = Number(e.target.value); paginaLog = 1; repintar(); } },
          TAMANOS_PAGINA.map(n => h('option', { value: n, selected: n === porPaginaLog }, String(n))))),
      h('div', { className: 'paginas' },
        boton('Anterior', () => { paginaLog--; repintar(); }, { disabled: p.pagina <= 1 }),
        h('span', {}, `Página ${p.pagina} de ${p.paginas}`),
        boton('Siguiente', () => { paginaLog++; repintar(); }, { disabled: p.pagina >= p.paginas })))));
}

// ---------- Tablero ----------
function tarjeta(nombre, valor, explicacion) {
  return h('div', { className: 'indicador' }, h('span', {}, nombre), h('b', {}, String(valor)), h('small', {}, explicacion));
}

export function pintarTiTablero(contenedor, { pintarRegistro, irAPeticiones }) {
  const todos = logs.lista(), pets = peticiones.lista();
  const inc = incidencias(todos);
  const completas = pets.filter(p => p.estado === 'descargada').length;
  const entregados = pets.reduce((a, p) => a + p.descargas.length, 0);
  const pendientes = pets.filter(p => p.estado === 'enviada' || p.estado === 'en_proceso').length;
  const actividad = actividadPorDia(todos, 14);
  const caja = h('div', {});
  contenedor.replaceChildren(h('section', { className: 'panel', 'aria-labelledby': 'tablero-h' },
    h('div', { className: 'cabeza-tablero' },
      h('div', {}, h('h2', { id: 'tablero-h', tabIndex: -1 }, 'Tablero de TI'),
        h('p', { className: 'descripcion' }, 'Incidencias, peticiones completadas, errores y datasets entregados.')),
      boton('Ir a peticiones →', irAPeticiones, { className: 'principal', id: 'ir-peticiones' })),
    pendientes > 0 && aviso('aviso', `${pendientes} petición(es) esperan a TI.`),
    h('div', { className: 'indicadores' },
      tarjeta('Peticiones completadas', completas, 'Llegaron a la descarga'),
      tarjeta('Datasets entregados', entregados, 'Archivos descargados por destinatarios'),
      tarjeta('Errores', inc.errores, 'Registrados en los logs'),
      tarjeta('Incidencias', inc.errores + inc.sesionesFallidas + inc.devoluciones, 'Errores, accesos fallidos y devoluciones')),
    pestanas('tablero', [
      ['actividad', 'Actividad', () => graficoLineas({ id: 'g-actividad', titulo: 'Actividad de los últimos 14 días', descripcion: 'Eventos por día y tipo',
        ancho: (contenedor.clientWidth || 1200) - 120,
        series: [{ clave: 'sesion', nombre: 'Inicios de sesión' }, { clave: 'peticion', nombre: 'Peticiones' },
          { clave: 'descarga', nombre: 'Descargas' }, { clave: 'error', nombre: 'Errores' }],
        datos: actividad, etiquetaX: d => d.dia.slice(8, 10) + '/' + d.dia.slice(5, 7) })],
      ['estados', 'Peticiones e incidencias', () => h('div', { className: 'graficos dos' },
        graficoBarras({ id: 'g-estados', titulo: 'Peticiones por estado', descripcion: `${pets.length} en total`,
          items: Object.entries(ESTADOS).map(([k, t]) => ({ nombre: t, valor: pets.filter(p => p.estado === k).length })) }),
        graficoBarras({ id: 'g-incidencias', titulo: 'Incidencias por tipo', descripcion: 'Desde el inicio del registro',
          items: [{ nombre: 'Errores', valor: inc.errores }, { nombre: 'Inicios de sesión fallidos', valor: inc.sesionesFallidas },
            { nombre: 'Peticiones devueltas', valor: inc.devoluciones }] }))],
      ['entregas', 'Entregas completadas', () => caja],
    ], 'Vistas del tablero')));
  pintarRegistro(caja, registro.lista().filter(ejecucionCompleta));
}
