// Destinatario de una petición: a quién se le entregan los datos anonimizados.
// Profesional de salud: número de licencia del MSP (0000-0000-000000). Personal del IESS:
// identificador institucional; como el prototipo no tiene esos registros, se usa IESS-0002.
export const TIPOS_DESTINATARIO = Object.freeze({
  msp: 'Profesional de salud (licencia del MSP)',
  iess: 'Personal del IESS (identificador institucional)',
});

const FORMATOS = {
  msp: { patron: /^\d{4}-\d{4}-\d{6}$/, maxDigitos: 14, ejemplo: '1720-2015-123456',
    texto: 'la licencia del MSP tiene 14 dígitos con el formato 0000-0000-000000' },
  iess: { patron: /^IESS-\d{4,6}$/, maxDigitos: 6, ejemplo: 'IESS-0002',
    texto: 'el identificador del IESS es IESS- seguido de 4 a 6 dígitos' },
};

export const normalizarId = id => String(id ?? '').trim().toUpperCase();
export const ejemploDestinatario = tipo => FORMATOS[tipo]?.ejemplo ?? '';
const digitos = texto => String(texto ?? '').replace(/\D/g, '');

// Da formato mientras se escribe: la licencia del MSP recibe los guiones (4-4-6) y el
// identificador del IESS el prefijo «IESS-». Con separadorFinal, el guion aparece en cuanto
// se completa un grupo (al borrar no se agrega, para poder quitarlo).
export function formatearId(tipo, texto, { separadorFinal = true } = {}) {
  const d = digitos(texto);
  if (!d) return '';
  if (tipo === 'iess') return 'IESS-' + d;
  let s = d.slice(0, 4);
  if (d.length > 4 || (separadorFinal && d.length === 4)) s += '-' + d.slice(4, 8);
  if (d.length > 8 || (separadorFinal && d.length === 8)) s += '-' + d.slice(8);
  return s;
}

// Tiene más dígitos de los que admite su tipo.
export const excedeLongitud = d => !!FORMATOS[d?.tipo] && digitos(d.id).length > FORMATOS[d.tipo].maxDigitos;

export function validarDestinatario(d) {
  if (!d || !FORMATOS[d.tipo]) return 'Elija el tipo de destinatario.';
  const id = normalizarId(d.id);
  if (!id) return 'Escriba el identificador del destinatario.';
  if (excedeLongitud(d)) return `Identificador inválido: ${FORMATOS[d.tipo].texto}.`;
  if (!FORMATOS[d.tipo].patron.test(id)) return `Identificador incompleto o no válido: ${FORMATOS[d.tipo].texto} (ej.: ${FORMATOS[d.tipo].ejemplo}).`;
  return '';
}

export const mismoDestinatario = (a, b) => !!a && !!b && a.tipo === b.tipo && normalizarId(a.id) === normalizarId(b.id);

export const etiquetaDestinatario = d => (d?.id
  ? `${normalizarId(d.id)} · ${d.tipo === 'msp' ? 'licencia MSP' : 'IESS'}`
  : '—');
