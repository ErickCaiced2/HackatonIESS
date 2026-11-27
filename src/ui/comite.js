// Comité de ética: crea la petición (PDF aprobado, persona autorizada, periodo y diagnóstico),
// la envía a TI y sigue su estado. Si TI la devuelve, la corrige y la reenvía.
import { h, boton, aviso, etiqueta, tablaAdaptable, notificar } from './dom.js';
import { ESTADOS, validarPeticion } from '../motor/peticiones.js';
import { etiquetaDestinatario } from '../motor/destinatario.js';
import { paginar, TAMANOS_PAGINA } from '../motor/registro.js';
import { FILTRO_ESTUDIO } from '../motor/cie10.js';
import { campoPersona, campoFiltro, describirFiltro } from './campos.js';
import { peticiones, sesion, log, mostrarError, fechaCorta, fechaHora, sha256Bytes } from './servicios.js';
import { guardarArchivo, leerArchivo } from './archivos.js';

export const TONO_ESTADO = { enviada: 'aviso', devuelta: 'mal', en_proceso: 'aviso', publicada: 'neutro', firmada: 'ok', descargada: 'ok' };
export const etiquetaEstado = e => etiqueta(TONO_ESTADO[e] ?? 'neutro', ESTADOS[e] ?? e);

let borrador = null; // { id?, destinatario, filtro, pdf: File|null, aprobacion? }
let pagina = 1, porPagina = TAMANOS_PAGINA[0]; // se conservan al volver a la lista

const nuevoBorrador = () => ({ destinatario: { tipo: 'msp', id: '' }, filtro: { ...FILTRO_ESTUDIO }, pdf: null, aprobacion: null });

