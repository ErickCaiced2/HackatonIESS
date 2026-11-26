// Interfaz. Los datos viven solo en memoria; el DOM se construye sin innerHTML.
import { REFERENCIA, PROPIA } from '../motor/config.js';
import { leer, extraerCohorte, medir, ejecutar, plan, validarConfig } from '../motor/motor.js';
import { aCSV } from '../motor/csv.js';
import { zip } from '../motor/zip.js';
import { CAPITULOS, BLOQUES_F, CATEGORIAS_F, FILTRO_ESTUDIO, nombreCIE10 } from '../motor/cie10.js';
import { num, pct, ident, sha256, configuracionJSON, trazabilidadJSON, ptaHTML,
  BORRADOR_RIESGO, BORRADOR_TITULAR } from '../motor/entregables.js';

const inicial = () => ({
  datos: null, cohorte: null, antes: null, r: null, historial: {},
  config: { ...REFERENCIA }, propia: { ...PROPIA }, filtro: { ...FILTRO_ESTUDIO },
});
let S = inicial();
let paso = 0, pestana = 'recorrido';
const pta = { equipo: '', riesgo: BORRADOR_RIESGO, titular: BORRADOR_TITULAR, atacante: '', canal: '', okRiesgo: false, okTitular: false };
const PASOS = ['1 Cargar', '2 Configurar', '3 Resultados', '4 Trazabilidad', '5 Entregar'];
const habilitado = i => i === 0 || (i === 1 ? !!S.cohorte?.atenciones : !!S.r);

function h(etiqueta, props = {}, ...hijos) {
  const e = document.createElement(etiqueta);
  for (const [k, v] of Object.entries(props)) {
    if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k.includes('-') || k === 'role') e.setAttribute(k, v);
    else e[k] = v;
  }
  e.append(...hijos.flat().filter(x => x !== null && x !== false).map(x => (x instanceof Node ? x : String(x))));
  return e;
}
const tarjeta = (titulo, ...x) => h('section', { className: 'tarjeta' }, h('h2', {}, titulo), ...x);
const tabla = (cab, filas) => h('div', { className: 'desliza' }, h('table', {},
  h('thead', {}, h('tr', {}, cab.map(c => h('th', { scope: 'col' }, c)))),
  h('tbody', {}, filas.map(f => h('tr', {}, f.map(c => h('td', {}, c)))))));
const marca = (ok, texto) => h('span', { className: ok ? 'ok' : 'mal' }, `${ok ? '✓' : '✗'} ${texto}`);

function mostrarError(mensaje) {
  const e = document.getElementById('error');
  e.textContent = mensaje; e.hidden = !mensaje;
}
// Deja que el navegador pinte antes de un cálculo largo.
function intentar(fn) {
  mostrarError('');
  document.body.style.cursor = 'wait';
  setTimeout(async () => {
    try { await fn(); } catch (e) { mostrarError(e.message); }
    document.body.style.cursor = '';
    pintar();
  }, 30);
}
const ir = i => { paso = i; mostrarError(''); pintar(); };

async function cargar(archivo) {
  S = inicial();
  pestana = 'recorrido';
  Object.assign(pta, { okRiesgo: false, okTitular: false, riesgo: BORRADOR_RIESGO, titular: BORRADOR_TITULAR });
  let texto;
  try { texto = new TextDecoder('utf-8', { fatal: true }).decode(await archivo.arrayBuffer()); }
  catch { throw new Error('El archivo no se pudo leer como UTF-8.'); }
  S.datos = leer(texto);
}

function filtroCIE10() {
  const f = S.filtro;
  const aplicar = nuevo => { // cambiar el filtro invalida la cohorte y los resultados
    S.filtro = nuevo;
    S.cohorte = null; S.antes = null; S.r = null; S.historial = {};
    pta.okRiesgo = pta.okTitular = false;
    pintar();
  };
  const selector = (etiqueta, valor, opciones, alCambiar, desactivado) => h('label', {}, etiqueta,
    h('select', { disabled: desactivado, onchange: e => alCambiar(e.target.value) },
      opciones.map(([v, t]) => h('option', { value: v, selected: v === valor }, t))));
  const esF = f.capitulo === 'V';
  const grupo = BLOQUES_F.find(x => x.id === f.bloque);
  const categorias = Object.entries(CATEGORIAS_F)
    .filter(([codigo]) => !grupo || (codigo >= grupo.desde && codigo <= grupo.hasta));
  return h('fieldset', {}, h('legend', {}, 'Filtro de diagnóstico CIE-10'),
    h('div', { className: 'fila' },
      selector('Capítulo', f.capitulo, CAPITULOS.map(c => [c.id, `${c.id} · ${c.desde}-${c.hasta} · ${c.nombre}`]),
        v => aplicar({ capitulo: v, bloque: '', categoria: '' })),
      selector('Grupo (solo salud mental)', f.bloque,
        [['', 'Todos'], ...BLOQUES_F.map(b => [b.id, `${b.id} · ${b.nombre}`])],
        v => aplicar({ ...f, bloque: v, categoria: '' }), !esF),
      selector('Categoría (solo salud mental)', f.categoria,
        [['', 'Todas'], ...categorias.map(([c, n]) => [c, `${c} · ${n}`])],
        v => aplicar({ ...f, categoria: v }), !esF)),
    h('p', {}, 'El estudio pide el capítulo V completo (códigos F).'));
}

