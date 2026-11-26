// Panel en una sola vista. Los datos viven solo en memoria.
import { REFERENCIA, PROPIA } from '../motor/config.js';
import { leer, extraerCohorte, contadorPorFiltro, medir, ejecutar, plan, validarConfig, ANCHO_EDAD, gruposDeEdad } from '../motor/motor.js';
import { aCSV } from '../motor/csv.js';
import { zip } from '../motor/zip.js';
import { CAPITULOS, bloquesDe, categoriasDe, FILTRO_ESTUDIO, esDelEstudio, nombreCIE10,
  periodo, etiquetaPeriodo, anioActual, PERIODO_MINIMO } from '../motor/cie10.js';
import { num, pct, ident, sha256, configuracionJSON, trazabilidadJSON, ptaHTML,
  BORRADOR_RIESGO, BORRADOR_TITULAR, ACUERDO, acuerdoTexto } from '../motor/entregables.js';
import { crearRegistro, entradaDeEjecucion, resumenRegistro } from '../motor/registro.js';
import { h, boton, tabla, tablaAdaptable, etiqueta, aviso, detalle, tablaConBusqueda, confirmar, notificar, cerrarNotificaciones } from './dom.js';

const sinResultados = () => ({ r: null, historial: {} });
const inicial = () => ({
  datos: null, archivo: '', cohorte: null, antes: null, ...sinResultados(),
  config: { ...REFERENCIA }, propia: { ...PROPIA }, filtro: { ...FILTRO_ESTUDIO },
  deshacer: null, desactualizado: false,
});
const ptaInicial = () => ({
  equipo: '', riesgo: BORRADOR_RIESGO, titular: BORRADOR_TITULAR, atacante: '', canal: '', okRiesgo: false, okTitular: false,
  acuerdoEn: '', // fecha en que se marcó el acuerdo; vacío = no aceptado
});
let S = inicial();
const pta = ptaInicial();
let pestana = 'recorrido', ocupado = false;
// La página principal es el tablero; el proceso de 5 pasos se abre desde ahí.
let vista = 'tablero';
const registro = crearRegistro();

const $ = id => document.getElementById(id);

// ---------- Errores y acciones largas ----------
// Cada error explica cómo recuperarse.
const SOLUCIONES = [
  [/UTF-8/, 'Guarde el archivo como CSV UTF-8, separado por comas, y vuelva a elegirlo.'],
  [/Faltan columnas|sin clasificar|repetidas/, 'Use un archivo con las 28 columnas del diccionario, sin cambiar sus nombres.'],
  [/Filas inválidas|comilla/, 'Corrija esas filas en el archivo original y vuelva a cargarlo.'],
  [/vacía|vacío|no tiene filas/, 'Revise que sea el archivo correcto y que el filtro de diagnóstico sea el del estudio.'],
  [/provincia/, 'Corrija la columna provincia usando los nombres de las 24 provincias.'],
  [/digest|subtle/, 'Abra la página con la dirección 127.0.0.1 de Live Server, no con una IP de la red.'],
];

// Los errores se muestran como aviso rojo arriba a la derecha, con la causa y qué hacer.
function mostrarError(mensaje) {
  cerrarNotificaciones('mal');
  if (!mensaje) return;
  const solucion = SOLUCIONES.find(([patron]) => patron.test(mensaje))?.[1] ?? 'Revise el último paso e inténtelo de nuevo.';
  notificar('mal', h('p', {}, h('strong', {}, 'No se pudo completar. '), mensaje), h('p', {}, h('strong', {}, 'Qué hacer: '), solucion));
}

const MENSAJE_DESACTUALIZADO = 'Cambió la configuración. Vuelva a proteger los datos para ver resultados y descargar.';

function trabajar(mensaje, fn, destino) {
  if (ocupado) return;
  ocupado = true;
  mostrarError('');
  $('ocupado').textContent = mensaje + ' ⏳';
  $('ocupado').hidden = false;
  setTimeout(async () => { // deja pintar el indicador antes del cálculo
    let bien = false;
    try { await fn(); bien = true; } catch (e) { mostrarError(e.message); }
    ocupado = false;
    $('ocupado').hidden = true;
    pintar();
    if (bien && destino) irA(destino);
  }, 30);
}

function irA(id) {
  verVista(id === 'tablero' ? 'tablero' : 'proceso');
  const seccion = $(id);
  seccion?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  $(id + '-h')?.focus?.({ preventScroll: true });
}

async function sePuedeDescartar(accion) {
  if (!S.r && !Object.keys(S.historial).length) return true;
  return confirmar('Se descartarán los resultados',
    `Al ${accion} se borran los resultados de esta sesión. Las descargas ya guardadas no cambian.`, 'Descartar y continuar');
}

function limpiarRevision() { pta.okRiesgo = pta.okTitular = false; pta.acuerdoEn = ''; }

// ---------- 1. Datos ----------
async function cargar(entrada) {
  const archivo = entrada.files[0];
  if (!archivo) return;
  if (!await sePuedeDescartar('cargar otro archivo')) { entrada.value = ''; return; }
  trabajar('Leyendo y validando el archivo…', async () => {
    let texto;
    try { texto = new TextDecoder('utf-8', { fatal: true }).decode(await archivo.arrayBuffer()); }
    catch { throw new Error('El archivo no se pudo leer como UTF-8.'); }
    const datos = leer(texto); // si falla, se conserva lo anterior
    S = { ...inicial(), datos, archivo: archivo.name };
    Object.assign(pta, ptaInicial());
    notificar('ok', `Archivo válido: ${num(datos.filas.length)} atenciones de ${num(datos.personas)} personas.`);
  });
}

async function empezarDeNuevo() {
  if (!await confirmar('Empezar de nuevo', 'Se borra de la memoria el archivo, los resultados y los textos escritos.', 'Borrar todo')) return;
  S = inicial();
  Object.assign(pta, ptaInicial());
  mostrarError('');
  pintar();
  notificar('ok', 'Se borró de la memoria el archivo, los resultados y los textos escritos.');
  irA('datos');
}

