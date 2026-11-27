// Doctor o personal autorizado: ve las peticiones dirigidas a su código, firma el acuerdo de
// confidencialidad y, solo entonces, se habilitan las descargas.
import { h, boton, aviso, tablaAdaptable, notificar, datosClave } from './dom.js';
import { icono } from './iconos.js';
import { ACUERDO, acuerdoTexto } from '../motor/entregables.js';
import { zip } from '../motor/zip.js';
import { etiquetaDestinatario } from '../motor/destinatario.js';
import { describirFiltro } from './campos.js';
import { etiquetaEstado } from './comite.js';
import { peticiones, registro, sesion, log, mostrarError, fechaCorta, fechaHora, descargar } from './servicios.js';
import { leerArchivo } from './archivos.js';

const DISPONIBLES = ['publicada', 'firmada', 'descargada'];
let abierta = null;

const ARCHIVOS = [['zip', 'Descargar todo (ZIP)'], ['csv', 'Solo CSV'], ['config', 'Solo configuración'], ['traza', 'Solo trazabilidad'], ['pta', 'Solo PTA']];

async function descargarArchivo(p, tipo, repintar) {
  const u = sesion.actual();
  try {
    const e = await leerArchivo('entrega:' + p.id);
    if (!e) throw new Error('No se encontraron los archivos publicados de esta petición en este navegador.');
    const entregadoA = { ...p.destinatario };
    const traza = JSON.stringify({ ...JSON.parse(e.traza), entregado_a: entregadoA,
      acuerdo_confidencialidad: { version: ACUERDO.version, firmado_en: p.firmadoEn, firmado_por: u.usuario } }, null, 2);
    const archivos = {
      csv: [e.base + '_salida.csv', e.csv, 'text/csv;charset=utf-8'],
      config: [e.base + '_configuracion.json', e.config, 'application/json'],
      traza: [e.base + '_trazabilidad.json', traza, 'application/json'],
      pta: [e.base + '_PTA.html', e.pta, 'text/html;charset=utf-8'],
    };
    const elegido = tipo === 'zip'
      ? [e.base + '_paquete.zip', zip([...Object.values(archivos).map(([n, c]) => [n, c]),
        [e.base + '_acuerdo.txt', acuerdoTexto(e.ejecucionId, p.firmadoEn, p.destinatario)]]), 'application/zip']
      : archivos[tipo];
    // Se registra antes de entregar el archivo.
    peticiones.registrarDescarga(p.id, { archivo: elegido[0], tipo }, u);
    registro.descarga(e.ejecucionId, elegido[0], new Date().toISOString(), entregadoA);
    log('descarga', `Descarga ${tipo.toUpperCase()}`, elegido[0], { referencia: p.id });
    descargar(...elegido);
    notificar('ok', `Se envió a descargas: ${elegido[0]}.`);
    repintar();
  } catch (err) { mostrarError(err.message, 'Descargar entregable'); }
}

