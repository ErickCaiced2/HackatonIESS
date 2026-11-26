// Piezas de interfaz reutilizables. Nunca se usa innerHTML.
export function h(etiqueta, props = {}, ...hijos) {
  const e = document.createElement(etiqueta);
  for (const [k, v] of Object.entries(props)) {
    if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k.includes('-') || k === 'role') e.setAttribute(k, v);
    else e[k] = v;
  }
  e.append(...hijos.flat(Infinity).filter(x => x !== null && x !== undefined && x !== false)
    .map(x => (x instanceof Node ? x : String(x))));
  return e;
}

export const boton = (texto, alPulsar, props = {}) =>
  h('button', { type: 'button', onclick: alPulsar, ...props }, texto);

export const tabla = (cabecera, filas) => h('div', { className: 'desliza', tabIndex: 0 }, h('table', {},
  h('thead', {}, h('tr', {}, cabecera.map(c => h('th', { scope: 'col' }, c)))),
  h('tbody', {}, filas.map(f => h('tr', {}, f.map(c => h('td', {}, c)))))));

// El estado siempre lleva icono y texto, no solo color.
const ICONOS = { ok: '✓', mal: '✗', aviso: '!', neutro: '•' };
export const etiqueta = (tipo, texto) =>
  h('span', { className: 'etiqueta ' + tipo }, `${ICONOS[tipo]} ${texto}`);
export const aviso = (tipo, ...contenido) =>
  h('div', { className: 'aviso ' + tipo }, h('strong', { 'aria-hidden': 'true' }, ICONOS[tipo] + ' '), contenido);

// Recuerda qué detalles abrió la persona, aunque la vista se vuelva a pintar.
const abiertos = new Set();
export function detalle(id, titulo, ...contenido) {
  const d = h('details', { id, open: abiertos.has(id) }, h('summary', { id: id + '-titulo' }, titulo), contenido);
  d.addEventListener('toggle', () => { if (d.open) abiertos.add(id); else abiertos.delete(id); });
  return d;
}

// Tabla con búsqueda; solo se repinta la tabla, así no se pierde el foco.
const busquedas = {};
export function tablaConBusqueda(id, cabecera, filas, texto = f => f.join(' ')) {
  const caja = h('div', {});
  const cuenta = h('p', { className: 'nota', role: 'status' });
  const filtrar = () => {
    const q = (busquedas[id] ?? '').trim().toLowerCase();
    const visibles = filas.filter(f => texto(f).toLowerCase().includes(q));
    caja.replaceChildren(visibles.length ? tabla(cabecera, visibles) : h('p', {}, 'Ninguna fila coincide. Borre la búsqueda para ver todas.'));
    cuenta.textContent = `${visibles.length} de ${filas.length} filas`;
  };
  filtrar();
  return h('div', {},
    h('label', { className: 'busqueda' }, 'Buscar en la tabla',
      h('input', { type: 'search', id: id + '-buscar', value: busquedas[id] ?? '', placeholder: 'Ej.: edad, suprimir',
        oninput: e => { busquedas[id] = e.target.value; filtrar(); } })),
    cuenta, caja);
}

// Confirmación antes de acciones que descartan trabajo.
export function confirmar(titulo, mensaje, textoAceptar) {
  return new Promise(resolver => {
    const d = document.getElementById('dialogo');
    const cerrar = respuesta => { d.close(); resolver(respuesta); };
    const cancelar = boton('Cancelar', () => cerrar(false));
    d.replaceChildren(h('h2', {}, titulo), h('p', {}, mensaje),
      h('div', { className: 'acciones' }, cancelar, boton(textoAceptar, () => cerrar(true), { className: 'peligro' })));
    d.oncancel = e => { e.preventDefault(); cerrar(false); };
    d.showModal();
    cancelar.focus();
  });
}