function vistaCargar() {
  const c = S.cohorte, d = S.datos;
  return [
    tarjeta('Archivo',
      h('label', {}, 'CSV con la estructura de la base: ',
        h('input', { type: 'file', accept: '.csv', onchange: e => {
          const f = e.target.files[0];
          if (f) intentar(() => cargar(f));
        } })),
      d && h('p', { className: 'ok' }, `✓ Estructura válida · ${d.columnas.length} columnas · ${num(d.filas.length)} filas · ${num(d.personas)} personas`),
      d && d.avisos.map(a => h('p', {}, 'Aviso: ' + a)),
      d && filtroCIE10(),
      d && h('button', { className: 'principal', onclick: () => intentar(() => {
        S.cohorte = null; S.antes = null; S.r = null; S.historial = {};
        S.cohorte = extraerCohorte(S.datos.filas, S.filtro);
        if (!S.cohorte.atenciones) throw new Error('La cohorte está vacía.');
        S.antes = medir(S.cohorte.filas, 'cedula');
      }) }, 'Extraer cohorte')),
    c && !c.esEstudio && h('div', { className: 'banda mal' },
      'EXPLORACIÓN: esta cohorte no es la que pide el estudio. Puede medirla, pero no entregarla.'),
    c && tarjeta('Cohorte',
      tabla(['Concepto', 'Atenciones'], [
        ['Filas de entrada', num(c.entrada)],
        [`− Diagnóstico fuera del filtro (${c.etiquetaFiltro})`, num(c.excluidas.diagnostico)],
        ['− Menor de 18 a la fecha de atención', num(c.excluidas.menor)],
        ['− Fuera de 2023-2025', num(c.excluidas.periodo)],
        ['Cohorte', num(c.atenciones)]]),
      h('p', {}, h('strong', {}, `${num(c.personas)} personas · ${num(c.atenciones)} atenciones`))),
    S.antes && tarjeta('Riesgo inicial',
      tabla(['Indicador', 'Valor'], [
        ['k mínimo (meta: 5 o más)', marca(S.antes.kMin >= 5, S.antes.kMin)],
        ['Personas únicas', pct(S.antes.pctUnicas)],
        ['Identificadores', ident(S.antes.identificadores)]]),
      h('p', {}, h('button', { className: 'principal', onclick: () => ir(1) }, 'Configurar'))),
  ];
}

function cambiar(clave, valor) {
  S.config[clave] = valor;
  if (S.config.tipo === 'propia') S.propia = { ...S.config };
  S.r = null; delete S.historial.propia; // lo anterior queda desactualizado
  pta.okRiesgo = pta.okTitular = false;
  pintar();
}

