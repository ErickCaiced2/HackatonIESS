// Pantalla de inicio de sesión. Personal del IESS (TI, comité) con usuario y contraseña;
// doctor o personal autorizado con su licencia/identificador y el teclado en pantalla.
import { h, boton, aviso } from './dom.js';
import { autenticar, ROLES } from '../motor/usuarios.js';
import { normalizarId, validarDestinatario } from '../motor/destinatario.js';
import { campoPersona, tecladoVirtual } from './campos.js';
import { sesion, log } from './servicios.js';

let modo = 'interno'; // 'interno' | 'receptor'

export function pintarLogin(contenedor, alIniciar) {
  const error = h('div', { role: 'alert', className: 'error-login' });
  const fallo = (usuario, motivo) => {
    log('sesion', 'Inicio de sesión fallido', motivo, { usuario, resultado: 'fallo' });
    error.replaceChildren(aviso('mal', 'Usuario o contraseña incorrectos. Revise los datos e inténtelo de nuevo.'));
  };
  const entrar = async (usuario, contrasena, rolesPermitidos) => {
    error.replaceChildren();
    const u = await autenticar(usuario, contrasena);
    if (!u || !rolesPermitidos.includes(u.rol)) { fallo(usuario, u ? 'Rol no permitido en esta pestaña' : 'Credenciales no válidas'); return; }
    sesion.iniciar(u);
    log('sesion', 'Inicio de sesión', ROLES[u.rol]);
    alIniciar(u);
  };

  let formulario;
  if (modo === 'interno') {
    const usuario = h('input', { id: 'login-usuario', autocomplete: 'username', required: true });
    const clave = h('input', { id: 'login-clave', type: 'password', autocomplete: 'current-password', required: true });
    formulario = h('form', { className: 'form-login', onsubmit: e => { e.preventDefault(); entrar(usuario.value, clave.value, ['ti', 'ce']); } },
      h('label', {}, 'Usuario', usuario),
      h('label', {}, 'Contraseña', clave),
      h('button', { type: 'submit', className: 'principal', id: 'login-entrar' }, 'Ingresar'));
  } else {
    const persona = { tipo: 'msp', id: '' };
    const teclado = tecladoVirtual('login-clave-teclado', 'Contraseña');
    formulario = h('form', { className: 'form-login', onsubmit: e => {
      e.preventDefault();
      const err = validarDestinatario(persona);
      if (err) { error.replaceChildren(aviso('mal', err)); return; }
      entrar(normalizarId(persona.id), teclado.valor(), ['receptor']).finally(() => teclado.limpiar());
    } },
    campoPersona('login', persona),
    teclado.elemento,
    h('button', { type: 'submit', className: 'principal', id: 'login-entrar' }, 'Ingresar'));
  }

  const pestana = (id, texto) => boton(texto, () => { modo = id; pintarLogin(contenedor, alIniciar); },
    { id: 'login-modo-' + id, 'aria-pressed': String(modo === id) });

  contenedor.replaceChildren(h('section', { className: 'panel login', 'aria-labelledby': 'login-h' },
    h('h2', { id: 'login-h', tabIndex: -1 }, 'Iniciar sesión'),
    h('p', { className: 'descripcion' }, 'Elija cómo ingresa. Cada rol ve solo lo que le corresponde.'),
    h('div', { className: 'segmentos', role: 'group', 'aria-label': 'Tipo de acceso' },
      pestana('interno', 'Personal del IESS (TI o comité)'), pestana('receptor', 'Doctor o personal autorizado')),
    error, formulario,
    h('details', { className: 'cuentas-prueba' }, h('summary', {}, 'Cuentas de prueba del prototipo'),
      h('ul', {},
        h('li', {}, 'TI: usuario ti · contraseña ti'),
        h('li', {}, 'Comité de ética: usuario ce · contraseña ce'),
        h('li', {}, 'Doctor: licencia 1720-2015-123456 · contraseña doc'),
        h('li', {}, 'Personal IESS autorizado: IESS-0002 · contraseña iess')),
      h('p', { className: 'nota' }, 'Prototipo: las cuentas viven en el navegador y no son seguridad real.'))));
  contenedor.querySelector('#login-usuario, #login-id')?.focus();
}
