// Panel en una sola vista. Los datos viven solo en memoria.
import { REFERENCIA, PROPIA } from '../motor/config.js';
import { leer, extraerCohorte, medir, ejecutar, plan, validarConfig } from '../motor/motor.js';
import { aCSV } from '../motor/csv.js';
import { zip } from '../motor/zip.js';
import { CAPITULOS, BLOQUES_F, CATEGORIAS_F, FILTRO_ESTUDIO, esDelEstudio, nombreCIE10 } from '../motor/cie10.js';
import { num, pct, ident, sha256, configuracionJSON, trazabilidadJSON, ptaHTML,
  BORRADOR_RIESGO, BORRADOR_TITULAR } from '../motor/entregables.js';
import { h, boton, tabla, etiqueta, aviso, detalle, tablaConBusqueda, confirmar } from './dom.js';

const sinResultados = () => ({ r: null, historial: {} });
const inicial = () => ({
  datos: null, archivo: '', cohorte: null, antes: null, ...sinResultados(),
  config: { ...REFERENCIA }, propia: { ...PROPIA }, filtro: { ...FILTRO_ESTUDIO },
  deshacer: null, desactualizado: false,
});
const ptaInicial = () => ({
  equipo: '', riesgo: BORRADOR_RIESGO, titular: BORRADOR_TITULAR, atacante: '', canal: '', okRiesgo: false, okTitular: false,
});
let S = inicial();
const pta = ptaInicial();
let pestana = 'recorrido', ocupado = false;

const $ = id => document.getElementById(id);
const anunciar = texto => { $('anuncio').textContent = texto; };

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

function mostrarError(mensaje) {
  const caja = $('error');
  caja.hidden = !mensaje;
  if (!mensaje) { caja.replaceChildren(); return; }
  const solucion = SOLUCIONES.find(([patron]) => patron.test(mensaje))?.[1] ?? 'Revise el último paso e inténtelo de nuevo.';
  caja.replaceChildren(h('p', {}, h('strong', {}, '✗ No se pudo completar. '), mensaje),
    h('p', {}, h('strong', {}, 'Qué hacer: '), solucion), boton('Cerrar aviso', () => mostrarError('')));
  caja.scrollIntoView?.({ block: 'nearest' });
}

function trabajar(mensaje, fn, destino) {
  if (ocupado) return;
  ocupado = true;
  mostrarError('');
  $('ocupado').textContent = '⏳ ' + mensaje;
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
  const seccion = $(id);
  seccion?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  $(id + '-h')?.focus?.({ preventScroll: true });
}

async function sePuedeDescartar(accion) {
  if (!S.r && !Object.keys(S.historial).length) return true;
  return confirmar('Se descartarán los resultados',
    `Al ${accion} se borran los resultados de esta sesión. Las descargas ya guardadas no cambian.`, 'Descartar y continuar');
}

function limpiarRevision() { pta.okRiesgo = pta.okTitular = false; }

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
    anunciar(`Archivo válido: ${num(datos.filas.length)} filas. Siguiente: extraer la cohorte.`);
  });
}

async function empezarDeNuevo() {
  if (!await confirmar('Empezar de nuevo', 'Se borra de la memoria el archivo, los resultados y los textos escritos.', 'Borrar todo')) return;
  S = inicial();
  Object.assign(pta, ptaInicial());
  mostrarError('');
  pintar();
  irA('datos');
}

async function cambiarFiltro(nuevo) {
  if (!await sePuedeDescartar('cambiar el filtro')) { pintar(); return; }
  Object.assign(S, sinResultados(), { filtro: nuevo, cohorte: null, antes: null, deshacer: null, desactualizado: false });
  limpiarRevision();
  pintar();
}

