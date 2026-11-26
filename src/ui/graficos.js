// Gráficos del tablero de TI en SVG/HTML, sin librerías externas.
// Paleta categórica validada (orden fijo); ver la skill de visualización. Los colores claros
// (aqua, amarillo) no llegan a 3:1 sobre blanco: por eso hay etiquetas directas y tabla de datos.
import { h } from './dom.js';

export const SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100'];
const NS = 'http://www.w3.org/2000/svg';
const s = (tag, attrs = {}, ...hijos) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  e.append(...hijos);
  return e;
};
const techo = max => { if (max <= 4) return 4; const p = 10 ** Math.floor(Math.log10(max)); return Math.ceil(max / p) * p; };

function tablaDatos(cabecera, filas) {
  return h('details', { className: 'tabla-grafico' }, h('summary', {}, 'Ver datos en tabla'),
    h('div', { className: 'desliza' }, h('table', {},
      h('thead', {}, h('tr', {}, cabecera.map(c => h('th', { scope: 'col' }, c)))),
      h('tbody', {}, filas.map(f => h('tr', {}, f.map(c => h('td', {}, c))))))));
}

// Líneas en el tiempo: leyenda, etiqueta directa al final, cruz con tooltip y teclado (← →).
// Se dibuja al ancho real del contenedor (ancho) para que el texto quede a su tamaño.
export function graficoLineas({ id, titulo, descripcion, series, datos, etiquetaX, ancho = 640 }) {
  const A = Math.max(420, Math.round(ancho)), H = 260, m = { i: 34, d: 120, s: 14, b: 28 };
  const max = techo(Math.max(1, ...datos.flatMap(d => series.map(se => d[se.clave]))));
  const x = i => m.i + (datos.length === 1 ? 0 : (i * (A - m.i - m.d)) / (datos.length - 1));
  const y = v => H - m.b - (v / max) * (H - m.s - m.b);
  const svg = s('svg', { viewBox: `0 0 ${A} ${H}`, role: 'img', 'aria-labelledby': id + '-t', class: 'grafico-svg' });
  for (let k = 0; k <= 4; k++) {
    const v = (max / 4) * k;
    svg.append(s('line', { x1: m.i, x2: A - m.d, y1: y(v), y2: y(v), class: 'rejilla' }),
      s('text', { x: m.i - 6, y: y(v) + 4, class: 'eje', 'text-anchor': 'end' }, String(Math.round(v))));
  }
  datos.forEach((d, i) => {
    if (i % Math.ceil(datos.length / 7) === 0 || i === datos.length - 1) {
      svg.append(s('text', { x: x(i), y: H - 8, class: 'eje', 'text-anchor': 'middle' }, etiquetaX(d)));
    }
  });
  // Etiquetas directas al final, separadas para que no se encimen.
  const finales = series.map((se, j) => ({ se, j, y: y(datos.at(-1)[se.clave]) })).sort((a, b) => a.y - b.y);
  for (let k = 1; k < finales.length; k++) finales[k].y = Math.max(finales[k].y, finales[k - 1].y + 13);
  series.forEach((se, j) => {
    svg.append(s('polyline', { points: datos.map((d, i) => `${x(i)},${y(d[se.clave])}`).join(' '), fill: 'none',
      stroke: SERIES[j], 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
  });
  finales.forEach(({ se, j, y: yy }) => svg.append(
    s('line', { x1: A - m.d + 4, x2: A - m.d + 14, y1: yy, y2: yy, stroke: SERIES[j], 'stroke-width': 2 }),
    s('text', { x: A - m.d + 18, y: yy + 4, class: 'etiqueta-directa' }, se.nombre)));
  const cruz = s('line', { y1: m.s, y2: H - m.b, class: 'cruz', visibility: 'hidden' });
  const puntos = series.map((_, j) => s('circle', { r: 4.5, fill: SERIES[j], stroke: '#fff', 'stroke-width': 2, visibility: 'hidden' }));
  svg.append(cruz, ...puntos);
  const tip = h('div', { className: 'tooltip-grafico', hidden: true, role: 'status' });
  const capa = s('rect', { x: m.i, y: m.s, width: A - m.i - m.d, height: H - m.s - m.b, fill: 'transparent', tabindex: 0,
    'aria-label': `${titulo}: use las flechas para recorrer los días` });
  svg.append(capa);
  let actual = datos.length - 1;
  const mostrar = i => {
    actual = Math.max(0, Math.min(datos.length - 1, i));
    const d = datos[actual];
    cruz.setAttribute('x1', x(actual)); cruz.setAttribute('x2', x(actual)); cruz.setAttribute('visibility', 'visible');
    puntos.forEach((p, j) => { p.setAttribute('cx', x(actual)); p.setAttribute('cy', y(d[series[j].clave])); p.setAttribute('visibility', 'visible'); });
    tip.replaceChildren(h('div', { className: 'tip-x' }, etiquetaX(d)),
      ...series.map((se, j) => h('div', { className: 'tip-fila' }, h('span', { className: 'tip-clave', style: `background:${SERIES[j]}` }),
        h('strong', {}, String(d[se.clave])), ' ', se.nombre)));
    tip.hidden = false;
    const rel = x(actual) / A;
    tip.style.left = `${rel * 100}%`;
    // Cerca de los bordes, el tooltip se pone al lado de la cruz para no tapar las etiquetas.
    tip.style.transform = rel > 0.6 ? 'translateX(calc(-100% - 14px))' : rel < 0.2 ? 'translateX(14px)' : 'translateX(-50%)';
  };
  const ocultar = () => { tip.hidden = true; cruz.setAttribute('visibility', 'hidden'); puntos.forEach(p => p.setAttribute('visibility', 'hidden')); };
  capa.addEventListener('pointermove', e => {
    const r = svg.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * A;
    mostrar(Math.round(((px - m.i) / (A - m.i - m.d)) * (datos.length - 1)));
  });
  capa.addEventListener('pointerleave', ocultar);
  capa.addEventListener('focus', () => mostrar(actual));
  capa.addEventListener('blur', ocultar);
  capa.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); mostrar(actual - 1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); mostrar(actual + 1); }
  });
  return h('figure', { className: 'grafico', id },
    h('figcaption', { id: id + '-t' }, h('strong', {}, titulo), descripcion && h('span', {}, descripcion)),
    h('ul', { className: 'leyenda' }, series.map((se, j) => h('li', {}, h('span', { className: 'tip-clave', style: `background:${SERIES[j]}` }), se.nombre))),
    h('div', { className: 'lienzo' }, svg, tip),
    tablaDatos(['Día', ...series.map(se => se.nombre)], datos.map(d => [etiquetaX(d), ...series.map(se => d[se.clave])])));
}

// Barras horizontales de una sola serie con el valor al final de cada barra.
export function graficoBarras({ id, titulo, descripcion, items }) {
  const max = Math.max(1, ...items.map(i => i.valor));
  return h('figure', { className: 'grafico', id },
    h('figcaption', {}, h('strong', {}, titulo), descripcion && h('span', {}, descripcion)),
    h('div', { className: 'barras', role: 'list' }, items.map(i => h('div', { className: 'fila-barra', role: 'listitem', tabIndex: 0,
      'aria-label': `${i.nombre}: ${i.valor}`, title: `${i.nombre}: ${i.valor}` },
    h('span', { className: 'nombre-barra' }, i.nombre),
    h('span', { className: 'pista-barra' }, i.valor > 0 && h('span', { className: 'barra', style: `width:${(i.valor / max) * 100}%;background:${SERIES[0]}` })),
    h('strong', { className: 'valor-barra' }, String(i.valor))))),
    tablaDatos(['Categoría', 'Cantidad'], items.map(i => [i.nombre, i.valor])));
}
