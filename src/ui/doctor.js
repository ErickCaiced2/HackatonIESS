// Doctor o personal autorizado: ve las peticiones dirigidas a su código, firma el acuerdo de
// confidencialidad y, solo entonces, se habilitan las descargas.
import { h, boton, aviso, tablaAdaptable, notificar, datosClave } from './dom.js';
import { icono } from './iconos.js';
import { ACUERDO, sha256 } from '../motor/entregables.js';
import { etiquetaDestinatario } from '../motor/destinatario.js';
import { describirFiltro } from './campos.js';
import { etiquetaEstado } from './comite.js';
import { peticiones, registro, sesion, log, mostrarError, fechaCorta, fechaHora, descargar } from './servicios.js';
import { leerArchivo } from './archivos.js';

const DISPONIBLES = ['publicada', 'firmada', 'descargada'];
let abierta = null;

// El destinatario solo descarga el CSV. Antes de entregarlo se comprueba que coincide con la huella registrada al publicar.
async function descargarCSV(p, repintar) {
  const u = sesion.actual();
  try {
    const e = await leerArchivo('entrega:' + p.id);
    if (!e) throw new Error('No se encontraron los archivos publicados de esta petición en este navegador.');
    const huella = await sha256(e.csv);
    const esperada = p.ejecucion?.sha256CSV ?? e.sha256CSV;
    if (esperada && huella !== esperada) throw new Error('El CSV guardado no coincide con la huella registrada al publicar. No se entrega: avise a TI.');
    const nombre = e.base + '_salida.csv';
    // Se registra antes de entregar el archivo.
    peticiones.registrarDescarga(p.id, { archivo: nombre, tipo: 'csv', sha256: huella }, u);
    registro.descarga(e.ejecucionId, nombre, new Date().toISOString(), { ...p.destinatario });
    log('descarga', 'Descarga CSV', `${nombre} · SHA-256 ${huella}`, { referencia: p.id });
    descargar(nombre, e.csv, 'text/csv;charset=utf-8');
    notificar('ok', `Se envió a descargas: ${nombre}.`);
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
      notificar('ok', 'Acuerdo firmado. Ya puede descargar el CSV.');
      repintar();
      document.getElementById('bajar-csv')?.focus();
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
      h('p', {}, 'El CSV deriva de datos de salud. Para descargarlo, me comprometo a:'),
      h('ol', {}, ACUERDO.condiciones.map(c => h('li', {}, c))),
      firmada
        ? aviso('ok', `Acuerdo firmado el ${fechaHora(p.firmadoEn)} por ${etiquetaDestinatario(p.destinatario)}.`)
        : [h('label', { className: 'casilla' }, casilla, h('strong', {}, 'He leído y acepto este acuerdo')),
          h('div', { className: 'acciones' }, boton('Firmar acuerdo', firmar, { className: 'principal', id: 'firmar' }))]),
    h('section', { className: 'descargas' + (firmada ? '' : ' congelado'), 'aria-labelledby': 'desc-h' },
      h('h3', { id: 'desc-h', className: 'con-icono' }, !firmada && icono('candado'), firmada ? 'Descarga del CSV' : 'Descarga del CSV (bloqueada)'),
      !firmada && h('p', { className: 'nota' }, 'Se habilita al firmar el acuerdo de confidencialidad.'),
      h('div', { className: 'acciones' }, boton('Descargar el CSV', () => descargarCSV(p, repintar), { id: 'bajar-csv', className: 'principal', disabled: !firmada })),
      p.ejecucion?.sha256CSV && datosClave([['Huella SHA-256 del CSV', h('code', { className: 'huella' }, p.ejecucion.sha256CSV)]]),
      h('p', { className: 'nota' }, 'La huella identifica este archivo exacto y su entrega a usted. Si el archivo se modifica, la huella cambia; si se comparte, TI puede comprobar de qué entrega salió.'),
      p.descargas.length > 0 && tablaAdaptable(['Archivo', 'Fecha', 'Huella SHA-256'],
        p.descargas.map(x => [x.archivo, fechaHora(x.fecha), x.sha256 ? h('code', { className: 'huella', title: x.sha256 }, x.sha256.slice(0, 16) + '…') : '—']))),
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