function filtroCIE10() {
  const f = S.filtro;
  const selector = (texto, id, valor, opciones, alCambiar, desactivado) => h('label', {}, texto,
    h('select', { id, disabled: desactivado, onchange: e => alCambiar(e.target.value) },
      opciones.map(([v, t]) => h('option', { value: v, selected: v === valor }, t))));
  const esF = f.capitulo === 'V';
  const grupo = BLOQUES_F.find(x => x.id === f.bloque);
  const categorias = Object.entries(CATEGORIAS_F)
    .filter(([c]) => !grupo || (c >= grupo.desde && c <= grupo.hasta));
  return detalle('filtro', `Filtro de diagnóstico: ${esDelEstudio(f) ? 'el que pide el estudio (salud mental)' : 'personalizado (solo exploración)'}`,
    h('p', {}, 'CIE-10 es el catálogo internacional de enfermedades. El estudio pide todo el capítulo V (códigos que empiezan con F). Para entregar, no lo cambie.'),
    h('div', { className: 'fila' },
      selector('Capítulo', 'f-capitulo', f.capitulo, CAPITULOS.map(c => [c.id, `${c.id} · ${c.desde}-${c.hasta} · ${c.nombre}`]),
        v => cambiarFiltro({ capitulo: v, bloque: '', categoria: '' })),
      selector('Grupo de salud mental', 'f-grupo', f.bloque,
        [['', 'Todos'], ...BLOQUES_F.map(b => [b.id, `${b.id} · ${b.nombre}`])],
        v => cambiarFiltro({ ...f, bloque: v, categoria: '' }), !esF),
      selector('Categoría de salud mental', 'f-categoria', f.categoria,
        [['', 'Todas'], ...categorias.map(([c, n]) => [c, `${c} · ${n}`])],
        v => cambiarFiltro({ ...f, categoria: v }), !esF)),
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
      anunciar(`Cohorte lista: ${num(cohorte.personas)} personas. Siguiente: proteger los datos.`);
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
      ['− Fuera de 2023-2025', num(c.excluidas.periodo)],
      ['= Atenciones en la cohorte', num(c.atenciones)]]),
    h('p', {}, `Identificadores presentes ahora: ${ident(S.antes.identificadores)}.`)),
  ];
}

function indicador(nombre, valor, explicacion, cumple) {
  return h('div', { className: 'indicador' + (cumple === undefined ? '' : cumple ? ' ok' : ' mal') },
    h('span', {}, nombre), h('b', {}, valor),
    h('small', {}, cumple === undefined ? explicacion : `${cumple ? '✓ Cumple' : '✗ No cumple'}. ${explicacion}`));
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
}

function elegirModo(tipo) {
  if (S.config.tipo === tipo) return;
  S.config = tipo === 'referencia' ? { ...REFERENCIA } : { ...S.propia };
  S.r = S.historial[tipo] ?? null;
  S.desactualizado = false;
  S.deshacer = null;
  limpiarRevision();
  pintar();
}