function vistaConfigurar() {
  const c = S.config, fija = c.tipo === 'referencia';
  const elegir = tipo => {
    S.config = tipo === 'referencia' ? { ...REFERENCIA } : { ...S.propia };
    S.r = S.historial[tipo] ?? null;
    pta.okRiesgo = pta.okTitular = false;
    pintar();
  };
  const selector = (etiqueta, claveC, opciones) => h('label', {}, etiqueta,
    h('select', { disabled: fija, onchange: e => cambiar(claveC, opciones.find(o => String(o[0]) === e.target.value)[0]) },
      opciones.map(([v, t]) => h('option', { value: String(v), selected: c[claveC] === v }, t))));
  const numero = (etiqueta, claveC, min) => h('label', {}, etiqueta,
    h('input', { type: 'number', min, value: c[claveC] ?? '', disabled: fija,
      onchange: e => cambiar(claveC, e.target.value === '' ? null : Number(e.target.value)) }));
  const errores = validarConfig(c);
  return [
    tarjeta('Configuración',
      h('div', { className: 'fila' }, ['referencia', 'propia'].map(t =>
        h('button', { 'aria-pressed': String(c.tipo === t), onclick: () => elegir(t) }, t === 'referencia' ? 'Referencia' : 'Propia'))),
      h('p', {}, fija ? 'Regla exacta del diccionario (solo lectura).' : 'Parámetros editables. Parte de la referencia con l = 2 y tope de estancia 30.'),
      h('div', { className: 'fila' },
        numero('k mínimo', 'k', 5),
        selector('Rango de edad', 'anchoEdad', [[20, '20 años'], [10, '10 años']]),
        selector('Ubicación', 'ubicacion', [['region', 'Región'], ['provincia', 'Provincia']]),
        selector('Fecha', 'fecha', [['mes', 'Año y mes'], ['anio', 'Año']]),
        numero('Diversidad l (1 = no aplica)', 'l', 1),
        numero('Tope de estancia (vacío = sin tope)', 'topeEstancia', 1)),
      errores.map(e => h('p', { className: 'mal' }, '✗ ' + e)),
      h('p', {}, h('button', { className: 'principal', disabled: errores.length > 0, onclick: () => intentar(() => {
        S.r = ejecutar(S.cohorte, S.config, S.datos.nombreOriginal);
        S.historial[S.config.tipo] = S.r;
        pta.okRiesgo = pta.okTitular = false;
        paso = 2;
      }) }, 'Anonimizar y medir'))),
    tarjeta('Las 28 variables', tabla(['Columna', 'Clasificación', 'Art. 25', '¿Pedida?', 'Técnica', 'Parámetro'],
      plan(c).map(v => [v.nombre, v.clasificacion, v.categoria || '—', v.solicitada, v.tecnica, v.parametro || '—']))),
  ];
}

function vistaResultados() {
  const r = S.r, a = r.antes, d = r.despues;
  const fallas = r.verificaciones.filter(v => !v.ok).map(v => `${v.id} ${v.texto}`);
  const { referencia, propia } = S.historial;
  const resumen = x => [num(x.despues.personas), x.despues.kMin, pct(x.conservadas),
    `${pct(x.consulta.maximo)} / ${pct(x.consulta.promedio)}`, x.despues.homogeneos.length];
  return [
    !r.cohorte.esEstudio && h('div', { className: 'banda mal' }, `EXPLORACIÓN con el filtro ${r.cohorte.etiquetaFiltro}: no es la cohorte del estudio y no se puede entregar.`),
    h('div', { className: 'banda ' + (r.apto ? 'ok' : 'mal') },
      r.apto ? `✓ APTO según los controles medidos (no significa riesgo cero) · Configuración ${r.config.tipo.toUpperCase()}`
        : `✗ NO APTO · ${fallas.join('; ')}`),
    tarjeta('Antes y después', tabla(['Indicador', 'Antes', 'Después'], [
      ['Personas', num(a.personas), num(d.personas)],
      ['Atenciones', num(a.atenciones), num(d.atenciones)],
      ['k mínimo (meta: 5 o más)', marca(a.kMin >= 5, a.kMin), marca(d.kMin >= 5, d.kMin)],
      ['Personas únicas (meta: 0 %)', marca(a.pctUnicas === 0, pct(a.pctUnicas)), marca(d.pctUnicas === 0, pct(d.pctUnicas))],
      ['Identificadores (meta: 0)',
        marca(a.identificadores.columnas + a.identificadores.texto === 0, ident(a.identificadores)),
        marca(d.identificadores.columnas + d.identificadores.texto === 0, ident(d.identificadores))],
      ['Personas conservadas', '100 %', pct(r.conservadas)],
      ['Cambio en la consulta: máximo / promedio', '—', `${pct(r.consulta.maximo)} / ${pct(r.consulta.promedio)}`]])),
    tarjeta('Consulta del estudio: personas por región y sexo',
      tabla(['Región · sexo', 'Antes', 'Después', 'Diferencia'],
        r.consulta.celdas.map(c => [c.celda, num(c.antes), num(c.despues), pct(c.cambio)]))),
    tarjeta(`Grupos homogéneos en la salida: ${d.homogeneos.length}`,
      h('p', {}, 'Solo para el operador; no se envía al investigador.'),
      d.homogeneos.length
        ? tabla(['Combinación', 'Personas', 'Diagnóstico'], d.homogeneos.map(g => [`⚠ ${g.combinacion}`, g.personas, `${g.diagnostico} · ${nombreCIE10(g.diagnostico)}`]))
        : h('p', { className: 'ok' }, '✓ No se detectaron.')),
    tarjeta('Controles', tabla(['Control', 'Cantidad'], [
      ['Atenciones excluidas por menor de 18 (entre las del capítulo F)', num(r.cohorte.excluidas.menor)],
      ['Personas en el grupo 80+ en la salida', num(new Set(r.salida.filter(f => f.grupo_edad === '80+').map(f => f.id_paciente_estudio)).size)],
      ...r.recorrido.filter(o => o.operacion.startsWith('Supresión'))
        .map(o => [`Personas retiradas: ${o.operacion.toLowerCase()} (vuelta ${o.vuelta})`, num(o.personasAntes - o.personasDespues)]),
      ['Celdas de texto con identificador antes', a.identificadores.texto]])),
    referencia && propia && tarjeta('Comparación',
      tabla(['Configuración', 'Personas', 'k', 'Conservadas', 'Cambio máx. / prom.', 'Homogéneos'],
        [['Referencia', ...resumen(referencia)], ['Propia', ...resumen(propia)]])),
  ];
}