async function cambiarFiltro(nuevo) {
  if (!await sePuedeDescartar('cambiar el filtro')) { pintar(); return; }
  Object.assign(S, sinResultados(), { filtro: nuevo, cohorte: null, antes: null, deshacer: null, desactualizado: false });
  limpiarRevision();
  pintar();
  notificar('ok', `Filtro actualizado: ${num(S.contar ? S.contar(nuevo) : 0)} personas con este filtro.`);
}

function filtroCIE10() {
  const f = S.filtro;
  const selector = (texto, id, valor, opciones, alCambiar, desactivado) => h('label', {}, texto,
    h('select', { id, disabled: desactivado, onchange: e => alCambiar(e.target.value) },
      opciones.map(([v, t, n]) => h('option', { value: v, selected: v === valor, disabled: n === 0 && v !== valor },
        `${t} — ${n ? num(n) + ' personas' : 'sin datos'}`))));
  const esF = f.capitulo === 'V';
  // Se calcula una vez por archivo; las opciones sin datos no se pueden elegir.
  S.contar ??= contadorPorFiltro(S.datos.filas);
  const con = (t, v, filtro) => [v, t, S.contar(filtro)];
  // Grupo y categoría dependen del capítulo elegido (y la categoría, del grupo).
  const capitulo = f.capitulo;
  const categorias = categoriasDe(capitulo, f.bloque, S.contar.codigos);
  // El periodo se conserva al cambiar capítulo, grupo o categoría.
  const p = periodo(f);
  const anios = [];
  for (let a = anioActual(); a >= PERIODO_MINIMO; a--) anios.push(a);
  // Solo se ofrecen años válidos: el inicio nunca queda después del fin.
  const selectorAnio = (texto, id, valor, valido, alCambiar) => h('label', {}, texto,
    h('select', { id, onchange: e => alCambiar(Number(e.target.value)) },
      anios.map(a => h('option', { value: a, selected: a === valor, disabled: !valido(a) }, String(a)))));
  return detalle('filtro', `Filtro de diagnóstico y periodo: ${esDelEstudio(f) ? 'el que pide el estudio (salud mental, 2023-2025)' : 'personalizado (solo exploración)'}`,
    h('p', {}, 'CIE-10 es el catálogo internacional de enfermedades. El estudio pide todo el capítulo V (códigos que empiezan con F) y atenciones de 2023 a 2025.'),
    h('div', { className: 'fila' },
      selector('Capítulo', 'f-capitulo', capitulo,
        CAPITULOS.map(c => con(`${c.id} · ${c.desde}-${c.hasta} · ${c.nombre}`, c.id, { capitulo: c.id, bloque: '', categoria: '', ...p })),
        v => cambiarFiltro({ capitulo: v, bloque: '', categoria: '', ...p })),
      selector('Grupo', 'f-grupo', f.bloque,
        [con('Todos', '', { capitulo, bloque: '', categoria: '', ...p }),
          ...bloquesDe(capitulo).map(b => con(`${b.id} · ${b.nombre}`, b.id, { capitulo, bloque: b.id, categoria: '', ...p }))],
        v => cambiarFiltro({ capitulo, bloque: v, categoria: '', ...p })),
      selector('Categoría', 'f-categoria', f.categoria,
        [con('Todas', '', { ...f, categoria: '' }),
          ...categorias.map(([c, n]) => con(esF ? `${c} · ${n}` : `${c} · grupo: ${n}`, c, { ...f, categoria: c }))],
        v => cambiarFiltro({ ...f, categoria: v }))),
    h('fieldset', { className: 'periodo' }, h('legend', {}, `Periodo de atención (fecha de ingreso) · ${num(S.contar(f))} personas`),
      h('div', { className: 'fila' },
        selectorAnio('Desde el año', 'f-desde', p.desde, a => a <= p.hasta, v => cambiarFiltro({ ...f, desde: v })),
        selectorAnio('Hasta el año', 'f-hasta', p.hasta, a => a >= p.desde, v => cambiarFiltro({ ...f, hasta: v }))),
      h('p', { className: 'nota' }, `Años entre ${PERIODO_MINIMO} y ${anioActual()}. Puede ser un solo año (inicio igual al fin). Incluye del 1 de enero del año de inicio al 31 de diciembre del año de fin.`)),
    h('p', { className: 'nota' }, `Los conteos ya consideran 18 años o más y atenciones de ${etiquetaPeriodo(f)}. «Sin datos» significa que este archivo no tiene casos que cumplan.`
      + (esF ? '' : ' Fuera del capítulo V, la lista de categorías muestra los códigos presentes en este archivo.')),
    !esDelEstudio(f) && boton('Volver al filtro del estudio', () => cambiarFiltro({ ...FILTRO_ESTUDIO })));
}