function anonimizar() {
  trabajar('Protegiendo los datos y midiendo el resultado…', () => {
    S.r = ejecutar(S.cohorte, S.config, S.datos.nombreOriginal);
    S.historial[S.config.tipo] = S.r;
    S.desactualizado = false;
    S.deshacer = null;
    limpiarRevision();
    anunciar(S.r.apto ? 'Listo: la ejecución es APTA. Revise los resultados.' : 'La ejecución NO es apta. Revise qué falló.');
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
  const variables = plan(c);
  const errores = validarConfig(c);
  return [
    h('fieldset', { className: 'opciones' }, h('legend', {}, 'Elija una forma de proteger'),
      opcion('referencia', 'Referencia', 'Las reglas oficiales. Sirve para la verificación del jurado.'),
      opcion('propia', 'Propia (para entregar)', 'Añade protección del diagnóstico y oculta estancias muy largas.')),
    S.desactualizado && aviso('aviso', 'Cambió la configuración. Vuelva a proteger los datos para ver resultados y descargar.'),
    detalle('parametros', fija ? 'Ver los parámetros (fijos en la referencia)' : 'Ajustar parámetros',
      h('div', { className: 'fila' },
        selector('Grupo mínimo (k)', 'k', [5, 6, 8, 10, 15].map(n => [n, `${n} personas`]), 'Cada persona se confunde con otras. Más alto protege más.'),
        selector('Rangos de edad', 'anchoEdad', [[20, 'De 20 años'], [10, 'De 10 años']], '20 protege más; 10 da más detalle.'),
        selector('Ubicación', 'ubicacion', [['region', 'Región'], ['provincia', 'Provincia']], 'Región agrupa a más personas.'),
        selector('Fecha', 'fecha', [['mes', 'Año y mes'], ['anio', 'Solo año']], 'El estudio pide año y mes.'),
        selector('Diagnósticos distintos por grupo (l)', 'l', [[1, 'No exigir'], [2, 'Al menos 2'], [3, 'Al menos 3']], 'Evita deducir la enfermedad de un grupo.'),
        selector('Estancias largas', 'topeEstancia', [[null, 'Mostrar exactas'], [15, '15 días o más juntas'], [30, '30 días o más juntas'], [60, '60 días o más juntas']], 'Evita que un valor raro señale a alguien.')),
      !fija && boton('Restablecer valores recomendados', () => {
        guardarParaDeshacer();
        S.config = { ...PROPIA }; S.propia = { ...PROPIA }; S.r = null; delete S.historial.propia;
        S.desactualizado = true; limpiarRevision(); pintar();
      })),
    detalle('variables', 'Ver qué pasa con cada una de las 28 columnas',
      tablaConBusqueda('variables', ['Columna', 'Qué es', 'Categoría especial', '¿La pide el estudio?', 'Qué se hace', 'Cómo'],
        variables.map(v => [v.nombre, v.clasificacion, v.categoria || '—', v.solicitada, v.tecnica, v.parametro || '—']))),
    errores.map(e => aviso('mal', e)),
    h('div', { className: 'acciones' },
      boton(S.r ? 'Volver a proteger y medir' : 'Proteger los datos y medir', anonimizar,
        { className: 'principal', id: 'anonimizar', disabled: errores.length > 0 }),
      S.deshacer && boton('↶ Deshacer el último cambio', () => {
        Object.assign(S, S.deshacer, { deshacer: null });
        limpiarRevision(); pintar();
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
  const perdidas = r.consulta.celdas.filter(c => c.despues === 0);
  return [
    !r.cohorte.esEstudio && aviso('aviso', `Exploración con ${r.cohorte.etiquetaFiltro}: no se puede entregar.`),
    h('div', { className: 'veredicto ' + (r.apto ? 'ok' : 'mal') },
      h('strong', {}, r.apto ? '✓ APTO para continuar' : '✗ NO APTO'),
      h('span', {}, r.apto ? `Pasó los controles medidos con la configuración ${r.config.tipo}. No significa riesgo cero.`
        : 'Falló: ' + fallas.map(v => `${v.id} ${v.texto}`).join('; ') + '. Cambie la configuración y vuelva a medir.')),
    h('div', { className: 'indicadores' },
      indicador('Grupo más pequeño (k)', d.kMin, `Antes: ${a.kMin}. Meta: 5 o más`, d.kMin >= 5),
      indicador('Personas únicas', pct(d.pctUnicas), `Antes: ${pct(a.pctUnicas)}. Meta: 0 %`, d.pctUnicas === 0 && d.personas > 0),
      indicador('Identificadores detectados', d.identificadores.columnas + d.identificadores.texto, `Antes: ${ident(a.identificadores)}`, sinIdent(d)),
      indicador('Personas conservadas', pct(r.conservadas), `${num(d.personas)} de ${num(a.personas)}. Mide utilidad`)),
    perdidas.length > 0 && aviso('aviso', `Utilidad: ${perdidas.length} combinación(es) de región y sexo desaparecen por completo. Explíquelo en la presentación.`),
    d.homogeneos.length > 0 && aviso('aviso', `${d.homogeneos.length} grupo(s) comparten un solo diagnóstico: se podría deducir. La configuración Propia los trata.`),
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
  const vistas = {
    recorrido: ['Paso a paso', () => tabla(['#', 'Operación', 'Regla', 'Vuelta', 'Personas', 'Atenciones', 'k', 'Grupos con 1 diagnóstico'],
      r.recorrido.map((o, i) => [i + 1, o.operacion, o.regla, o.vuelta ?? '—',
        `${o.personasAntes ?? '—'} → ${o.personasDespues}`, `${o.atencionesAntes} → ${o.atencionesDespues}`,
        o.kAntes === undefined ? '—' : `${o.kAntes} → ${o.kDespues}`,
        o.homogeneosAntes === undefined ? '—' : `${o.homogeneosAntes} → ${o.homogeneosDespues}`]))],
    columnas: ['Por columna', () => tablaConBusqueda('traza',
      ['Columna', 'Qué se hizo', 'Cómo', 'Sale como', 'Celdas cambiadas', 'Valores distintos', 'Por qué', 'Estado'],
      r.traza.map(t => [t.columna_entrada, t.tecnica, t.parametro || '—', t.columna_salida,
        num(t.valores_modificados), `${num(t.distintos_antes)} → ${num(t.distintos_despues)}`, t.justificacion, t.estado]))],
    verificaciones: ['Verificaciones', () => tabla(['ID', 'Comprobación', 'Resultado'],
      r.verificaciones.map(v => [v.id, v.texto, etiqueta(v.ok ? 'ok' : 'mal', v.ok ? 'Correcta' : 'Falló')]))],
  };
  return [
    aviso(correctas === r.verificaciones.length ? 'ok' : 'mal', `${correctas} de ${r.verificaciones.length} verificaciones correctas.`),
    detalle('traza', 'Ver el detalle de lo que se hizo',
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
  const r = S.r, base = `R2_Equipo${pta.equipo}`;
  const csv = aCSV(r.columnas, r.salida), config = configuracionJSON(r);
  const archivos = {
    csv: [base + '_salida.csv', csv, 'text/csv;charset=utf-8'],
    config: [base + '_configuracion.json', config, 'application/json'],
    traza: [base + '_trazabilidad.json', await trazabilidadJSON(r, await sha256(csv), await sha256(config)), 'application/json'],
    pta: [base + '_PTA.html', ptaHTML(r, pta), 'text/html;charset=utf-8'],
  };
  const elegido = cual === 'zip'
    ? [base + '_paquete.zip', zip(Object.values(archivos).map(([n, c]) => [n, c])), 'application/zip']
    : archivos[cual];
  descargar(...elegido);
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
        estado.replaceChildren(aviso('ok', `Se envió a descargas: ${nombre}. Compruebe que esté en su carpeta.`));
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
  const vista = [
    S.r.config.tipo === 'referencia' && aviso('aviso', 'Va a exportar la REFERENCIA. Para entregar se recomienda la configuración Propia.',
      boton('Cambiar a Propia', () => { elegirModo('propia'); irA('proteccion'); })),
    escribir('Número de equipo (2 dígitos)', 'equipo', null, 'Ej.: 07', { inputMode: 'numeric', maxLength: 2 }),
    seccion('Riesgo que queda y cómo se reduce', 'riesgo', 'okRiesgo',
      escribir('¿Quién podría intentar reidentificar? (supuesto del equipo)', 'atacante', 'okRiesgo', 'Escriba el supuesto del equipo')),
    seccion('Resumen para la persona titular de los datos', 'titular', 'okTitular',
      escribir('Canal para ejercer derechos', 'canal', 'okTitular', 'Canal confirmado con la organización')),
    h('h3', {}, 'Antes de descargar'), lista, motivo,
    h('div', { className: 'acciones' }, botones), estado,
    h('p', { className: 'nota' }, 'Use los datos solo para este estudio, sin reidentificar ni cruzar fuentes. Guarde las descargas fuera de la carpeta del proyecto.'),
  ];
  botones.forEach(b => { b.disabled = !entregaLista(); });
  vista.alMontar = actualizar;
  return vista;
}

// ---------- Estructura del panel ----------
const bloqueo = (mensaje, destino) => h('div', { className: 'vacio' }, h('p', {}, '🔒 ' + mensaje),
  boton('Ir al paso necesario', () => irA(destino)));

const SECCIONES = [
  ['datos', '1. Datos', 'Cargue el archivo y seleccione a las personas del estudio.', panelDatos,
    () => (S.cohorte ? ['ok', 'Listo'] : S.datos ? ['aviso', 'Falta extraer'] : ['neutro', 'Por hacer'])],
  ['proteccion', '2. Protección', 'Decida cómo ocultar la identidad de las personas.', panelProteccion,
    () => (S.r ? ['ok', 'Listo'] : !S.cohorte ? ['neutro', 'Bloqueado'] : S.desactualizado ? ['aviso', 'Volver a medir'] : ['aviso', 'Por hacer'])],
  ['resultados', '3. Resultados', '¿Se puede reconocer a alguien? ¿Los datos siguen siendo útiles?', panelResultados,
    () => (S.r ? (S.r.apto ? ['ok', 'Apto'] : ['mal', 'No apto']) : ['neutro', 'Pendiente'])],
  ['trazabilidad', '4. Trazabilidad', 'Compruebe qué se hizo y en qué orden.', panelTraza,
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

function pintar() {
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
// Atajos: Alt+1…5 salta a cada sección.
globalThis.addEventListener?.('keydown', e => {
  const seccion = SECCIONES[Number(e.key) - 1];
  if (e.altKey && seccion) { e.preventDefault(); irA(seccion[0]); }
});
// Evita perder el trabajo al recargar o cerrar por accidente.
globalThis.addEventListener?.('beforeunload', e => { if (S.datos) { e.preventDefault(); e.returnValue = ''; } });

pintar();
