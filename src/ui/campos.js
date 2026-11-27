// Campos reutilizables: persona autorizada, teclado en pantalla y filtro de la petición.
import { h, boton } from './dom.js';
import { TIPOS_DESTINATARIO, validarDestinatario, ejemploDestinatario, normalizarId, formatearId, excedeLongitud } from '../motor/destinatario.js';
import { CAPITULOS, bloquesDe, categoriasDe, PERIODO_MINIMO, anioActual, periodo, etiquetaPeriodo, etiquetaFiltro,
  EDAD_MINIMA, EDAD_MAXIMA, rangoEdad, etiquetaEdad, incluyeMenores } from '../motor/cie10.js';

// Tipo de personal + identificador con formato automático (licencia 4-4-6, prefijo IESS-).
// Mientras se escribe solo se avisa si sobran dígitos; al terminar se valida todo.
export function campoPersona(prefijo, valor, { alEscribir, alConfirmar, extraError = () => '' } = {}) {
  const mensaje = h('p', { className: 'error-campo', id: prefijo + '-error', role: 'status' });
  const validar = completo => {
    let nivel = '', texto = '';
    if (valor.id) {
      if (excedeLongitud(valor)) { nivel = 'aviso'; texto = validarDestinatario(valor); }
      else if (completo) {
        const err = validarDestinatario(valor) || extraError(valor);
        if (err) { nivel = 'mal'; texto = err; }
      }
    }
    mensaje.className = 'error-campo ' + nivel;
    mensaje.textContent = texto;
    entrada.setAttribute('aria-invalid', String(!!nivel));
    entrada.dataset.nivel = nivel;
  };
  const entrada = h('input', { id: prefijo + '-id', value: valor.id, placeholder: 'Ej.: ' + ejemploDestinatario(valor.tipo),
    inputMode: 'numeric', autocomplete: 'off', spellcheck: false, 'aria-describedby': prefijo + '-error',
    oninput: e => {
      const borrando = e.inputType?.startsWith('delete');
      valor.id = formatearId(valor.tipo, e.target.value, { separadorFinal: !borrando });
      e.target.value = valor.id;
      validar(false);
      alEscribir?.();
    },
    onchange: () => { valor.id = normalizarId(valor.id); validar(true); alConfirmar?.(); } });
  const tipo = h('select', { id: prefijo + '-tipo', onchange: e => {
    valor.tipo = e.target.value;
    valor.id = formatearId(valor.tipo, valor.id, { separadorFinal: false });
    entrada.value = valor.id;
    entrada.placeholder = 'Ej.: ' + ejemploDestinatario(valor.tipo);
    etiquetaId.firstChild.textContent = valor.tipo === 'msp' ? 'Número de licencia del MSP' : 'Identificador institucional del IESS';
    validar(true);
    alConfirmar?.();
  } }, Object.entries(TIPOS_DESTINATARIO).map(([v, t]) => h('option', { value: v, selected: v === valor.tipo }, t)));
  const etiquetaId = h('label', {}, valor.tipo === 'msp' ? 'Número de licencia del MSP' : 'Identificador institucional del IESS', entrada);
  validar(true);
  return h('div', { className: 'campo-persona' }, h('div', { className: 'fila' }, h('label', {}, 'Tipo de personal', tipo), etiquetaId), mensaje);
}

// Teclado en pantalla para la contraseña: el campo no acepta el teclado físico.
// Los números cambian de orden cada vez que se muestra el teclado.
export function tecladoVirtual(id, etiqueta) {
  let valor = '', mayusculas = false, visible = false;
  const pantalla = h('input', { id, type: 'password', readOnly: true, autocomplete: 'off', className: 'pantalla-teclado',
    'aria-describedby': id + '-ayuda', placeholder: 'Use el teclado en pantalla' });
  const mostrar = () => { pantalla.value = valor; pantalla.type = visible ? 'text' : 'password'; };
  const digitos = [...'0123456789'];
  for (let i = digitos.length - 1; i > 0; i--) {
    const b = new Uint32Array(1); globalThis.crypto.getRandomValues(b);
    const j = b[0] % (i + 1); [digitos[i], digitos[j]] = [digitos[j], digitos[i]];
  }
  const filas = [digitos, [...'qwertyuiop'], [...'asdfghjklñ'], [...'zxcvbnm']];
  const teclas = [];
  const tecla = c => {
    const b = boton(c, () => { valor += mayusculas ? c.toUpperCase() : c; mostrar(); }, { className: 'tecla', 'aria-label': `Tecla ${c}` });
    if (/[a-zñ]/.test(c)) teclas.push(b);
    return b;
  };
  const cuadricula = h('div', { className: 'teclado', role: 'group', 'aria-label': 'Teclado en pantalla' },
    filas.map(f => h('div', { className: 'fila-teclado' }, f.map(tecla))),
    h('div', { className: 'fila-teclado' },
      boton('Mayús', e => {
        mayusculas = !mayusculas;
        e.currentTarget.setAttribute('aria-pressed', String(mayusculas));
        teclas.forEach(t => { t.textContent = mayusculas ? t.textContent.toUpperCase() : t.textContent.toLowerCase(); });
      }, { className: 'tecla ancha', 'aria-pressed': 'false' }),
      boton('Borrar ⌫', () => { valor = valor.slice(0, -1); mostrar(); }, { className: 'tecla ancha', 'aria-label': 'Borrar el último carácter' }),
      boton('Limpiar', () => { valor = ''; mostrar(); }, { className: 'tecla ancha' }),
      boton('Mostrar', e => { visible = !visible; e.currentTarget.textContent = visible ? 'Ocultar' : 'Mostrar'; mostrar(); },
        { className: 'tecla ancha', 'aria-label': 'Mostrar u ocultar la contraseña' })));
  return {
    elemento: h('div', { className: 'campo' }, h('label', { htmlFor: id }, etiqueta), pantalla,
      h('small', { id: id + '-ayuda' }, 'Por seguridad la contraseña solo se escribe con este teclado. Los números cambian de lugar cada vez.'),
      cuadricula),
    valor: () => valor,
    limpiar: () => { valor = ''; mostrar(); },
  };
}

