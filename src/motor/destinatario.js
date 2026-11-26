// Destinatario de una petición: a quién se le entregan los datos anonimizados.
// Profesional de salud: número de licencia (registro) del MSP. Personal del IESS: identificador
// institucional. Como el prototipo no tiene esos registros, el institucional usa el formato IESS-0002.
export const TIPOS_DESTINATARIO = Object.freeze({
  msp: 'Profesional de salud (licencia del MSP)',
  iess: 'Personal del IESS (identificador institucional)',
});

const FORMATOS = {
  // Dígitos con guiones opcionales, de 4 a 20 caracteres. [Confirmar] el formato real del MSP.
  msp: { patron: /^\d[\d-]{2,18}\d$/, ejemplo: '1720-2015-123456', texto: 'solo números y guiones, de 4 a 20 caracteres' },
  iess: { patron: /^IESS-\d{4,6}$/, ejemplo: 'IESS-0002', texto: 'IESS- seguido de 4 a 6 dígitos' },
};

export const normalizarId = id => String(id ?? '').trim().toUpperCase();
export const ejemploDestinatario = tipo => FORMATOS[tipo]?.ejemplo ?? '';

export function validarDestinatario(d) {
  if (!d || !FORMATOS[d.tipo]) return 'Elija el tipo de destinatario.';
  const id = normalizarId(d.id);
  if (!id) return 'Escriba el identificador del destinatario.';
  if (!FORMATOS[d.tipo].patron.test(id)) return `Formato no válido: ${FORMATOS[d.tipo].texto} (ej.: ${FORMATOS[d.tipo].ejemplo}).`;
  return '';
}

export const mismoDestinatario = (a, b) => !!a && !!b && a.tipo === b.tipo && normalizarId(a.id) === normalizarId(b.id);

export const etiquetaDestinatario = d => (d?.id
  ? `${normalizarId(d.id)} · ${d.tipo === 'msp' ? 'licencia MSP' : 'IESS'}`
  : '—');
