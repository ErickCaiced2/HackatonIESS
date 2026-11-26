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

// Tabla que se ajusta al ancho del panel: en espacios angostos cada fila se ve como tarjeta.
// Una columna puede ser un texto o un grupo { texto, sub: ['Antes', 'Después'] }.
export function tablaAdaptable(cabecera, filas) {
  const grupo = c => typeof c === 'object' && Array.isArray(c.sub); // ojo: los textos tienen String.prototype.sub
  const hayGrupos = cabecera.some(grupo);
  const etiquetas = cabecera.flatMap(c => (grupo(c) ? c.sub.map(s => `${c.texto} · ${s.toLowerCase()}`) : [c]));
  return h('div', { className: 'adaptable', tabIndex: 0 }, h('table', {},
    h('thead', {},
      h('tr', {}, cabecera.map(c => (grupo(c)
        ? h('th', { scope: 'colgroup', colSpan: c.sub.length, className: 'grupo' }, c.texto)
        : h('th', { scope: 'col', rowSpan: hayGrupos ? 2 : 1 }, c)))),
      hayGrupos && h('tr', {}, cabecera.flatMap(c => (grupo(c) ? c.sub.map(s => h('th', { scope: 'col', className: 'sub' }, s)) : [])))),
    h('tbody', {}, filas.map(f => h('tr', {}, f.map((c, i) => h('td', { 'data-etiqueta': etiquetas[i] }, c)))))));
}

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
export function tablaConBusqueda(id, cabecera, filas, texto = f => f.join(' '), dibujar = tabla) {
  const caja = h('div', {});
  const cuenta = h('p', { className: 'nota', role: 'status' });
  const filtrar = () => {
    const q = (busquedas[id] ?? '').trim().toLowerCase();
    const visibles = filas.filter(f => texto(f).toLowerCase().includes(q));
    caja.replaceChildren(visibles.length ? dibujar(cabecera, visibles) : h('p', {}, 'Ninguna fila coincide.'));
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