// Filtro que define el comité: capítulo, grupo y categoría CIE-10 y periodo de atención.
// Sin la base cargada no hay conteos; fuera del capítulo V las categorías se eligen al procesar.
export function campoFiltro(filtro, alCambiar) {
  const p = periodo(filtro);
  const sel = (texto, id, valor, opciones, fn, ayuda) => h('label', {}, texto,
    h('select', { id, onchange: e => { fn(e.target.value); alCambiar(); } },
      opciones.map(([v, t, deshabilitada]) => h('option', { value: v, selected: String(v) === String(valor), disabled: !!deshabilitada }, t))),
    ayuda && h('small', {}, ayuda));
  const anios = [];
  for (let a = anioActual(); a >= PERIODO_MINIMO; a--) anios.push(a);
  const categorias = categoriasDe(filtro.capitulo, filtro.bloque, []);
  const e = rangoEdad(filtro);
  const edades = [];
  for (let a = EDAD_MINIMA; a <= EDAD_MAXIMA; a++) edades.push(a);
  return h('div', { className: 'campo-filtro' },
    h('div', { className: 'fila' },
      sel('Capítulo CIE-10', 'pf-capitulo', filtro.capitulo, CAPITULOS.map(c => [c.id, `${c.id} · ${c.desde}-${c.hasta} · ${c.nombre}`]),
        v => Object.assign(filtro, { capitulo: v, bloque: '', categoria: '' })),
      sel('Grupo', 'pf-grupo', filtro.bloque, [['', 'Todos'], ...bloquesDe(filtro.capitulo).map(b => [b.id, `${b.id} · ${b.nombre}`])],
        v => Object.assign(filtro, { bloque: v, categoria: '' })),
      sel('Categoría', 'pf-categoria', filtro.categoria, [['', 'Todas'], ...categorias.map(([c, n]) => [c, `${c} · ${n}`])],
        v => Object.assign(filtro, { categoria: v }),
        filtro.capitulo === 'V' ? '' : 'Fuera del capítulo V solo se puede pedir el capítulo o un grupo completo.')),
    // Periodo y edad, lado a lado: cada uno con su nota debajo.
    h('div', { className: 'fila periodo-edad' }, h('div', {}, h('div', { className: 'fila' },
      sel('Periodo desde el año', 'pf-desde', p.desde, anios.map(a => [a, String(a), a > p.hasta]), v => { filtro.desde = Number(v); }),
      sel('Periodo hasta el año', 'pf-hasta', p.hasta, anios.map(a => [a, String(a), a < p.desde]), v => { filtro.hasta = Number(v); })),
    h('p', { className: 'nota' }, `Fecha de ingreso del 1 de enero de ${p.desde} al 31 de diciembre de ${p.hasta}.`)),
    h('div', {}, h('div', { className: 'fila' },
      sel('Edad desde (años)', 'pf-edad-desde', e.desde, edades.map(a => [a, String(a), e.hasta !== null && a > e.hasta]), v => { filtro.edadDesde = Number(v); }),
      sel('Edad hasta (años)', 'pf-edad-hasta', e.hasta ?? '', [['', 'Sin límite (o más)'], ...edades.map(a => [a, String(a), a < e.desde])],
        v => { filtro.edadHasta = v === '' ? null : Number(v); })),
    incluyeMenores(filtro)
      ? h('p', { className: 'nota nota-especial', role: 'status' }, h('strong', {}, 'Dato especial: '),
        `la petición incluye a niñas, niños y adolescentes (edad ${e.hasta === null ? `${e.desde} años o más` : `${e.desde} a ${e.hasta} años`}). Son datos de categoría especial (art. 25 LOPDP): se entregan solo con la aprobación del comité, con edades agrupadas en 0-11 y 12-17 y con las mismas reglas de protección.`)
      : h('p', { className: 'nota' }, `Edad cumplida a la fecha de la atención: ${etiquetaEdad(filtro)}. Solo personas adultas.`))));
}

export const describirFiltro = f => `${etiquetaFiltro(f)} · ${etiquetaEdad(f)} · periodo ${etiquetaPeriodo(f)}`;