function vistaPeticion(p, contenedor) {
  const repintar = () => pintarDoctor(contenedor);
  const firmada = !!p.firmadoEn;
  const casilla = h('input', { type: 'checkbox', id: 'acepto' });
  const firmar = () => {
    if (!casilla.checked) { notificar('aviso', 'Marque «He leído y acepto este acuerdo» para firmar.'); casilla.focus(); return; }
    try {
      peticiones.firmar(p.id, sesion.actual());
      log('peticion', 'Acuerdo firmado', `Versión ${ACUERDO.version}`, { referencia: p.id });
      notificar('ok', 'Acuerdo firmado. Las descargas están habilitadas.');
      repintar();
      document.getElementById('bajar-zip')?.focus();
    } catch (e) { mostrarError(e.message, 'Firmar acuerdo'); }
  };
  return h('section', { className: 'panel', 'aria-labelledby': 'doc-pet-h' },
    boton('← Mis peticiones', () => { abierta = null; repintar(); }, { id: 'volver-lista' }),
    h('h2', { id: 'doc-pet-h', tabIndex: -1 }, `Petición ${p.id}`),
    datosClave([
      ['Estado', etiquetaEstado(p.estado)],
      ['Datos', describirFiltro(p.filtro)],
      ['Dirigida a', etiquetaDestinatario(p.destinatario)],
      ['Publicada por TI', fechaHora(p.historial.find(x => x.estado === 'publicada')?.fecha)],
    ]),
    h('fieldset', { className: 'acuerdo' }, h('legend', {}, 'Acuerdo de confidencialidad y uso'),
      h('p', {}, 'Los archivos derivan de datos de salud. Para descargar cualquiera de ellos, me comprometo a:'),
      h('ol', {}, ACUERDO.condiciones.map(c => h('li', {}, c))),
      firmada
        ? aviso('ok', `Acuerdo firmado el ${fechaHora(p.firmadoEn)} por ${etiquetaDestinatario(p.destinatario)}.`)
        : [h('label', { className: 'casilla' }, casilla, h('strong', {}, 'He leído y acepto este acuerdo')),
          h('div', { className: 'acciones' }, boton('Firmar acuerdo', firmar, { className: 'principal', id: 'firmar' }))]),
    h('section', { className: 'descargas' + (firmada ? '' : ' congelado'), 'aria-labelledby': 'desc-h' },
      h('h3', { id: 'desc-h', className: 'con-icono' }, !firmada && icono('candado'), firmada ? 'Descargas' : 'Descargas (bloqueadas)'),
      !firmada && h('p', { className: 'nota' }, 'Se habilitan al firmar el acuerdo de confidencialidad.'),
      h('div', { className: 'acciones' }, ARCHIVOS.map(([tipo, texto]) => boton(texto, () => descargarArchivo(p, tipo, repintar),
        { id: 'bajar-' + tipo, className: tipo === 'zip' ? 'principal' : '', disabled: !firmada }))),
      p.descargas.length > 0 && tablaAdaptable(['Archivo', 'Tipo', 'Fecha'], p.descargas.map(x => [x.archivo, x.tipo.toUpperCase(), fechaHora(x.fecha)]))),
    h('p', { className: 'nota' }, 'Use los datos solo para este estudio, sin reidentificar ni cruzar fuentes.'));
}

export function pintarDoctor(contenedor) {
  const u = sesion.actual();
  const mias = peticiones.paraDestinatario(u.destinatario);
  const p = abierta && mias.find(x => x.id === abierta);
  if (p) { contenedor.replaceChildren(vistaPeticion(p, contenedor)); contenedor.querySelector('h2')?.focus(); return; }
  const actuales = mias.filter(x => DISPONIBLES.includes(x.estado));
  const abrir = x => {
    abierta = x.id;
    log('peticion', 'Petición consultada', '', { referencia: x.id });
    pintarDoctor(contenedor);
  };
  contenedor.replaceChildren(h('section', { className: 'panel', 'aria-labelledby': 'doc-h' },
    h('h2', { id: 'doc-h', tabIndex: -1 }, 'Mis peticiones'),
    h('p', { className: 'descripcion' }, `Peticiones dirigidas a ${etiquetaDestinatario(u.destinatario)}. Abra una para firmar el acuerdo y descargar.`),
    actuales.length > 0 && aviso('aviso', `${actuales.filter(x => x.estado === 'publicada').length} petición(es) esperan su firma.`),
    mias.length === 0
      ? h('div', { className: 'vacio' }, h('p', {}, 'No tiene peticiones dirigidas a su código.'))
      : tablaAdaptable(['Petición', 'Recibida', 'Datos', 'Estado', 'Acción'],
        mias.map(x => [x.id, fechaCorta(x.creadaEn), describirFiltro(x.filtro), etiquetaEstado(x.estado),
          DISPONIBLES.includes(x.estado)
            ? boton(x.estado === 'publicada' ? 'Abrir y firmar' : 'Abrir', () => abrir(x), { id: 'abrir-' + x.id, className: x.estado === 'publicada' ? 'principal' : '' })
            : h('span', { className: 'nota' }, 'En preparación por TI')]))));
}

export const reiniciarDoctor = () => { abierta = null; };