function vistaTrazabilidad() {
  const r = S.r;
  const pestanas = [['recorrido', 'Recorrido'], ['columnas', 'Por columna'], ['verificaciones', 'Verificaciones']];
  const cuerpo = {
    recorrido: () => tabla(['#', 'Operación', 'Regla', 'Vuelta', 'Personas', 'Atenciones', 'k', 'Homogéneos'],
      r.recorrido.map((o, i) => [i + 1, o.operacion, o.regla, o.vuelta ?? '—',
        `${o.personasAntes ?? '—'} → ${o.personasDespues}`, `${o.atencionesAntes} → ${o.atencionesDespues}`,
        o.kAntes === undefined ? '—' : `${o.kAntes} → ${o.kDespues}`,
        o.homogeneosAntes === undefined ? '—' : `${o.homogeneosAntes} → ${o.homogeneosDespues}`])),
    columnas: () => tabla(['Entrada', 'Técnica', 'Parámetro', 'Salida', 'Modificados', 'Distintos', 'Justificación', 'Estado'],
      r.traza.map(t => [t.columna_entrada, t.tecnica, t.parametro || '—', t.columna_salida,
        num(t.valores_modificados), `${num(t.distintos_antes)} → ${num(t.distintos_despues)}`, t.justificacion, t.estado])),
    verificaciones: () => tabla(['ID', 'Comprobación', 'Resultado'],
      r.verificaciones.map(v => [v.id, v.texto, marca(v.ok, v.ok ? 'Correcta' : 'Falló')])),
  };
  return [tarjeta(`Ejecución ${r.id}`,
    h('div', { className: 'fila' }, pestanas.map(([id, t]) =>
      h('button', { 'aria-pressed': String(pestana === id), onclick: () => { pestana = id; pintar(); } }, t))),
    cuerpo[pestana]())];
}

