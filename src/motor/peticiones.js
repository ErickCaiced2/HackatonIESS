// Peticiones de datos: el comité de ética las crea, TI las procesa y el destinatario las firma y descarga.
// Cada cambio de estado queda en el historial de la petición. No hay operación para borrarlas.
import { listaPersistente, nuevoId } from './almacen.js';
import { validarDestinatario, mismoDestinatario, normalizarId } from './destinatario.js';
import { validarPeriodo, validarEdad } from './cie10.js';

export const ESTADOS = Object.freeze({
  enviada: 'Enviada a TI',
  devuelta: 'Devuelta al comité',
  en_proceso: 'En proceso (TI)',
  publicada: 'Lista para el destinatario',
  firmada: 'Acuerdo firmado',
  descargada: 'Descargada',
});

const TRANSICIONES = {
  enviada: ['devuelta', 'en_proceso'],
  devuelta: ['enviada'],
  en_proceso: ['publicada', 'devuelta'],
  publicada: ['firmada'],
  firmada: ['descargada'],
  descargada: ['descargada'],
};

const PDF_MAXIMO = 10 * 1024 * 1024;

export function validarPeticion({ destinatario, filtro, aprobacion }) {
  const e = [];
  const d = validarDestinatario(destinatario);
  if (d) e.push('Destinatario: ' + d);
  if (!filtro?.capitulo) e.push('Elija el capítulo CIE-10.');
  const p = validarPeriodo(filtro ?? {});
  if (p) e.push('Periodo: ' + p);
  const ed = validarEdad(filtro ?? {});
  if (ed) e.push('Edad: ' + ed);
  if (!aprobacion?.nombre) e.push('Adjunte la solicitud aprobada (PDF).');
  else if (!/\.pdf$/i.test(aprobacion.nombre) && aprobacion.tipo !== 'application/pdf') e.push('La solicitud aprobada debe ser un PDF.');
  else if (aprobacion.tamano > PDF_MAXIMO) e.push('El PDF supera 10 MB.');
  return e;
}

export function crearPeticiones(almacen = globalThis.localStorage) {
  const base = listaPersistente('iess.peticiones.v1', almacen);
  const lista = () => base.leer();
  const modificar = (id, fn) => {
    const l = lista();
    const p = l.find(x => x.id === id);
    if (!p) throw new Error(`No existe la petición ${id}.`);
    fn(p);
    base.guardar(l);
    return p;
  };
  const cambiarEstado = (p, nuevo, por, extra = {}) => {
    if (!TRANSICIONES[p.estado]?.includes(nuevo)) {
      throw new Error(`La petición ${p.id} está «${ESTADOS[p.estado]}» y no puede pasar a «${ESTADOS[nuevo]}».`);
    }
    p.estado = nuevo;
    p.historial.push({ estado: nuevo, fecha: new Date().toISOString(), por, ...extra });
  };
  const limpiarDestinatario = d => ({ tipo: d.tipo, id: normalizarId(d.id) });

  return {
    persistente: base.persistente,
    lista,
    obtener: id => lista().find(p => p.id === id) ?? null,
    paraDestinatario: d => lista().filter(p => mismoDestinatario(p.destinatario, d)),

    crear({ destinatario, filtro, aprobacion }, por) {
      const errores = validarPeticion({ destinatario, filtro, aprobacion });
      if (errores.length) throw new Error(errores.join(' '));
      const l = lista();
      let id;
      do id = nuevoId('PET'); while (l.some(p => p.id === id));
      const fecha = new Date().toISOString();
      const p = {
        id, creadaEn: fecha, creadaPor: por, estado: 'enviada',
        destinatario: limpiarDestinatario(destinatario), filtro: { ...filtro },
        aprobacion: { nombre: aprobacion.nombre, tamano: aprobacion.tamano, tipo: aprobacion.tipo, sha256: aprobacion.sha256 },
        historial: [{ estado: 'enviada', fecha, por }],
        ejecucion: null, firmadoEn: null, descargas: [],
      };
      base.guardar([p, ...l]);
      return p;
    },
    devolver(id, motivo, por) {
      if (!String(motivo ?? '').trim()) throw new Error('Escriba el motivo de la devolución.');
      return modificar(id, p => cambiarEstado(p, 'devuelta', por, { motivo: motivo.trim() }));
    },
    // El comité corrige una petición devuelta y la vuelve a enviar.
    reenviar(id, { destinatario, filtro, aprobacion }, por) {
      return modificar(id, p => {
        const nueva = { destinatario: destinatario ?? p.destinatario, filtro: filtro ?? p.filtro, aprobacion: aprobacion ?? p.aprobacion };
        const errores = validarPeticion(nueva);
        if (errores.length) throw new Error(errores.join(' '));
        p.destinatario = limpiarDestinatario(nueva.destinatario);
        p.filtro = { ...nueva.filtro };
        p.aprobacion = { ...nueva.aprobacion };
        cambiarEstado(p, 'enviada', por);
      });
    },
    tomar: (id, por) => modificar(id, p => cambiarEstado(p, 'en_proceso', por)),
    publicar(id, ejecucion, por) {
      return modificar(id, p => { cambiarEstado(p, 'publicada', por, { ejecucion: ejecucion.id }); p.ejecucion = ejecucion; });
    },
    firmar(id, usuario) {
      return modificar(id, p => {
        if (!mismoDestinatario(p.destinatario, usuario.destinatario)) throw new Error('Solo el destinatario de la petición puede firmar el acuerdo.');
        cambiarEstado(p, 'firmada', usuario.usuario);
        p.firmadoEn = p.historial.at(-1).fecha;
      });
    },
    registrarDescarga(id, { archivo, tipo }, usuario) {
      return modificar(id, p => {
        if (!mismoDestinatario(p.destinatario, usuario.destinatario)) throw new Error('Solo el destinatario de la petición puede descargar.');
        if (!p.firmadoEn) throw new Error('Firme el acuerdo de confidencialidad antes de descargar.');
        const fecha = new Date().toISOString();
        if (p.estado === 'firmada') cambiarEstado(p, 'descargada', usuario.usuario);
        p.descargas.push({ archivo, tipo, fecha, por: usuario.usuario });
      });
    },
  };
}