function panelDatos() {
  const c = S.cohorte, d = S.datos;
  return [
    h('label', { className: 'archivo' }, d ? 'Cambiar archivo (CSV)' : 'Elija el archivo CSV de atenciones',
      h('input', { type: 'file', id: 'archivo', accept: '.csv', onchange: e => cargar(e.target) })),
    h('p', { className: 'nota' }, 'El archivo se procesa en este equipo; la aplicación no lo envía a ningún servidor.'),
    d && aviso('ok', `«${S.archivo}» es válido: ${num(d.filas.length)} atenciones de ${num(d.personas)} personas.`),
    d && d.avisos.map(a => h('p', { className: 'nota' }, 'Nota: ' + a)),
    d && filtroCIE10(),
    d && !c && boton('Extraer las personas del estudio', () => trabajar('Extrayendo la cohorte y midiendo el riesgo inicial…', () => {
      const cohorte = extraerCohorte(S.datos.filas, S.filtro);
      if (!cohorte.atenciones) throw new Error('La cohorte está vacía.');
      S.cohorte = cohorte;
      S.antes = medir(cohorte.filas, 'cedula');
      notificar('ok', `Cohorte lista: ${num(cohorte.personas)} personas y ${num(cohorte.atenciones)} atenciones.`);
    }), { className: 'principal' }),
    c && !c.esEstudio && aviso('aviso', 'Modo exploración: no es la cohorte del estudio. Puede medirla, pero no entregarla.'),
    c && h('div', { className: 'indicadores' },
      indicador('Personas seleccionadas', num(c.personas), 'Es la «cohorte» del estudio'),
      indicador('Atenciones', num(c.atenciones), 'Una persona puede tener varias'),
      indicador('Grupo más pequeño (k)', S.antes.kMin, 'Antes de proteger. Meta: 5 o más', S.antes.kMin >= 5),
      indicador('Personas únicas', pct(S.antes.pctUnicas), 'Se distinguen de todas las demás', S.antes.pctUnicas === 0)),
    c && detalle('exclusiones', 'Ver por qué se excluyeron atenciones', tabla(['Concepto', 'Atenciones'], [
      ['Atenciones en el archivo', num(c.entrada)],
      [`− Diagnóstico fuera del filtro (${c.etiquetaFiltro})`, num(c.excluidas.diagnostico)],
      ['− Menor de 18 años en la fecha de atención', num(c.excluidas.menor)],
      [`− Fuera del periodo ${c.periodo}`, num(c.excluidas.periodo)],
      ['= Atenciones en la cohorte', num(c.atenciones)]]),
    h('p', {}, `Identificadores presentes ahora: ${ident(S.antes.identificadores)}.`)),
  ];
}

function indicador(nombre, valor, explicacion, cumple) {
  return h('div', { className: 'indicador' + (cumple === undefined ? '' : cumple ? ' ok' : ' mal') },
    h('span', {}, nombre), h('b', {}, valor),
    h('small', {}, cumple === undefined ? explicacion : `${cumple ? 'Cumple ✓' : 'No cumple ✗'}. ${explicacion}`));
}

// ---------- 2. Protección ----------
function guardarParaDeshacer() {
  S.deshacer = {
    config: { ...S.config }, propia: { ...S.propia }, r: S.r, historial: { ...S.historial }, desactualizado: S.desactualizado,
  };
}

function cambiar(clave, valor) {
  guardarParaDeshacer();
  S.config = { ...S.config, [clave]: valor };
  S.propia = { ...S.config };
  S.desactualizado = !!(S.r || S.desactualizado);
  S.r = null;
  delete S.historial.propia;
  limpiarRevision();
  pintar();
  if (S.desactualizado) notificar('aviso', MENSAJE_DESACTUALIZADO);
  else notificar('ok', 'Configuración actualizada.');
}

function elegirModo(tipo) {
  if (S.config.tipo === tipo) return;
  S.config = tipo === 'referencia' ? { ...REFERENCIA } : { ...S.propia };
  S.r = S.historial[tipo] ?? null;
  S.desactualizado = false;
  S.deshacer = null;
  limpiarRevision();
  pintar();
  notificar('ok', `Configuración ${tipo === 'referencia' ? 'Referencia' : 'Propia'} seleccionada.`);
}

function anonimizar() {
  const solicitadoEn = new Date().toISOString(); // momento en que el operador pide la anonimización
  trabajar('Protegiendo los datos y midiendo el resultado…', () => {
    S.r = ejecutar(S.cohorte, S.config, S.datos.nombreOriginal);
    registro.agregar(entradaDeEjecucion(S.r, { archivo: S.archivo, solicitadoEn }));
    S.historial[S.config.tipo] = S.r;
    S.desactualizado = false;
    S.deshacer = null;
    limpiarRevision();
    if (S.r.apto) notificar('ok', 'La ejecución es APTA. Los resultados están listos.');
    else notificar('mal', 'La ejecución NO es apta: ' + S.r.verificaciones.filter(v => !v.ok).map(v => v.id).join(', ') + '.');
  }, 'resultados');
}