export async function abrirPdf(id) {
  try {
    const blob = await leerArchivo('aprobacion:' + id);
    if (!blob) throw new Error('No se encontró el PDF de la solicitud aprobada en este navegador.');
    const url = URL.createObjectURL(blob);
    globalThis.open(url, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (e) { mostrarError(e.message, 'Abrir solicitud aprobada'); }
}

export function historialPeticion(p, { conMotivo = true } = {}) {
  const cabecera = ['Fecha', 'Estado', 'Por', ...(conMotivo ? ['Motivo'] : [])];
  return tablaAdaptable(cabecera, p.historial.map(x =>
    [fechaHora(x.fecha), etiquetaEstado(x.estado), x.por, ...(conMotivo ? [x.motivo ?? '—'] : [])]));
}

function formulario(contenedor) {
  const b = borrador;
  const errores = h('div', { role: 'alert' });
  const nombrePdf = h('p', { className: 'nota' }, b.pdf ? `Seleccionado: ${b.pdf.name} (${Math.ceil(b.pdf.size / 1024)} KB)`
    : b.aprobacion ? `Actual: ${b.aprobacion.nombre}. Elija otro solo si quiere reemplazarlo.` : 'Ningún archivo elegido.');
  const enviar = async () => {
    const aprobacion = b.pdf ? { nombre: b.pdf.name, tamano: b.pdf.size, tipo: b.pdf.type } : b.aprobacion;
    const lista = validarPeticion({ destinatario: b.destinatario, filtro: b.filtro, aprobacion });
    if (lista.length) { errores.replaceChildren(aviso('mal', h('ul', {}, lista.map(e => h('li', {}, e))))); return; }
    try {
      if (b.pdf) aprobacion.sha256 = await sha256Bytes(await b.pdf.arrayBuffer());
      const u = sesion.actual().usuario;
      const p = b.id ? peticiones.reenviar(b.id, { destinatario: b.destinatario, filtro: b.filtro, aprobacion }, u)
        : peticiones.crear({ destinatario: b.destinatario, filtro: b.filtro, aprobacion }, u);
      if (b.pdf) await guardarArchivo('aprobacion:' + p.id, b.pdf);
      log('peticion', b.id ? 'Corregida y reenviada a TI' : 'Creada y enviada a TI',
        `Para ${etiquetaDestinatario(p.destinatario)} · ${describirFiltro(p.filtro)}`, { referencia: p.id });
      notificar('ok', `Petición ${p.id} enviada a TI.`);
      if (!b.id) pagina = 1; // la petición nueva aparece al inicio de la lista
      borrador = null;
      pintarComite(contenedor);
    } catch (e) { mostrarError(e.message, 'Enviar petición'); }
  };
  return h('section', { className: 'panel', 'aria-labelledby': 'form-peticion-h' },
    h('h2', { id: 'form-peticion-h', tabIndex: -1 }, b.id ? `Corregir la petición ${b.id}` : 'Nueva petición'),
    h('p', { className: 'descripcion' }, 'Adjunte la solicitud aprobada, indique a quién va dirigido el entregable y qué datos necesita. TI la revisará y preparará el dataset.'),
    b.motivo && aviso('mal', `TI la devolvió: ${b.motivo}`),
    h('fieldset', {}, h('legend', {}, '1. Solicitud aprobada (PDF)'),
      h('label', { className: 'archivo' }, 'Elija el PDF de la aprobación del comité',
        h('input', { type: 'file', id: 'pet-pdf', accept: '.pdf,application/pdf',
          onchange: e => { b.pdf = e.target.files[0] ?? null; pintarComite(contenedor); } })),
      nombrePdf),
    h('fieldset', {}, h('legend', {}, '2. Persona autorizada a recibir el entregable'),
      h('p', { className: 'nota' }, 'Doctor (número de licencia del MSP) o personal del IESS (identificador institucional).'),
      campoPersona('pet', b.destinatario)),
    h('fieldset', {}, h('legend', {}, '3. Parámetros mínimos del dataset'),
      campoFiltro(b.filtro, () => pintarComite(contenedor))),
    errores,
    h('div', { className: 'acciones' },
      boton(b.id ? 'Reenviar a TI' : 'Enviar a TI', enviar, { className: 'principal', id: 'pet-enviar' }),
      boton('Cancelar', () => { borrador = null; pintarComite(contenedor); })));
}

// El detalle se abre desde la fila de la petición, en una ventana sobre la lista.
function abrirDetalle(p, contenedor) {
  const d = document.getElementById('detalle-ejecucion');
  const corregir = () => {
    d.close();
    borrador = { id: p.id, destinatario: { ...p.destinatario }, filtro: { ...p.filtro }, pdf: null, aprobacion: p.aprobacion, motivo: p.historial.at(-1).motivo };
    pintarComite(contenedor);
  };
  d.replaceChildren(h('div', { className: 'contenido-dialogo' },
    h('div', { className: 'cabeza-dialogo' },
      h('h2', { id: 'detalle-titulo' }, `Detalle de ${p.id}`),
      boton('Cerrar ×', () => d.close(), { className: 'cerrar-dialogo' })),
    tablaAdaptable(['Dato', 'Valor'], [
      ['Estado', etiquetaEstado(p.estado)],
      ['Creada', fechaHora(p.creadaEn)],
      ['Para', etiquetaDestinatario(p.destinatario)],
      ['Datos pedidos', describirFiltro(p.filtro)],
    ]),
    h('h3', {}, 'Historial'),
    historialPeticion(p, { conMotivo: false }),
    h('div', { className: 'acciones' },
      p.estado === 'devuelta' && boton('Corregir y reenviar', corregir, { className: 'principal', id: 'corregir-' + p.id }),
      boton('Ver PDF aprobado', () => abrirPdf(p.id), { id: 'pdf-' + p.id }))));
  d.showModal();
  d.scrollTop = 0;
}

// Lista de peticiones con paginación; solo se repinta esta caja al cambiar de página.
function pintarLista(caja, lista, contenedor) {
  const p = paginar(lista, pagina, porPagina);
  pagina = p.pagina;
  // Tras repintar, el foco vuelve al control usado (o a la tabla si quedó deshabilitado).
  const repintar = idFoco => {
    pintarLista(caja, lista, contenedor);
    const control = document.getElementById(idFoco);
    (control && !control.disabled ? control : document.getElementById('ce-tabla'))?.focus();
  };
  const ir = (n, idFoco) => { pagina = n; repintar(idFoco); };
  const tabla = tablaAdaptable(['Petición', 'Creada', 'Para', 'Datos pedidos', 'Estado', 'Novedad', 'Detalle'],
    p.filas.map(x => [x.id, fechaCorta(x.creadaEn), etiquetaDestinatario(x.destinatario), describirFiltro(x.filtro), etiquetaEstado(x.estado),
      x.estado === 'devuelta' ? `Motivo: ${x.historial.at(-1).motivo}` : fechaCorta(x.historial.at(-1).fecha),
      boton('Ver detalle', () => abrirDetalle(x, contenedor), { id: 'detalle-pet-' + x.id, 'aria-haspopup': 'dialog', 'aria-label': `Ver detalle de ${x.id}` })]));
  tabla.id = 'ce-tabla';
  tabla.setAttribute('aria-label', `Peticiones, página ${p.pagina} de ${p.paginas}`);
  caja.replaceChildren(
    h('p', { className: 'nota', role: 'status' }, `Mostrando ${p.desde}–${p.hasta} de ${p.total} peticiones.`),
    tabla,
    h('div', { className: 'paginacion' },
      h('label', { className: 'por-pagina' }, 'Filas por página',
        h('select', { id: 'ce-por-pagina', onchange: e => { porPagina = Number(e.target.value); pagina = 1; repintar('ce-por-pagina'); } },
          TAMANOS_PAGINA.map(n => h('option', { value: n, selected: n === porPagina }, String(n))))),
      h('div', { className: 'paginas' },
        boton('Anterior', () => ir(p.pagina - 1, 'ce-anterior'), { id: 'ce-anterior', disabled: p.pagina <= 1 }),
        h('span', {}, `Página ${p.pagina} de ${p.paginas}`),
        boton('Siguiente', () => ir(p.pagina + 1, 'ce-siguiente'), { id: 'ce-siguiente', disabled: p.pagina >= p.paginas }))));
}

export function pintarComite(contenedor) {
  if (borrador) { contenedor.replaceChildren(formulario(contenedor)); contenedor.querySelector('h2')?.focus(); return; }
  const lista = peticiones.lista();
  const devueltas = lista.filter(p => p.estado === 'devuelta').length;
  const caja = h('div', {});
  contenedor.replaceChildren(h('section', { className: 'panel', 'aria-labelledby': 'ce-h' },
    h('div', { className: 'cabeza-tablero' },
      h('div', {}, h('h2', { id: 'ce-h', tabIndex: -1 }, 'Peticiones del comité de ética'),
        h('p', { className: 'descripcion' }, 'Cree peticiones con la solicitud aprobada y siga su estado hasta que el destinatario descarga el entregable.')),
      boton('Nueva petición +', () => { borrador = nuevoBorrador(); pintarComite(contenedor); }, { className: 'principal', id: 'nueva-peticion' })),
    devueltas > 0 && aviso('aviso', `${devueltas} petición(es) devuelta(s) por TI: revise el motivo y corríjala(s).`),
    lista.length === 0
      ? h('div', { className: 'vacio' }, h('p', {}, 'Todavía no hay peticiones. Pulse «Nueva petición» para crear la primera.'))
      : caja));
  if (lista.length) pintarLista(caja, lista, contenedor);
}
