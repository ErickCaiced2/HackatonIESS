// TI: bandeja de peticiones (revisar, devolver, procesar), logs por sección y tablero con gráficos.
import { h, boton, aviso, etiqueta, tablaAdaptable, notificar, confirmar } from './dom.js';
import { ESTADOS } from '../motor/peticiones.js';
import { TIPOS_LOG, actividadPorDia, incidencias } from '../motor/logs.js';
import { etiquetaDestinatario } from '../motor/destinatario.js';
import { paginar, TAMANOS_PAGINA, ejecucionCompleta } from '../motor/registro.js';
import { describirFiltro } from './campos.js';
import { etiquetaEstado, abrirPdf, historialPeticion } from './comite.js';
import { peticiones, logs, registro, sesion, log, mostrarError, fechaCorta, fechaHora } from './servicios.js';
import { graficoLineas, graficoBarras } from './graficos.js';

// ---------- Bandeja de peticiones ----------
let filtroEstado = 'pendientes';

function revisar(p, { procesar, repintar }) {
  const d = document.getElementById('dialogo');
  const motivo = h('textarea', { id: 'motivo-devolucion', placeholder: 'Explique al comité qué debe corregir' });
  const error = h('p', { className: 'error-campo mal', role: 'status' });
  const devolver = () => {
    if (!motivo.value.trim()) { error.textContent = 'Escriba el motivo de la devolución. ✗'; motivo.focus(); return; }
    try {
      peticiones.devolver(p.id, motivo.value, sesion.actual().usuario);
      log('peticion', 'Devuelta al comité', motivo.value.trim(), { referencia: p.id });
      notificar('aviso', `Petición ${p.id} devuelta al comité.`);
      d.close(); repintar();
    } catch (e) { mostrarError(e.message, 'Devolver petición'); }
  };
  d.replaceChildren(h('div', {},
    h('h2', {}, `Revisar ${p.id}`),
    tablaAdaptable(['Dato', 'Valor'], [
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
    return boton('Ver', () => verDetalle(p), { id: 'ver-pet-' + p.id });
  };
  contenedor.replaceChildren(h('section', { className: 'panel', 'aria-labelledby': 'tip-h' },
    h('h2', { id: 'tip-h', tabIndex: -1 }, 'Peticiones'),
    h('p', { className: 'descripcion' }, 'Revise cada petición del comité con su solicitud aprobada. Puede devolverla con un motivo o procesarla: cargar la base, configurar la protección, revisar resultados y trazabilidad, y publicarla al destinatario.'),
    h('label', { className: 'por-pagina' }, 'Mostrar',
      h('select', { id: 'ti-estado', onchange: e => { filtroEstado = e.target.value; pintarTiPeticiones(contenedor, ctx); } },
        Object.entries(filtros).map(([k, [t, f]]) => h('option', { value: k, selected: k === filtroEstado }, `${t} (${todas.filter(f).length})`)))),
    lista.length === 0
      ? h('div', { className: 'vacio' }, h('p', {}, 'No hay peticiones en este estado.'))
      : tablaAdaptable(['Petición', 'Recibida', 'Para', 'Datos pedidos', 'Estado', 'Acción'],
        lista.map(p => [p.id, fechaCorta(p.creadaEn), etiquetaDestinatario(p.destinatario), describirFiltro(p.filtro), etiquetaEstado(p.estado), accion(p)]))));
}

function verDetalle(p) {
  const d = document.getElementById('dialogo');
  d.replaceChildren(h('div', {}, h('h2', {}, `Petición ${p.id}`),
    h('p', {}, `Para ${etiquetaDestinatario(p.destinatario)} · ${describirFiltro(p.filtro)}`),
    p.ejecucion && h('p', { className: 'nota' }, `Ejecución publicada: ${p.ejecucion.id}`),
    p.firmadoEn && h('p', {}, `Acuerdo firmado: ${fechaHora(p.firmadoEn)}`),
    p.descargas.length > 0 && tablaAdaptable(['Archivo', 'Tipo', 'Fecha', 'Por'], p.descargas.map(x => [x.archivo, x.tipo, fechaHora(x.fecha), x.por])),
    h('h3', {}, 'Historial'), historialPeticion(p),
    h('div', { className: 'acciones' }, boton('Abrir PDF aprobado', () => abrirPdf(p.id)), boton('Cerrar', () => d.close()))));
  d.showModal();
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
    h('div', { className: 'graficos' },
      graficoLineas({ id: 'g-actividad', titulo: 'Actividad de los últimos 14 días', descripcion: 'Eventos por día y tipo',
        ancho: (contenedor.clientWidth || 1200) - 120,
        series: [{ clave: 'sesion', nombre: 'Inicios de sesión' }, { clave: 'peticion', nombre: 'Peticiones' },
          { clave: 'descarga', nombre: 'Descargas' }, { clave: 'error', nombre: 'Errores' }],
        datos: actividad, etiquetaX: d => d.dia.slice(8, 10) + '/' + d.dia.slice(5, 7) }),
      graficoBarras({ id: 'g-estados', titulo: 'Peticiones por estado', descripcion: `${pets.length} en total`,
        items: Object.entries(ESTADOS).map(([k, t]) => ({ nombre: t, valor: pets.filter(p => p.estado === k).length })) }),
      graficoBarras({ id: 'g-incidencias', titulo: 'Incidencias por tipo', descripcion: 'Desde el inicio del registro',
        items: [{ nombre: 'Errores', valor: inc.errores }, { nombre: 'Inicios de sesión fallidos', valor: inc.sesionesFallidas },
          { nombre: 'Peticiones devueltas', valor: inc.devoluciones }] })),
    h('h3', {}, 'Entregas completadas'), caja));
  pintarRegistro(caja, registro.lista().filter(ejecucionCompleta));
}
