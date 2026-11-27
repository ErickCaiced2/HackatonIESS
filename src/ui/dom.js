// Piezas de interfaz reutilizables. Nunca se usa innerHTML.
import { icono } from './iconos.js';
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

// El estado siempre lleva ícono dibujado y texto, no solo color. El ícono va al final del texto.
export const iconoEstado = tipo => icono(tipo, 'icono-estado');

// Datos clave de un elemento (petición, ejecución): etiqueta y valor, sin cabeceras «Dato / Valor».
export const datosClave = filas => h('dl', { className: 'datos-clave' },
  filas.map(([clave, valor]) => h('div', { className: 'dato' }, h('dt', {}, clave), h('dd', {}, valor))));
export const etiqueta = (tipo, texto) =>
  h('span', { className: 'etiqueta ' + tipo }, texto, iconoEstado(tipo));
export const aviso = (tipo, ...contenido) =>
  h('div', { className: 'aviso ' + tipo }, h('div', { className: 'aviso-texto' }, contenido), iconoEstado(tipo));

// Avisos del sistema arriba a la derecha: verde = éxito, naranja = advertencia, rojo = error.
// Los errores quedan hasta cerrarlos; los demás se van solos (se pausan con el puntero o el foco).
const DURACION = { ok: 5000, aviso: 8000 };
const TITULO = { ok: 'Listo', aviso: 'Atención', mal: 'Error' };
export function notificar(tipo, ...contenido) {
  const zona = document.getElementById('notificaciones');
  if (!zona) return null;
  const clave = contenido.map(c => (c instanceof Node ? c.textContent : String(c))).join(' ');
  zona.querySelector(`[data-clave="${CSS.escape(clave)}"]`)?.remove(); // sin duplicados
  let temporizador;
  const cerrar = () => { clearTimeout(temporizador); nota.remove(); };
  const programar = () => { if (DURACION[tipo]) temporizador = setTimeout(cerrar, DURACION[tipo]); };
  const nota = h('div', { className: 'notificacion ' + tipo, role: tipo === 'mal' ? 'alert' : 'status', 'data-clave': clave,
    onmouseenter: () => clearTimeout(temporizador), onmouseleave: programar,
    onfocusin: () => clearTimeout(temporizador), onfocusout: programar },
  h('div', { className: 'cuerpo' }, h('strong', {}, TITULO[tipo], iconoEstado(tipo)), h('div', {}, contenido)),
  h('button', { type: 'button', className: 'cerrar', 'aria-label': 'Cerrar aviso', onclick: cerrar }, icono('cerrar')));
  zona.append(nota);
  // Como máximo dos a la vez: más avisos tapan la pantalla y nadie los lee.
  while (zona.children.length > 2) zona.firstElementChild.remove();
  programar();
  return nota;
}
export function cerrarNotificaciones(tipo) {
  document.querySelectorAll('#notificaciones .notificacion' + (tipo ? '.' + tipo : '')).forEach(n => n.remove());
}

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

// Pestañas: muestran una parte del contenido a la vez para no obligar a desplazarse.
// opciones: [[clave, texto, () => contenido]]. La elegida se recuerda aunque la vista se vuelva a pintar.
const pestanasElegidas = {};
export function pestanas(id, opciones, nombre) {
  const valida = c => opciones.some(([k]) => k === c);
  let elegida = valida(pestanasElegidas[id]) ? pestanasElegidas[id] : opciones[0][0];
  const cuerpo = h('div', { role: 'tabpanel', id: id + '-panel', className: 'pestana-panel' });
  const botones = opciones.map(([clave, texto]) => h('button', { type: 'button', role: 'tab', id: `${id}-${clave}`,
    'aria-controls': id + '-panel', onclick: () => elegir(clave), onkeydown: tecla }, texto));
  function elegir(clave, foco = false) {
    elegida = clave;
    pestanasElegidas[id] = clave;
    botones.forEach((b, i) => {
      const sel = opciones[i][0] === clave;
      b.setAttribute('aria-selected', String(sel));
      b.tabIndex = sel ? 0 : -1;
      if (sel && foco) b.focus();
    });
    cuerpo.setAttribute('aria-labelledby', `${id}-${clave}`);
    cuerpo.replaceChildren(h('div', {}, opciones.find(([k]) => k === clave)[2]()));
  }
  function tecla(e) {
    const i = opciones.findIndex(([k]) => k === elegida);
    const n = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: opciones.length - 1 }[e.key];
    if (n === undefined) return;
    e.preventDefault();
    elegir(opciones[(n + opciones.length) % opciones.length][0], true);
  }
  elegir(elegida);
  return h('div', { className: 'pestanas' }, h('div', { className: 'segmentos', role: 'tablist', 'aria-label': nombre }, botones), cuerpo);
}