function panelProteccion() {
  if (!S.cohorte) return [bloqueo('Primero cargue un archivo y extraiga las personas del estudio.', 'datos')];
  const c = S.config, fija = c.tipo === 'referencia';
  const opcion = (tipo, titulo, texto) => h('label', { className: 'opcion' + (c.tipo === tipo ? ' elegida' : '') },
    h('input', { type: 'radio', name: 'modo', id: 'modo-' + tipo, checked: c.tipo === tipo, onchange: () => elegirModo(tipo) }),
    h('span', {}, h('strong', {}, titulo), h('small', {}, texto)));
  // Solo listas de valores válidos: no se puede escribir un parámetro incorrecto.
  const selector = (texto, clave, opciones, ayuda) => h('label', {}, texto,
    h('select', { id: 'p-' + clave, disabled: fija,
      onchange: e => cambiar(clave, opciones.find(o => String(o[0]) === e.target.value)[0]) },
    opciones.map(([v, t]) => h('option', { value: String(v), selected: c[clave] === v }, t))),
    h('small', {}, ayuda));
  // Contador con disminuir / aumentar; el valor siempre queda dentro de [min, max].
  const contador = (texto, clave, { min, max, unidad }, ayuda) => {
    const valor = c[clave];
    const fijar = v => { const n = Math.round(Number(v)); if (Number.isFinite(n) && n !== valor) cambiar(clave, Math.min(max, Math.max(min, n))); else pintar(); };
    return h('div', { className: 'campo' },
      h('span', { id: `p-${clave}-etiqueta`, className: 'etiqueta-campo' }, texto),
      h('div', { className: 'contador', role: 'group', 'aria-labelledby': `p-${clave}-etiqueta` },
        boton('−', () => fijar(valor - 1), { id: `p-${clave}-menos`, 'aria-label': `Disminuir ${texto.toLowerCase()}`, disabled: fija || valor <= min }),
        h('input', { type: 'number', id: 'p-' + clave, min, max, step: 1, value: valor, disabled: fija, inputMode: 'numeric',
          'aria-label': `${texto} en ${unidad}`, onchange: e => fijar(e.target.value) }),
        h('span', { className: 'unidad' }, unidad),
        boton('+', () => fijar(valor + 1), { id: `p-${clave}-mas`, 'aria-label': `Aumentar ${texto.toLowerCase()}`, disabled: fija || valor >= max })),
      h('small', {}, ayuda));
  };
  const variables = plan(c);
  const errores = validarConfig(c);
  return [
    h('fieldset', { className: 'opciones' }, h('legend', {}, 'Elija una forma de proteger'),
      opcion('referencia', 'Referencia', 'Las reglas oficiales. Sirve para la verificación del jurado.'),
      opcion('propia', 'Propia (para entregar)', 'Añade protección del diagnóstico y oculta estancias muy largas.')),
    detalle('parametros', fija ? 'Ver los parámetros (fijos en la referencia)' : 'Ajustar parámetros',
      h('div', { className: 'fila' },
        selector('Grupo mínimo (k)', 'k', [5, 6, 8, 10, 15].map(n => [n, `${n} personas`]), 'Cada persona se confunde con otras. Más alto protege más.'),
        contador('Ancho de los rangos de edad', 'anchoEdad', { ...ANCHO_EDAD, unidad: 'años' },
          `Más años protegen más; menos dan más detalle. Entre ${ANCHO_EDAD.min} y ${ANCHO_EDAD.max}. Grupos: ${gruposDeEdad(c.anchoEdad).join(' · ')}`),
        selector('Ubicación', 'ubicacion', [['region', 'Región'], ['provincia', 'Provincia']], 'Región agrupa a más personas.'),
        selector('Fecha', 'fecha', [['mes', 'Año y mes'], ['anio', 'Solo año']], 'El estudio pide año y mes.'),
        selector('Diagnósticos distintos por grupo (l)', 'l', [[1, 'No exigir'], [2, 'Al menos 2'], [3, 'Al menos 3']], 'Evita deducir la enfermedad de un grupo.'),
        selector('Estancias largas', 'topeEstancia', [[null, 'Mostrar exactas'], [15, '15 días o más juntas'], [30, '30 días o más juntas'], [60, '60 días o más juntas']], 'Evita que un valor raro señale a alguien.')),
      !fija && boton('Restablecer valores recomendados', () => {
        guardarParaDeshacer();
        S.config = { ...PROPIA }; S.propia = { ...PROPIA }; S.r = null; delete S.historial.propia;
        S.desactualizado = true; limpiarRevision(); pintar();
        notificar('aviso', MENSAJE_DESACTUALIZADO);
      })),
    detalle('variables', 'Ver qué pasa con cada una de las 28 columnas',
      tablaConBusqueda('variables', ['Columna', 'Qué es', 'Categoría especial', '¿La pide el estudio?', 'Qué se hace', 'Cómo'],
        variables.map(v => [v.nombre, v.clasificacion, v.categoria || '—', v.solicitada, v.tecnica, v.parametro || '—']))),
    errores.map(e => aviso('mal', e)),
    h('div', { className: 'acciones' },
      boton(S.r ? 'Volver a proteger y medir' : 'Proteger los datos y medir', anonimizar,
        { className: 'principal', id: 'anonimizar', disabled: errores.length > 0 }),
      S.deshacer && boton('Deshacer el último cambio ↶', () => {
        Object.assign(S, S.deshacer, { deshacer: null });
        limpiarRevision(); pintar();
        notificar('ok', 'Se deshizo el último cambio.');
      })),
  ];
}