function descargar(nombre, contenido, tipo) {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  const enlace = h('a', { href: url, download: nombre });
  document.body.append(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

// Cada requisito por separado, para que se vea cuál falta.
const requisitos = () => [
  ['La cohorte es la que pide el estudio (capítulo F completo)', !!S.r?.cohorte.esEstudio],
  ['La ejecución es APTA', !!S.r?.apto],
  ['Número de equipo de 2 dígitos', /^\d{2}$/.test(pta.equipo)],
  ['Supuesto sobre el atacante escrito', pta.atacante.trim() !== ''],
  ['Canal para ejercer derechos escrito', pta.canal.trim() !== ''],
  ['Sección 5 con texto y marcada como revisada', pta.riesgo.trim() !== '' && pta.okRiesgo],
  ['Sección 6 con texto y marcada como revisada', pta.titular.trim() !== '' && pta.okTitular],
];
const entregaLista = () => requisitos().every(([, ok]) => ok);

async function paquete() {
  const r = S.r, base = `R2_Equipo${pta.equipo}`;
  const csv = aCSV(r.columnas, r.salida), config = configuracionJSON(r);
  const traza = await trazabilidadJSON(r, await sha256(csv), await sha256(config));
  return {
    base,
    archivos: {
      csv: [base + '_salida.csv', csv, 'text/csv;charset=utf-8'],
      config: [base + '_configuracion.json', config, 'application/json'],
      traza: [base + '_trazabilidad.json', traza, 'application/json'],
      pta: [base + '_PTA.html', ptaHTML(r, pta), 'text/html;charset=utf-8'],
    },
  };
}

async function descargarEntrega(cual) {
  if (!entregaLista()) return;
  const { base, archivos } = await paquete();
  if (cual === 'zip') {
    descargar(base + '_paquete.zip', zip(Object.values(archivos).map(([n, c]) => [n, c])), 'application/zip');
  } else descargar(...archivos[cual]);
}

function vistaEntregar() {
  const botones = [['zip', 'paquete completo (ZIP)'], ['csv', 'CSV'], ['config', 'configuración'], ['traza', 'trazabilidad'], ['pta', 'PTA']]
    .map(([id, t]) => h('button', { className: id === 'zip' ? 'principal' : '', onclick: () => {
      mostrarError('');
      descargarEntrega(id).catch(e => mostrarError('No se pudo descargar: ' + e.message));
    } }, 'Descargar ' + t));
  const lista = h('ul', {});
  const motivo = h('p', { role: 'status' });
  const actualizar = () => {
    botones.forEach(b => { b.disabled = !entregaLista(); });
    lista.replaceChildren(...requisitos().map(([texto, ok]) => h('li', {}, marca(ok, texto))));
    motivo.textContent = entregaLista()
      ? 'Listo para descargar. Para obtener el PDF, abra el PTA y use Imprimir.'
      : 'Bloqueado: complete los puntos marcados con ✗.';
  };
  const casillas = {};
  const desmarcar = ok => { pta[ok] = false; if (casillas[ok]) casillas[ok].checked = false; };
  const campo = (etiqueta, claveC, ok, ejemplo) => h('label', {}, etiqueta,
    h('input', { value: pta[claveC], size: 60, placeholder: ejemplo,
      oninput: e => { pta[claveC] = e.target.value; desmarcar(ok); actualizar(); } }));
  const seccion = (titulo, claveC, ok, extra) => {
    casillas[ok] = h('input', { type: 'checkbox', checked: pta[ok], onchange: e => { pta[ok] = e.target.checked; actualizar(); } });
    return tarjeta(titulo,
      h('div', { className: 'fila' }, extra),
      h('textarea', { value: pta[claveC], readOnly: true, 'aria-label': titulo + ' (solo lectura)' }),
      h('label', {}, casillas[ok], ' Texto revisado por el equipo'));
  };
  const vista = [
    S.r.config.tipo === 'referencia' && h('div', { className: 'banda mal' },
      'Está exportando la REFERENCIA. Para el entregable se propone usar la configuración propia.'),
    tarjeta('PTA', h('label', {}, 'Número de equipo (ej. 07): ',
      h('input', { value: pta.equipo, maxLength: 3, size: 4, inputMode: 'numeric',
        oninput: e => { pta.equipo = e.target.value.trim(); actualizar(); } })),
    h('p', {}, 'Las secciones 1 a 4 se llenan con las métricas medidas.')),
    seccion('5. Riesgo residual y mitigación', 'riesgo', 'okRiesgo',
      campo('Supuesto sobre quién podría intentar reidentificar', 'atacante', 'okRiesgo', 'Escriba el supuesto del equipo')),
    seccion('6. Resumen para el titular', 'titular', 'okTitular',
      campo('Canal para ejercer derechos', 'canal', 'okTitular', 'Escriba el canal confirmado con la organización')),
    tarjeta('Paquete de la ejecución ' + S.r.id + ' (' + S.r.config.tipo + ')',
      lista, h('div', { className: 'fila' }, botones), motivo,
      h('p', {}, 'Condiciones de uso: solo para este estudio, sin reidentificar ni cruzar fuentes; publicar solo agregados. Guarde las descargas fuera de la carpeta del proyecto: Live Server puede recargar la página y borrar lo cargado.')),
  ];
  actualizar();
  return vista;
}

function pintar() {
  if (!habilitado(paso)) paso = 0;
  document.getElementById('estado').textContent = S.r
    ? `${S.r.apto ? 'APTO' : 'NO APTO'} · Configuración ${S.r.config.tipo} · ${S.r.id}`
    : S.cohorte ? 'Cohorte lista · sin resultados vigentes' : S.datos ? 'Archivo cargado' : 'Sin datos';
  document.getElementById('pasos').replaceChildren(...PASOS.map((t, i) =>
    h('button', { disabled: !habilitado(i), 'aria-current': String(i === paso), onclick: () => ir(i) }, t)));
  const vistas = [vistaCargar, vistaConfigurar, vistaResultados, vistaTrazabilidad, vistaEntregar];
  document.getElementById('contenido').replaceChildren(...vistas[paso]().flat().filter(Boolean));
}

pintar();
