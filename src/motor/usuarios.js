// Usuarios del prototipo y autenticación. Las contraseñas se guardan como hash SHA-256 con sal,
// pero al estar en el navegador esto NO es seguridad real: un sistema real autentica en un servidor.
import { normalizarId } from './destinatario.js';

export const ROLES = Object.freeze({
  ti: 'Tecnologías de la información (TI)',
  ce: 'Comité de ética',
  receptor: 'Doctor o personal autorizado',
});

const SAL = 'iess-prototipo';

// Cuentas de prueba: ti/ti, ce/ce, licencia 1720-2015-123456 / doc, IESS-0002 / iess.
const USUARIOS = [
  { usuario: 'ti', rol: 'ti', nombre: 'Equipo de TI', hash: '1333d76976bb6e4db14f48a300fb0409a3bec0565d1ddc876785440f95ce289e' },
  { usuario: 'ce', rol: 'ce', nombre: 'Comité de ética', hash: '511b7a087757cfa9afdb6389b68271929b066866db11c46f127d5071d90de6b3' },
  { usuario: '1720-2015-123456', rol: 'receptor', tipo: 'msp', nombre: 'Doctor de prueba', hash: '9cdfba3de9889f4395a343384891d0a8317ae3cf69f1873b86d4c5684495bd2b' },
  { usuario: 'IESS-0002', rol: 'receptor', tipo: 'iess', nombre: 'Personal IESS de prueba', hash: '139adb6a44a69d2a4c4a14ebeefc5090722f9e0e2c392d0ff9d332a69a41904a' },
];

async function sha256(texto) {
  const h = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// Los usuarios internos se escriben en minúsculas; las licencias e identificadores IESS, normalizados.
export function normalizarUsuario(texto) {
  const t = String(texto ?? '').trim();
  return /^(IESS-|\d)/i.test(t) ? normalizarId(t) : t.toLowerCase();
}

// Devuelve los datos públicos del usuario o null. Nunca dice cuál de los dos datos falló.
export async function autenticar(usuario, contrasena) {
  const u = USUARIOS.find(x => x.usuario === normalizarUsuario(usuario));
  const hash = await sha256(`${SAL}|${normalizarUsuario(usuario)}|${contrasena ?? ''}`);
  if (!u || u.hash !== hash) return null;
  const { hash: _, ...publico } = u;
  return { ...publico, ...(u.rol === 'receptor' ? { destinatario: { tipo: u.tipo, id: u.usuario } } : {}) };
}

export const esReceptor = usuario => /^(IESS-|\d)/i.test(String(usuario ?? '').trim());