// ---------- 3. Resultados ----------
function panelResultados() {
  if (!S.r) return [bloqueo(S.desactualizado ? 'Los resultados anteriores quedaron desactualizados.' : 'Todavía no se han protegido los datos.', 'proteccion')];
  const r = S.r, a = r.antes, d = r.despues;
  const fallas = r.verificaciones.filter(v => !v.ok);
  const sinIdent = x => x.identificadores.columnas + x.identificadores.texto === 0;
  const { referencia, propia } = S.historial;
  const resumen = x => [num(x.despues.personas), x.despues.kMin, pct(x.conservadas),
    `${pct(x.consulta.maximo)} / ${pct(x.consulta.promedio)}`, x.despues.homogeneos.length];
  return [
    !r.cohorte.esEstudio && aviso('aviso', `Exploración con ${r.cohorte.etiquetaFiltro}: no se puede entregar.`),
    h('div', { className: 'veredicto ' + (r.apto ? 'ok' : 'mal') },
      h('strong', {}, r.apto ? 'APTO para continuar ✓' : 'NO APTO ✗'),
      h('span', {}, r.apto ? `Pasó los controles medidos con la configuración ${r.config.tipo}. No significa riesgo cero.`
        : 'Falló: ' + fallas.map(v => `${v.id} ${v.texto}`).join('; ') + '. Cambie la configuración y vuelva a medir.')),
    h('div', { className: 'indicadores' },
      indicador('Grupo más pequeño (k)', d.kMin, `Antes: ${a.kMin}. Meta: 5 o más`, d.kMin >= 5),
      indicador('Personas únicas', pct(d.pctUnicas), `Antes: ${pct(a.pctUnicas)}. Meta: 0 %`, d.pctUnicas === 0 && d.personas > 0),
      indicador('Identificadores detectados', d.identificadores.columnas + d.identificadores.texto, `Antes: ${ident(a.identificadores)}`, sinIdent(d)),
      indicador('Personas conservadas', pct(r.conservadas), `${num(d.personas)} de ${num(a.personas)}. Mide utilidad`)),
    d.homogeneos.length > 0 && aviso('aviso', `${d.homogeneos.length} grupo(s) comparten un solo diagnóstico: se podría deducir.`),
    h('h3', {}, 'Antes y después (tabla para el jurado)'),
    tabla(['Indicador', 'Antes', 'Después'], [
      ['Personas', num(a.personas), num(d.personas)],
      ['Atenciones', num(a.atenciones), num(d.atenciones)],
      ['Grupo más pequeño, k (meta: 5 o más)', a.kMin, d.kMin],
      ['Personas únicas (meta: 0 %)', pct(a.pctUnicas), pct(d.pctUnicas)],
      ['Identificadores que quedan (meta: 0)', ident(a.identificadores), ident(d.identificadores)],
      ['Personas conservadas', '100 %', pct(r.conservadas)],
      ['Cambio en la consulta del estudio: máximo / promedio', '—', `${pct(r.consulta.maximo)} / ${pct(r.consulta.promedio)}`]]),
    referencia && propia && [h('h3', {}, 'Comparación de configuraciones'),
      tabla(['Configuración', 'Personas', 'k', 'Conservadas', 'Cambio máx. / prom.', 'Grupos con 1 diagnóstico'],
        [['Referencia', ...resumen(referencia)], ['Propia', ...resumen(propia)]])],
    detalle('consulta', 'Ver personas por región y sexo (consulta del estudio)',
      tabla(['Región · sexo', 'Antes', 'Después', 'Diferencia'],
        r.consulta.celdas.map(c => [c.celda, num(c.antes), num(c.despues), pct(c.cambio)]))),
    detalle('homogeneos', `Ver grupos con un solo diagnóstico (${d.homogeneos.length})`,
      h('p', { className: 'nota' }, 'Información solo para el operador. No se envía al investigador.'),
      d.homogeneos.length
        ? tabla(['Grupo', 'Personas', 'Diagnóstico'], d.homogeneos.map(g => [g.combinacion, g.personas, `${g.diagnostico} · ${nombreCIE10(g.diagnostico)}`]))
        : h('p', {}, 'No se detectaron.')),
    detalle('controles', 'Ver controles para los casos especiales',
      tabla(['Control', 'Cantidad'], [
        ['Atenciones excluidas por menor de 18 (dentro del filtro de diagnóstico)', num(r.cohorte.excluidas.menor)],
        ['Personas en el grupo 80+ en la salida', num(new Set(r.salida.filter(f => f.grupo_edad === '80+').map(f => f.id_paciente_estudio)).size)],
        ...r.recorrido.filter(o => o.operacion.startsWith('Supresión'))
          .map(o => [`Personas retiradas: ${o.operacion.toLowerCase()} (vuelta ${o.vuelta})`, num(o.personasAntes - o.personasDespues)]),
        ['Celdas de texto con identificador antes', num(a.identificadores.texto)]])),
    h('p', { className: 'nota' }, 'k no incluye año y mes, tipo de atención, diagnóstico ni estancia. Quien conozca esos datos podría distinguir a una persona.'),
  ];
}

// ---------- 4. Trazabilidad ----------
function panelTraza() {
  if (!S.r) return [bloqueo('El recorrido aparece después de proteger los datos.', 'proteccion')];
  const r = S.r;
  const correctas = r.verificaciones.filter(v => v.ok).length;
  // Antes y después van en columnas separadas, sin flechas.
  const AD = ['Antes', 'Después'];
  const par = (antes, despues) => (despues === undefined ? ['—', '—'] : [antes ?? '—', despues].map(x => (typeof x === 'number' ? num(x) : x)));
  const vistas = {
    recorrido: ['Paso a paso', () => tablaAdaptable(['#', 'Operación', 'Regla', 'Vuelta',
      { texto: 'Personas', sub: AD }, { texto: 'Atenciones', sub: AD }, { texto: 'k', sub: AD }, { texto: 'Grupos con 1 diagnóstico', sub: AD }],
    r.recorrido.map((o, i) => [i + 1, o.operacion, o.regla, o.vuelta ?? '—',
      ...par(o.personasAntes, o.personasDespues), ...par(o.atencionesAntes, o.atencionesDespues),
      ...par(o.kAntes, o.kDespues), ...par(o.homogeneosAntes, o.homogeneosDespues)]))],
    columnas: ['Por columna', () => tablaConBusqueda('traza',
      ['Columna', 'Qué se hizo', 'Cómo', 'Sale como', 'Celdas cambiadas', { texto: 'Valores distintos', sub: AD }, 'Por qué', 'Estado'],
      r.traza.map(t => [t.columna_entrada, t.tecnica, t.parametro || '—', t.columna_salida,
        num(t.valores_modificados), num(t.distintos_antes), num(t.distintos_despues), t.justificacion, t.estado]),
      undefined, tablaAdaptable)],
    verificaciones: ['Verificaciones', () => tablaAdaptable(['ID', 'Comprobación', 'Resultado'],
      r.verificaciones.map(v => [v.id, v.texto, etiqueta(v.ok ? 'ok' : 'mal', v.ok ? 'Correcta' : 'Falló')]))],
  };
  return [
    aviso(correctas === r.verificaciones.length ? 'ok' : 'mal', `${correctas} de ${r.verificaciones.length} verificaciones correctas.`),
    detalle('traza', 'Detalle de lo que se hizo',
      h('div', { className: 'segmentos', role: 'group', 'aria-label': 'Vista de trazabilidad' },
        Object.entries(vistas).map(([id, [texto]]) => boton(texto, () => { pestana = id; pintar(); },
          { id: 'ver-' + id, 'aria-pressed': String(pestana === id) }))),
      vistas[pestana][1]()),
    h('p', { className: 'nota' }, `Código de esta ejecución: ${r.id}`),
  ];
}

// ---------- 5. Entrega ----------
const requisitos = () => [
  ['La cohorte es la que pide el estudio', !!S.r?.cohorte.esEstudio],
  ['La ejecución es APTA', !!S.r?.apto],
  ['Número de equipo de 2 dígitos', /^\d{2}$/.test(pta.equipo)],
  ['Supuesto sobre quién podría reidentificar, escrito', pta.atacante.trim() !== ''],
  ['Canal para ejercer derechos, escrito', pta.canal.trim() !== ''],
  ['Texto de riesgo residual revisado', pta.okRiesgo],
  ['Resumen para el titular revisado', pta.okTitular],
  ['Acuerdo de confidencialidad aceptado', pta.acuerdoEn !== ''],
];
const entregaLista = () => requisitos().every(([, ok]) => ok);

function descargar(nombre, contenido, tipo) {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  const enlace = h('a', { href: url, download: nombre });
  document.body.append(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

async function descargarEntrega(cual) {
  if (!entregaLista()) throw new Error('Faltan requisitos de entrega.');
  const r = S.r, base = `R2_Equipo${pta.equipo}`, aceptadoEn = pta.acuerdoEn;
  const csv = aCSV(r.columnas, r.salida), config = configuracionJSON(r);
  const archivos = {
    csv: [base + '_salida.csv', csv, 'text/csv;charset=utf-8'],
    config: [base + '_configuracion.json', config, 'application/json'],
    traza: [base + '_trazabilidad.json', await trazabilidadJSON(r, await sha256(csv), await sha256(config), aceptadoEn), 'application/json'],
    pta: [base + '_PTA.html', ptaHTML(r, pta), 'text/html;charset=utf-8'],
  };
  const elegido = cual === 'zip'
    ? [base + '_paquete.zip', zip([...Object.values(archivos).map(([n, c]) => [n, c]),
      [base + '_acuerdo.txt', acuerdoTexto(r.id, aceptadoEn)]]), 'application/zip']
    : archivos[cual];
  descargar(...elegido);
  registro.descarga(r.id, elegido[0]);
  return elegido[0];
}

function panelEntrega() {
  if (!S.r) return [bloqueo('Para entregar primero necesita un resultado vigente.', 'proteccion')];
  const botones = [['zip', 'Descargar todo (ZIP)'], ['csv', 'Solo CSV'], ['config', 'Solo configuración'], ['traza', 'Solo trazabilidad'], ['pta', 'Solo PTA']]
    .map(([id, texto]) => boton(texto, async () => {
      if (!entregaLista()) return;
      mostrarError('');
      try {
        const nombre = await descargarEntrega(id);
        notificar('ok', `Se envió a descargas: ${nombre}.`);
      } catch (e) { mostrarError(e.message); }
    }, { id: 'bajar-' + id, className: id === 'zip' ? 'principal' : 'secundario' }));
  const lista = h('ul', { className: 'requisitos' });
  const motivo = h('p', {});
  const estado = h('div', { role: 'status' });
  const actualizar = () => {
    const faltan = requisitos().filter(([, ok]) => !ok).length;
    botones.forEach(b => { b.disabled = faltan > 0; });
    lista.replaceChildren(...requisitos().map(([texto, ok]) => h('li', {}, etiqueta(ok ? 'ok' : 'mal', ok ? 'Listo' : 'Falta'), ' ', texto)));
    motivo.textContent = faltan ? `Faltan ${faltan} requisito(s) para habilitar la descarga.` : 'Todo listo. Para obtener el PDF, abra el PTA y use Imprimir.';
    pintarNavegacion();
  };
  const casillas = {};
  const escribir = (texto, clave, ok, ejemplo, props = {}) => h('label', {}, texto,
    h('input', { id: 'pta-' + clave, value: pta[clave], placeholder: ejemplo, ...props,
      oninput: e => {
        if (props.inputMode === 'numeric') e.target.value = e.target.value.replace(/\D/g, '').slice(0, 2);
        pta[clave] = e.target.value;
        if (ok) { pta[ok] = false; casillas[ok].checked = false; }
        estado.replaceChildren();
        actualizar();
      } }));
  const seccion = (titulo, clave, ok, campo) => {
    casillas[ok] = h('input', { type: 'checkbox', id: ok, checked: pta[ok], onchange: e => { pta[ok] = e.target.checked; actualizar(); } });
    return h('fieldset', {}, h('legend', {}, titulo), campo,
      h('textarea', { value: pta[clave], readOnly: true, 'aria-label': titulo + ' (solo lectura)' }),
      h('label', { className: 'casilla' }, casillas[ok], ' Leí este texto y el equipo está de acuerdo'));
  };
  const casillaAcuerdo = h('input', { type: 'checkbox', id: 'acuerdo', checked: pta.acuerdoEn !== '',
    onchange: e => {
      pta.acuerdoEn = e.target.checked ? new Date().toISOString() : '';
      estado.replaceChildren();
      actualizar();
    } });
  const acuerdo = h('fieldset', { className: 'acuerdo' }, h('legend', {}, 'Acuerdo de confidencialidad y uso'),
    h('p', {}, 'Los archivos derivan de datos de salud. Para descargar cualquiera de ellos, me comprometo a:'),
    h('ol', {}, ACUERDO.condiciones.map(c => h('li', {}, c))),
    h('label', { className: 'casilla' }, casillaAcuerdo, h('strong', {}, 'He leído y acepto este acuerdo')));
  const vista = [
    S.r.config.tipo === 'referencia' && aviso('aviso', 'Va a exportar la configuración REFERENCIA.',
      boton('Cambiar a Propia', () => { elegirModo('propia'); irA('proteccion'); })),
    escribir('Número de equipo (2 dígitos)', 'equipo', null, 'Ej.: 07', { inputMode: 'numeric', maxLength: 2 }),
    seccion('Riesgo que queda y cómo se reduce', 'riesgo', 'okRiesgo',
      escribir('¿Quién podría intentar reidentificar? (supuesto del equipo)', 'atacante', 'okRiesgo', 'Escriba el supuesto del equipo')),
    seccion('Resumen para la persona titular de los datos', 'titular', 'okTitular',
      escribir('Canal para ejercer derechos', 'canal', 'okTitular', 'Canal confirmado con la organización')),
    acuerdo,
    h('h3', {}, 'Antes de descargar'), lista, motivo,
    h('div', { className: 'acciones' }, botones), estado,
    h('p', { className: 'nota' }, 'Use los datos solo para este estudio, sin reidentificar ni cruzar fuentes. Guarde las descargas fuera de la carpeta del proyecto.'),
  ];
  botones.forEach(b => { b.disabled = !entregaLista(); });
  vista.alMontar = actualizar;
  return vista;
}

// ---------- Estructura del panel ----------
const bloqueo = (mensaje, destino) => h('div', { className: 'vacio' }, h('p', {}, mensaje + ' 🔒'),
  boton('Ir al paso necesario', () => irA(destino)));

const SECCIONES = [
  ['datos', '1. Datos', 'Cargue el archivo y seleccione a las personas del estudio.', panelDatos,
    () => (S.cohorte ? ['ok', 'Listo'] : S.datos ? ['aviso', 'Falta extraer'] : ['neutro', 'Por hacer'])],
  ['proteccion', '2. Protección', 'Decida cómo ocultar la identidad de las personas.', panelProteccion,
    () => (S.r ? ['ok', 'Listo'] : !S.cohorte ? ['neutro', 'Bloqueado'] : S.desactualizado ? ['aviso', 'Volver a medir'] : ['aviso', 'Por hacer'])],
  ['resultados', '3. Resultados', '¿Se puede reconocer a alguien? ¿Los datos siguen siendo útiles?', panelResultados,
    () => (S.r ? (S.r.apto ? ['ok', 'Apto'] : ['mal', 'No apto']) : ['neutro', 'Pendiente'])],
  ['trazabilidad', '4. Trazabilidad', 'Qué se hizo, en qué orden y con qué resultado.', panelTraza,
    () => (S.r ? ['ok', 'Disponible'] : ['neutro', 'Pendiente'])],
  ['entrega', '5. Entrega', 'Revise los textos y descargue los archivos.', panelEntrega,
    () => (!S.r ? ['neutro', 'Bloqueado'] : entregaLista() ? ['ok', 'Lista'] : ['aviso', 'Faltan datos'])],
];

function siguientePaso() {
  if (!S.datos) return ['Elija el archivo CSV.', 'datos'];
  if (!S.cohorte) return ['Extraiga las personas del estudio.', 'datos'];
  if (!S.r) return ['Proteja los datos y mida el resultado.', 'proteccion'];
  if (!S.r.apto) return ['Ajuste la protección: el resultado no es apto.', 'proteccion'];
  if (!S.r.cohorte.esEstudio) return ['Para entregar, vuelva al filtro del estudio.', 'datos'];
  if (!entregaLista()) return ['Revise los resultados y complete la entrega.', 'entrega'];
  return ['Todo listo: descargue el paquete.', 'entrega'];
}

function pintarNavegacion() {
  const [texto, destino] = siguientePaso();
  const hechos = SECCIONES.filter(([, , , , estado]) => estado()[0] === 'ok').length;
  $('progreso').replaceChildren(h('label', {}, `Avance: ${hechos} de ${SECCIONES.length}`,
    h('progress', { max: SECCIONES.length, value: hechos })));
  $('menu').replaceChildren(...SECCIONES.map(([id, titulo, , , estado]) =>
    h('li', {}, h('a', { href: '#' + id, onclick: e => { e.preventDefault(); irA(id); } },
      h('span', {}, titulo), etiqueta(...estado())))));
  $('siguiente').replaceChildren(h('span', {}, h('strong', {}, 'Siguiente paso: '), texto),
    boton('Ir', () => irA(destino), { 'aria-label': 'Ir al siguiente paso' }));
  $('reiniciar').disabled = !S.datos;
}

// ---------- Tablero (página principal) ----------
const fechaHora = iso => (iso ? new Date(iso).toLocaleString('es-EC', { dateStyle: 'medium', timeStyle: 'medium' }) : '—');
const enLinea = objeto => Object.entries(objeto).map(([k, n]) => `${k}: ${n}`).join(' · ') || '—';

function verVista(nueva) {
  if (nueva === 'tablero' && vista !== 'tablero') pintarTablero(); // las descargas no repintan todo
  vista = nueva;
  $('tablero').hidden = vista !== 'tablero';
  $('proceso').hidden = vista !== 'proceso';
  for (const [id, v] of [['ver-tablero', 'tablero'], ['ver-proceso', 'proceso']]) {
    if (vista === v) $(id).setAttribute('aria-current', 'page'); else $(id).removeAttribute('aria-current');
  }
}

async function borrarRegistro() {
  if (!await confirmar('Borrar el registro', 'Se borra el historial de ejecuciones y descargas de este navegador. Los archivos ya descargados no cambian.', 'Borrar registro')) return;
  registro.borrar();
  pintar();
  notificar('ok', 'Se borró el registro de ejecuciones.');
}

function detalleEjecucion(e) {
  return detalle('reg-' + e.id, `Detalle de ${e.id}`,
    tabla(['Dato', 'Valor'], [
      ['Petición de anonimización', fechaHora(e.solicitadoEn)],
      ['Elaboración del dataset', fechaHora(e.elaboradoEn)],
      ['Archivo de origen', e.archivo || '—'],
      ['Periodo de atención', e.periodo || '—'],
      ['Configuración', e.configuracion],
      ['Medición de riesgo (k)', `Antes: ${e.kAntes} · Después: ${e.kDespues} · Meta: ${e.kMeta} o más`],
      ['Personas', `${num(e.personasAntes)} → ${num(e.personasDespues)}`],
      ['Anonimizaciones aplicadas', `${e.anonimizaciones} columnas · ${num(e.celdasModificadas)} celdas modificadas`],
      ['Técnicas', enLinea(e.tecnicas)],
      ['Clasificación de columnas', `${e.columnasClasificadas} de ${e.totalColumnas} clasificadas · ${enLinea(e.clasificaciones)}`],
      ['Verificaciones', `${e.verificacionesCorrectas} de ${e.verificacionesTotal} correctas`],
    ]),
    h('h3', {}, 'Descargas'),
    e.descargas.length
      ? tabla(['Archivo', 'Fecha de descarga'], e.descargas.map(d => [d.archivo, fechaHora(d.fecha)]))
      : h('p', {}, 'Este dataset no se ha descargado.'));
}

function pintarTablero() {
  const entradas = registro.lista(), t = resumenRegistro(entradas), u = t.ultima;
  const ultimaDescarga = e => e.descargas.at(-1);
  $('tablero').replaceChildren(h('section', { className: 'panel', 'aria-labelledby': 'tablero-h' },
    h('div', { className: 'cabeza-tablero' },
      h('div', {}, h('h2', { id: 'tablero-h', tabIndex: -1 }, 'Tablero de ejecuciones'),
        h('p', { className: 'descripcion' }, 'Registro de cada anonimización: cuándo se pidió, el riesgo (k) medido, qué se transformó y cuándo se descargó.')),
      boton('Nueva anonimización →', () => irA(siguientePaso()[1]), { className: 'principal', id: 'nueva' })),
    !registro.persistente && aviso('aviso', 'Este navegador no permite guardar el registro: se perderá al cerrar la página.'),
    h('div', { className: 'indicadores' },
      indicador('Ejecuciones registradas', num(t.ejecuciones), `${num(t.aptas)} aptas · ${num(t.ejecuciones - t.aptas)} no aptas`),
      indicador('k de la última ejecución', u ? u.kDespues : '—', u ? `Antes: ${u.kAntes}. Meta: ${u.kMeta} o más` : 'Sin ejecuciones', u ? u.kDespues >= u.kMeta : undefined),
      indicador('Anonimizaciones aplicadas', num(t.anonimizaciones), 'Columnas transformadas, sumando todas las ejecuciones'),
      indicador('Datasets descargados', num(t.descargas), t.ultimaDescarga ? `Última: ${fechaHora(t.ultimaDescarga.fecha)}` : 'Ninguna descarga todavía')),
    entradas.length === 0
      ? h('div', { className: 'vacio' }, h('p', {}, 'Todavía no hay ejecuciones registradas. Pulse «Nueva anonimización» para empezar.'))
      : [h('h3', {}, 'Registro'),
        tabla(['Petición', 'Dataset elaborado', 'Archivo', 'Configuración', 'Riesgo k (antes → después)', 'Anonimizaciones', 'Clasificación', 'Estado', 'Descarga'],
          entradas.map(e => [fechaHora(e.solicitadoEn), fechaHora(e.elaboradoEn), e.archivo || '—', e.configuracion,
            etiqueta(e.kDespues >= e.kMeta ? 'ok' : 'mal', `${e.kAntes} → ${e.kDespues} (meta ${e.kMeta})`),
            `${e.anonimizaciones} columnas · ${num(e.celdasModificadas)} celdas`,
            etiqueta(e.columnasClasificadas === e.totalColumnas ? 'ok' : 'aviso', `${e.columnasClasificadas} de ${e.totalColumnas} clasificadas`),
            etiqueta(e.apto ? 'ok' : 'mal', e.apto ? 'Apto' : 'No apto'),
            ultimaDescarga(e) ? `${fechaHora(ultimaDescarga(e).fecha)} (${e.descargas.length} archivo(s))` : etiqueta('neutro', 'No descargado')])),
        h('h3', {}, 'Detalle por ejecución'),
        entradas.map(detalleEjecucion),
        h('div', { className: 'acciones' }, boton('Borrar registro', borrarRegistro, { className: 'peligro', id: 'borrar-registro' }))],
    h('p', { className: 'nota' }, 'El registro se guarda solo en este navegador y no contiene datos de personas: solo fechas, conteos y resultados de cada ejecución.')));
}

function pintar() {
  pintarTablero();
  const foco = document.activeElement?.id;
  const montajes = [];
  $('contenido').replaceChildren(...SECCIONES.map(([id, titulo, descripcion, panel]) => {
    const contenido = panel();
    if (contenido.alMontar) montajes.push(contenido.alMontar);
    return h('section', { id, className: 'panel', 'aria-labelledby': id + '-h' },
      h('h2', { id: id + '-h', tabIndex: -1 }, titulo), h('p', { className: 'descripcion' }, descripcion),
      h('div', {}, contenido));
  }));
  pintarNavegacion();
  montajes.forEach(f => f());
  if (foco) $(foco)?.focus?.({ preventScroll: true });
}

$('reiniciar').addEventListener('click', empezarDeNuevo);
$('ayuda-abrir').addEventListener('click', () => $('ayuda').showModal());
$('ayuda-cerrar').addEventListener('click', () => $('ayuda').close());
$('ver-tablero').addEventListener('click', () => irA('tablero'));
$('ver-proceso').addEventListener('click', () => irA(siguientePaso()[1]));
// Atajos: Alt+0 abre el tablero; Alt+1…5 salta a cada sección.
globalThis.addEventListener?.('keydown', e => {
  if (!e.altKey) return;
  if (e.key === '0') { e.preventDefault(); irA('tablero'); return; }
  const seccion = SECCIONES[Number(e.key) - 1];
  if (seccion) { e.preventDefault(); irA(seccion[0]); }
});
// Evita perder el trabajo al recargar o cerrar por accidente.
globalThis.addEventListener?.('beforeunload', e => { if (S.datos) { e.preventDefault(); e.returnValue = ''; } });

pintar();
verVista(vista);
