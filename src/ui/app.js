// Panel según el rol. TI procesa aquí las peticiones del comité; las filas de personas viven solo en memoria.
import { REFERENCIA, PROPIA } from '../motor/config.js';
import { extraerCohorte, contadorPorFiltro, medir, ejecutar, plan, validarConfig, ANCHO_EDAD, gruposDeEdad } from '../motor/motor.js';
import { aCSV } from '../motor/csv.js';
import { FILTRO_ESTUDIO, nombreCIE10 } from '../motor/cie10.js';
import { num, pct, ident, sha256, configuracionJSON, trazabilidadJSON, ptaHTML, BORRADOR_RIESGO, BORRADOR_TITULAR } from '../motor/entregables.js';
import { entradaDeEjecucion, filtrarRegistro, paginar, TAMANOS_PAGINA, diaLocal } from '../motor/registro.js';
import { etiquetaDestinatario } from '../motor/destinatario.js';
import { ROLES } from '../motor/usuarios.js';
import { h, boton, tabla, tablaAdaptable, etiqueta, aviso, detalle, tablaConBusqueda, confirmar, notificar, iconoEstado, datosClave, pestanas } from './dom.js';
import { registro, peticiones, sesion, log, mostrarError, fechaHora, fechaCorta } from './servicios.js';
import { describirFiltro } from './campos.js';
import { guardarArchivo } from './archivos.js';
import { pintarLogin } from './sesion.js';
import { pintarComite } from './comite.js';
import { pintarDoctor, reiniciarDoctor } from './doctor.js';
import { pintarTiPeticiones, pintarTiLogs, pintarTiTablero } from './ti.js';
import { icono, iniciarMenuLateral } from './menu-lateral.js';
import { analizar, decisionesIniciales, estandarizar } from '../ia/estandarizar.js';
import { panelRevision } from './revision.js';

const sinResultados = () => ({ r: null, historial: {} });
const inicial = () => ({
  datos: null, revision: null, archivo: '', cohorte: null, antes: null, ...sinResultados(),
  config: { ...REFERENCIA }, propia: { ...PROPIA }, filtro: { ...FILTRO_ESTUDIO },
  deshacer: null, desactualizado: false,
  peticion: null, // petición del comité que TI está procesando
});
let S = inicial();
let pestana = 'recorrido', ocupado = false;
let vista = '';
let paso = 'datos'; // paso del procesamiento que se muestra
let menuLateral = null;

const $ = id => document.getElementById(id);

// ---------- Acciones largas ----------
const MENSAJE_DESACTUALIZADO = 'Cambió la configuración. Vuelva a proteger los datos para ver resultados y descargar.';

function trabajar(mensaje, fn, destino) {
  if (ocupado) return;
  ocupado = true;
  mostrarError('');
  $('ocupado').textContent = mensaje;
  $('ocupado').hidden = false;
  setTimeout(async () => { // deja pintar el indicador antes del cálculo
    let bien = false;
    try { await fn(); bien = true; } catch (e) { mostrarError(e.message, 'Procesamiento de la petición'); }
    ocupado = false;
    $('ocupado').hidden = true;
    pintar();
    if (bien && destino) irA(destino);
  }, 30);
}

// Vistas por rol o pasos del procesamiento. Cada paso se muestra solo; el cambio se anuncia al lector de pantalla.
function irA(id) {
  if (VISTAS_ID.has(id)) { verVista(id); $(id)?.querySelector('h2')?.focus(); return; }
  const i = SECCIONES.findIndex(([s]) => s === id);
  if (i < 0) return;
  const cambia = paso !== id || vista !== 'proceso';
  paso = id;
  if (vista !== 'proceso') verVista('proceso'); else pintar();
  if (cambia) {
    $('anuncio').textContent = `Paso ${i + 1} de ${SECCIONES.length}: ${SECCIONES[i][1].replace(/^\d+\.\s*/, '')}`;
    globalThis.scrollTo?.({ top: 0, behavior: 'auto' });
  }
  $(id + '-h')?.focus?.({ preventScroll: true });
}

async function sePuedeDescartar(accion) {
  if (!S.r && !Object.keys(S.historial).length) return true;
  return confirmar('Se descartarán los resultados',
    `Al ${accion} se borran los resultados de esta sesión. Las descargas ya guardadas no cambian.`, 'Descartar y continuar');
}


// ---------- 1. Datos ----------
async function cargar(entrada) {
  const archivo = entrada.files[0];
  if (!archivo) return;
  if (!await sePuedeDescartar('cargar otro archivo')) { entrada.value = ''; return; }
  trabajar('La IA está leyendo y reconociendo las columnas…', async () => {
    const bytes = await archivo.arrayBuffer();
    let texto, codificacion = 'UTF-8';
    try { texto = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
    catch { texto = new TextDecoder('windows-1252').decode(bytes); codificacion = 'Windows-1252'; }
    const analisis = analizar(texto.replace(/^\uFEFF/, '')); // si falla, se conserva lo anterior
    S = { ...inicial(), peticion: S.peticion, filtro: { ...S.peticion.filtro }, archivo: archivo.name, revision: { analisis, decisiones: decisionesIniciales(analisis), codificacion } };
  }, 'datos');
}

function confirmarEstandarizacion() {
  trabajar('Estandarizando los datos…', () => {
    const res = estandarizar(S.revision.analisis, S.revision.decisiones);
    if (!res.datos) throw new Error(res.problemas.join(' '));
    S.datos = res.datos;
    S.revision = null;
    log('peticion', 'Base de datos cargada', `${S.archivo} · ${num(res.datos.filas.length)} atenciones`, { referencia: S.peticion.id });
  }, 'datos');
}

async function empezarDeNuevo() {
  if (!await confirmar('Empezar de nuevo', 'Se borra de la memoria el archivo cargado y los resultados de esta petición.', 'Borrar todo')) return;
  S = { ...inicial(), peticion: S.peticion, filtro: S.peticion ? { ...S.peticion.filtro } : { ...FILTRO_ESTUDIO } };
  mostrarError('');
  pintar();
  notificar('ok', 'Se borró de la memoria el archivo cargado y los resultados.');
  irA('datos');
}

// El filtro lo define el comité en la petición; TI solo lo aplica.
function filtroPeticion() {
  S.contar ??= contadorPorFiltro(S.datos.filas);
  return h('div', { className: 'filtro-peticion' },
    h('p', {}, h('strong', {}, `Filtro de la petición ${S.peticion.id}: `), describirFiltro(S.filtro)),
    h('p', { className: 'nota' }, `En este archivo hay ${num(S.contar(S.filtro))} personas con este filtro (diagnóstico, edad y periodo). Lo definió el comité de ética y no se cambia aquí.`));
}

function panelDatos() {
  if (!S.peticion) return [bloqueo('Elija una petición en «Peticiones» para procesarla.', 'ti-peticiones')];
  const c = S.cohorte, d = S.datos;
  return [
    h('p', { className: 'contexto-paso' }, 'Petición ', h('strong', {}, S.peticion.id), ` · para ${etiquetaDestinatario(S.peticion.destinatario)} · ${describirFiltro(S.peticion.filtro)}`),
    // Con un archivo ya cargado, el selector se reduce a una línea.
    d || S.revision
      ? h('div', { className: 'archivo-cargado' },
        h('span', {}, 'Archivo: ', h('strong', {}, S.archivo)),
        h('label', { className: 'boton-archivo' }, 'Cambiar archivo',
          h('input', { type: 'file', id: 'archivo', accept: '.csv,.tsv,.txt', className: 'solo-lector', onchange: e => cargar(e.target) })),
        h('small', {}, 'Se procesa en este equipo; no se envía a ningún servidor.'))
      : [h('label', { className: 'archivo' }, 'Elija el archivo de atenciones (CSV, TSV o texto delimitado)',
        h('input', { type: 'file', id: 'archivo', accept: '.csv,.tsv,.txt', onchange: e => cargar(e.target) })),
      h('p', { className: 'nota' }, 'El archivo se procesa en este equipo; la aplicación no lo envía a ningún servidor.')],
    S.revision && panelRevision(S.revision, pintar, confirmarEstandarizacion),
    d && aviso('ok', `«${S.archivo}» quedó estandarizado: ${num(d.filas.length)} atenciones de ${num(d.personas)} personas.`),
    d && d.avisos.map(a => h('p', { className: 'nota' }, 'Nota: ' + a)),
    d && detalle('estandarizacion', 'Ver cómo se estandarizó el archivo',
      tabla(['Columna de origen', 'Se tomó como', 'Quién decidió'],
        d.estandarizacion.asignaciones.map(x => [x.columna_original, x.campo === 'desconocida' ? 'se elimina' : x.campo, x.decidio])),
      d.estandarizacion.cambios_de_formato.length
        ? tabla(['Campo', 'Formato aplicado', 'Valores cambiados'], d.estandarizacion.cambios_de_formato.map(x => [x.campo, x.regla, num(x.modificados)]))
        : h('p', {}, 'No fue necesario cambiar ningún valor.'),
      d.estandarizacion.derivados.map(x => h('p', {}, `Se calculó «${x.campo}» desde: ${x.desde}.`))),
    d && filtroPeticion(),
    d && !c && boton('Extraer las personas de la petición', () => trabajar('Extrayendo la cohorte y midiendo el riesgo inicial…', () => {
      const cohorte = extraerCohorte(S.datos.filas, S.filtro);
      if (!cohorte.atenciones) throw new Error('La cohorte está vacía.');
      cohorte.esEstudio = true; // usa exactamente el filtro de la petición
      S.cohorte = cohorte;
      S.antes = medir(cohorte.filas, 'cedula');
    }), { className: 'principal', id: 'extraer' }),
    c && h('div', { className: 'indicadores' },
      indicador('Personas seleccionadas', num(c.personas), 'Es la «cohorte» de la petición'),
      indicador('Atenciones', num(c.atenciones), 'Una persona puede tener varias'),
      indicador('Grupo más pequeño (k)', S.antes.kMin, 'Antes de proteger. Meta: 5 o más', S.antes.kMin >= 5),
      indicador('Personas únicas', pct(S.antes.pctUnicas), 'Se distinguen de todas las demás', S.antes.pctUnicas === 0)),
    c && detalle('exclusiones', 'Ver por qué se excluyeron atenciones', tabla(['Concepto', 'Atenciones'], [
      ['Atenciones en el archivo', num(c.entrada)],
      [`− Diagnóstico fuera del filtro (${c.etiquetaFiltro})`, num(c.excluidas.diagnostico)],
      [`− Edad fuera del rango (${c.edad}) en la fecha de atención`, num(c.excluidas.edad)],
      [`− Fuera del periodo ${c.periodo}`, num(c.excluidas.periodo)],
      ['= Atenciones en la cohorte', num(c.atenciones)]]),
    h('p', {}, `Identificadores presentes ahora: ${ident(S.antes.identificadores)}.`)),
  ];
}

function indicador(nombre, valor, explicacion, cumple) {
  return h('div', { className: 'indicador' + (cumple === undefined ? '' : cumple ? ' ok' : ' mal') },
    h('span', {}, nombre), h('b', {}, valor),
    h('small', {}, cumple === undefined ? explicacion : `${cumple ? 'Cumple' : 'No cumple'}. ${explicacion}`));
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
  pintar();
  notificar('ok', `Configuración ${tipo === 'referencia' ? 'Referencia' : 'Propia'} seleccionada.`);
}

function anonimizar() {
  const solicitadoEn = new Date().toISOString(); // momento en que el operador pide la anonimización
  trabajar('Protegiendo los datos y midiendo el resultado…', () => {
    S.r = ejecutar(S.cohorte, S.config, S.datos.nombreOriginal);
    S.r.estandarizacion = S.datos.estandarizacion;
    S.r.destinatario = null; // se registra al publicar
    S.r.peticionId = S.peticion.id;
    registro.agregar(entradaDeEjecucion(S.r, { archivo: S.archivo, solicitadoEn }));
    log('peticion', 'Protección ejecutada', `${S.r.id} · configuración ${S.config.tipo} · ${S.r.apto ? 'APTA' : 'NO APTA'}`, { referencia: S.peticion.id });
    S.historial[S.config.tipo] = S.r;
    S.desactualizado = false;
    S.deshacer = null;
  }, 'resultados');
}

function panelProteccion() {
  if (!S.cohorte) return [bloqueo('Primero cargue la base y extraiga las personas de la petición.', 'datos')];
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
        selector('Grupo mínimo (k)', 'k', [5, 6, 8, 10, 15].map(n => [n, `${n} personas`]), 'Tamaño del grupo más pequeño de personas con la misma edad, sexo y región. Con 5, cada persona se confunde con al menos 4 más.'),
        contador('Ancho de los rangos de edad', 'anchoEdad', { ...ANCHO_EDAD, unidad: 'años' },
          `Más años protegen más; menos dan más detalle. Entre ${ANCHO_EDAD.min} y ${ANCHO_EDAD.max}. Grupos: ${gruposDeEdad(c.anchoEdad).join(' · ')}`),
        selector('Ubicación', 'ubicacion', [['region', 'Región'], ['provincia', 'Provincia']], 'Región agrupa a más personas.'),
        selector('Fecha', 'fecha', [['mes', 'Año y mes'], ['anio', 'Solo año']], 'El estudio pide año y mes.'),
        selector('Diagnósticos distintos por grupo (l)', 'l', [[1, 'No exigir'], [2, 'Al menos 2'], [3, 'Al menos 3']], 'Cuántos diagnósticos distintos debe tener cada grupo. Con 2 o más, nadie deduce la enfermedad solo por saber a qué grupo pertenece una persona.'),
        selector('Estancias largas', 'topeEstancia', [[null, 'Mostrar exactas'], [15, '15 días o más juntas'], [30, '30 días o más juntas'], [60, '60 días o más juntas']], 'Evita que un valor raro señale a alguien.')),
      !fija && boton('Restablecer valores recomendados', () => {
        guardarParaDeshacer();
        S.config = { ...PROPIA }; S.propia = { ...PROPIA }; S.r = null; delete S.historial.propia;
        S.desactualizado = true; pintar();
        notificar('aviso', MENSAJE_DESACTUALIZADO);
      })),
    detalle('variables', 'Ver qué pasa con cada una de las 28 columnas',
      tablaConBusqueda('variables', ['Columna', 'Qué es', 'Categoría especial', '¿La pide el estudio?', 'Qué se hace', 'Cómo'],
        variables.map(v => [v.nombre, v.clasificacion, v.categoria || '—', v.solicitada, v.tecnica, v.parametro || '—']))),
    errores.map(e => aviso('mal', e)),
    h('div', { className: 'acciones' },
      boton(S.r ? 'Volver a proteger y medir' : 'Proteger los datos y medir', anonimizar,
        { className: 'principal', id: 'anonimizar', disabled: errores.length > 0 }),
      S.deshacer && boton([icono('deshacer'), 'Deshacer el último cambio'], () => {
        Object.assign(S, S.deshacer, { deshacer: null }); pintar();
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
      h('strong', {}, r.apto ? 'APTO para continuar' : 'NO APTO', iconoEstado(r.apto ? 'ok' : 'mal')),
      h('span', {}, r.apto ? `Pasó los controles medidos con la configuración ${r.config.tipo}. No significa riesgo cero.`
        : 'Falló: ' + fallas.map(v => `${v.id} ${v.texto}`).join('; ') + '. Cambie la configuración y vuelva a medir.')),
    pestanas('resultados', [
      ['resumen', 'Resumen', () => [
        h('div', { className: 'indicadores' },
          indicador('Grupo más pequeño (k)', d.kMin, `Antes: ${a.kMin}. Meta: 5 o más`, d.kMin >= 5),
          indicador('Personas únicas', pct(d.pctUnicas), `Antes: ${pct(a.pctUnicas)}. Meta: 0 %`, d.pctUnicas === 0 && d.personas > 0),
          indicador('Identificadores detectados', d.identificadores.columnas + d.identificadores.texto, `Antes: ${ident(a.identificadores)}`, sinIdent(d)),
          indicador('Personas conservadas', pct(r.conservadas), `${num(d.personas)} de ${num(a.personas)}. Mide utilidad`)),
        d.homogeneos.length > 0 && aviso('aviso', `${d.homogeneos.length} grupo(s) comparten un solo diagnóstico: se podría deducir. Véalos en «Detalle».`),
        h('p', { className: 'nota' }, 'k no incluye año y mes, tipo de atención, diagnóstico ni estancia. Quien conozca esos datos podría distinguir a una persona.')]],
      ['comparacion', 'Antes y después', () => [
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
            [['Referencia', ...resumen(referencia)], ['Propia', ...resumen(propia)]])]]],
      ['detalle', 'Detalle', () => [
        detalle('consulta', 'Personas por región y sexo (consulta del estudio)',
          tabla(['Región · sexo', 'Antes', 'Después', 'Diferencia'],
            r.consulta.celdas.map(c => [c.celda, num(c.antes), num(c.despues), pct(c.cambio)]))),
        detalle('homogeneos', `Grupos con un solo diagnóstico (${d.homogeneos.length})`,
          h('p', { className: 'nota' }, 'Información solo para el operador. No se envía al investigador.'),
          d.homogeneos.length
            ? tabla(['Grupo', 'Personas', 'Diagnóstico'], d.homogeneos.map(g => [g.combinacion, g.personas, `${g.diagnostico} · ${nombreCIE10(g.diagnostico)}`]))
            : h('p', {}, 'No se detectaron.')),
        detalle('controles', 'Controles para los casos especiales',
          tabla(['Control', 'Cantidad'], [
            [`Atenciones excluidas por edad fuera de ${r.cohorte.edad} (dentro del filtro de diagnóstico)`, num(r.cohorte.excluidas.edad)],
            ['Personas en el grupo 80+ en la salida', num(new Set(r.salida.filter(f => f.grupo_edad === '80+').map(f => f.id_paciente_estudio)).size)],
            ...r.recorrido.filter(o => o.operacion.startsWith('Supresión'))
              .map(o => [`Personas retiradas: ${o.operacion.toLowerCase()} (vuelta ${o.vuelta})`, num(o.personasAntes - o.personasDespues)]),
            ['Celdas de texto con identificador antes', num(a.identificadores.texto)]]))]],
    ], 'Vistas de los resultados'),
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

// ---------- 5. Publicar ----------
// TI publica el entregable al destinatario de la petición. El doctor firma y descarga desde su cuenta.
const requisitos = () => [
  ['La cohorte usa el filtro de la petición', !!S.r?.cohorte.esEstudio, ['datos', 'datos']],
  ['La ejecución es APTA', !!S.r?.apto, ['p-k', 'proteccion', 'parametros']],
];
const listoParaPublicar = () => requisitos().every(([, ok]) => ok);

// Lleva al campo que corrige un requisito, le da el foco y lo resalta un momento.
function irACampo([id, seccion, desplegable]) {
  irA(seccion);
  const d = desplegable && $(desplegable);
  if (d && !d.open) d.open = true;
  const campo = $(id);
  if (!campo || campo.disabled) return;
  campo.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  campo.focus({ preventScroll: true });
  const caja = campo.closest('label, .campo, fieldset') ?? campo;
  caja.classList.remove('resaltado');
  void caja.offsetWidth;
  caja.classList.add('resaltado');
  setTimeout(() => caja.classList.remove('resaltado'), 2500);
}

async function publicar() {
  if (!listoParaPublicar()) return;
  const r = S.r, p = S.peticion, u = sesion.actual();
  try {
    const csv = aCSV(r.columnas, r.salida), config = configuracionJSON(r);
    r.destinatario = { ...p.destinatario };
    const huellaCSV = await sha256(csv);
    const traza = await trazabilidadJSON(r, huellaCSV, await sha256(config));
    // Se guardan los archivos; el acuerdo y «entregado a» se agregan cuando el destinatario firma y descarga.
    await guardarArchivo('entrega:' + p.id, { base: r.id, ejecucionId: r.id, csv, config, traza, sha256CSV: huellaCSV,
      pta: ptaHTML(r, { riesgo: BORRADOR_RIESGO, titular: BORRADOR_TITULAR }) });
    registro.peticion(r.id, p.destinatario, new Date().toISOString());
    peticiones.publicar(p.id, { id: r.id, fecha: r.fecha, configuracion: r.config.tipo, kDespues: r.despues.kMin, personas: r.despues.personas, sha256CSV: huellaCSV }, u.usuario);
    log('peticion', 'Publicada al destinatario', `${r.id} para ${etiquetaDestinatario(p.destinatario)} · CSV SHA-256 ${huellaCSV}`, { referencia: p.id });
    notificar('ok', `Petición ${p.id} publicada. ${etiquetaDestinatario(p.destinatario)} ya puede firmar y descargar.`);
    S = inicial();
    paso = 'datos';
    pintar();
    verVista('ti-peticiones');
  } catch (e) { mostrarError(e.message, 'Publicar petición'); }
}

function panelPublicar() {
  if (!S.r) return [bloqueo('Para publicar primero necesita un resultado vigente.', 'proteccion')];
  const p = S.peticion;
  const lista = h('ul', { className: 'requisitos' }, requisitos().map(([texto, ok, destino]) => h('li', {}, ok
    ? [etiqueta('ok', 'Listo'), ' ', texto]
    : h('button', { type: 'button', className: 'requisito-pendiente', onclick: () => irACampo(destino), 'aria-label': `${texto}: falta. Ir al campo` },
      etiqueta('mal', 'Falta'), ' ', h('span', {}, texto), h('span', { className: 'ir', 'aria-hidden': 'true' }, ' Ir al campo →')))));
  return [
    datosClave([
      ['Petición', p.id],
      ['Destinatario', etiquetaDestinatario(p.destinatario)],
      ['Datos pedidos', describirFiltro(p.filtro)],
      ['Ejecución', `${S.r.id} · configuración ${S.r.config.tipo}`],
    ]),
    h('h3', {}, 'Antes de publicar'), lista,
    h('div', { className: 'acciones' },
      boton('Publicar al destinatario', publicar, { className: 'principal', id: 'publicar-boton', disabled: !listoParaPublicar() })),
    h('p', { className: 'nota' }, 'Al publicar, solo el destinatario puede ver la petición, firmar el acuerdo de confidencialidad y descargar el CSV. La configuración, la trazabilidad y el PTA quedan para TI. La huella SHA-256 del CSV se guarda para comprobar después si un archivo fue modificado o de qué entrega salió.'),
  ];
}

// ---------- Estructura del panel ----------
// Paso que todavía no se puede hacer: dice por qué y lleva al paso que falta.
const bloqueo = (mensaje, destino) => h('div', { className: 'vacio' }, h('p', { className: 'con-icono' }, icono('candado'), mensaje),
  boton(`Ir a ${nombreDestino(destino)}`, () => irA(destino), { className: 'principal' }));
const nombreDestino = id => SECCIONES.find(([s]) => s === id)?.[1] ?? { 'ti-peticiones': 'Peticiones', tablero: 'Tablero' }[id] ?? id;

const SECCIONES = [
  ['datos', '1. Datos', 'Cargue la base de datos de la petición y extraiga las personas que pide.', panelDatos,
    () => (S.cohorte ? ['ok', 'Listo'] : S.datos ? ['aviso', 'Falta extraer'] : S.revision ? ['aviso', 'Revisar columnas'] : ['neutro', 'Por hacer'])],
  ['proteccion', '2. Protección', 'Decida cómo ocultar la identidad de las personas.', panelProteccion,
    () => (S.r ? ['ok', 'Listo'] : !S.cohorte ? ['neutro', 'Bloqueado'] : S.desactualizado ? ['aviso', 'Volver a medir'] : ['aviso', 'Por hacer'])],
  ['resultados', '3. Resultados', '¿Se puede reconocer a alguien? ¿Los datos siguen siendo útiles?', panelResultados,
    () => (S.r ? (S.r.apto ? ['ok', 'Apto'] : ['mal', 'No apto']) : ['neutro', 'Pendiente'])],
  ['trazabilidad', '4. Trazabilidad', 'Qué se hizo, en qué orden y con qué resultado.', panelTraza,
    () => (S.r ? ['ok', 'Disponible'] : ['neutro', 'Pendiente'])],
  ['publicar', '5. Publicar', 'Publique el entregable al destinatario de la petición.', panelPublicar,
    () => (!S.r ? ['neutro', 'Bloqueado'] : listoParaPublicar() ? ['ok', 'Lista'] : ['aviso', 'Faltan datos'])],
];

function siguientePaso() {
  if (!S.peticion) return ['Elija una petición para procesar.', 'ti-peticiones'];
  if (S.revision) return ['Revise lo que propuso la IA y confirme.', 'datos'];
  if (!S.datos) return ['Cargue la base de datos (CSV) de la petición.', 'datos'];
  if (!S.cohorte) return ['Extraiga las personas de la petición.', 'datos'];
  if (!S.r) return ['Configure la protección y mida el resultado.', 'proteccion'];
  if (!S.r.apto) return ['Ajuste la protección: el resultado no es apto.', 'proteccion'];
  return ['Revise resultados y trazabilidad, y publique al destinatario.', 'publicar'];
}

function pintarNavegacion() {
  const [texto, destino] = siguientePaso();
  const hechos = SECCIONES.filter(([, , , , estado]) => estado()[0] === 'ok').length;
  const avance = `Avance: ${hechos} de ${SECCIONES.length}`;
  $('progreso').replaceChildren(h('label', { title: avance },
    h('span', { className: 'texto-menu' }, avance),
    h('span', { className: 'avance-corto', 'aria-hidden': 'true' }, `${hechos}/${SECCIONES.length}`),
    h('progress', { max: SECCIONES.length, value: hechos, 'aria-label': avance })));
  // Con el menú angosto quedan el ícono y la marca de estado; el nombre se ve al pasar el cursor.
  $('menu').replaceChildren(...SECCIONES.map(([id, titulo, , , estado]) => {
    const [tipo, texto] = estado(), nombre = `${titulo}: ${texto}`;
    const actual = id === paso;
    return h('li', {}, h('a', { href: '#' + id, title: nombre, 'aria-label': nombre, className: actual ? 'actual' : '',
      ...(actual ? { 'aria-current': 'step' } : {}), onclick: e => { e.preventDefault(); irA(id); } },
      icono(id),
      h('span', { className: 'texto-menu' }, h('span', {}, titulo), etiqueta(tipo, texto)),
      h('span', { className: 'marca-estado tono-' + tipo, 'aria-hidden': 'true' }, iconoEstado(tipo))));
  }));
  // replaceChildren no descarta false (lo escribiría como texto), así que el botón solo se agrega si hace falta.
  const irSiguiente = destino === paso ? [] : [boton([`Ir a ${nombreDestino(destino)}`, icono('siguiente')], () => irA(destino), { className: 'principal', id: 'ir-siguiente' })];
  $('siguiente').replaceChildren(h('span', {}, h('strong', {}, 'Siguiente paso: '), texto), ...irSiguiente);
  $('reiniciar').disabled = !S.datos && !S.revision;
  menuLateral?.recalcular();
}

// ---------- Vistas por rol ----------
const diaLocalHoy = () => diaLocal(new Date().toISOString());
const VISTAS = {
  ti: [['tablero', 'Tablero'], ['ti-peticiones', 'Peticiones'], ['proceso', 'Procesamiento'], ['ti-logs', 'Logs']],
  ce: [['ce-peticiones', 'Peticiones']],
  receptor: [['doc-peticiones', 'Mis peticiones']],
};
const VISTAS_ID = new Set(['login', 'tablero', 'ti-peticiones', 'proceso', 'ti-logs', 'ce-peticiones', 'doc-peticiones']);

function verVista(nueva) {
  if (vista === nueva) return;
  vista = nueva;
  pintar();
}

// TI empieza (o retoma) el procesamiento de una petición del comité.
async function procesarPeticion(id, continuar = false) {
  if (S.peticion?.id !== id && !await sePuedeDescartar('procesar otra petición')) return;
  try {
    let p = peticiones.obtener(id);
    if (p.estado === 'enviada') {
      p = peticiones.tomar(id, sesion.actual().usuario);
      log('peticion', 'Tomada por TI para procesar', describirFiltro(p.filtro), { referencia: id });
    }
    if (S.peticion?.id !== id) S = { ...inicial(), peticion: p, filtro: { ...p.filtro } };
    else S.peticion = p;
    vista = 'proceso';
    pintar();
    paso = '';
    irA('datos');
  } catch (e) { mostrarError(e.message, 'Procesar petición'); }
}

function pintarCabecera(u) {
  $('vistas').replaceChildren(...(u ? VISTAS[u.rol] : []).map(([id, texto]) =>
    h('button', { type: 'button', id: 'ver-' + id, ...(vista === id ? { 'aria-current': 'page' } : {}), onclick: () => irA(id) }, texto)));
  $('vistas').hidden = !u;
  $('vistas').querySelector('[aria-current="page"]')?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  $('usuario').replaceChildren(...(u ? [h('span', { className: 'usuario-nombre', title: ROLES[u.rol] }, u.nombre), h('small', {}, u.usuario)] : []));
  $('usuario').hidden = !u;
  $('cerrar-sesion').hidden = !u;
}

async function cerrarSesion() {
  if (!await sePuedeDescartar('cerrar la sesión')) return;
  log('sesion', 'Cierre de sesión', '');
  sesion.cerrar();
  S = inicial();
  reiniciarDoctor();
  vista = 'login';
  pintar();
}

function resumenEjecucion(e) {
  return datosClave([
    ['Código de ejecución', e.id],
    ['Petición dirigida a', etiquetaDestinatario(e.destinatario)],
    ['Petición de anonimización', fechaHora(e.solicitadoEn)],
    ['Elaboración del dataset', fechaHora(e.elaboradoEn)],
    ['Archivo de origen', e.archivo || '—'],
    ['Periodo de atención', e.periodo || '—'],
    ['Configuración', e.configuracion],
    ['Medición de riesgo (k)', `Antes: ${e.kAntes} · Después: ${e.kDespues} · Meta: ${e.kMeta} o más`],
    ['Personas', `Antes: ${num(e.personasAntes)} · Después: ${num(e.personasDespues)}`],
    ['Anonimizaciones aplicadas', `${e.anonimizaciones} columnas · ${num(e.celdasModificadas)} celdas modificadas`],
    ['Verificaciones', `${e.verificacionesCorrectas} de ${e.verificacionesTotal} correctas`],
    ['Estado', etiqueta(e.apto ? 'ok' : 'mal', e.apto ? 'Apto' : 'No apto')],
  ]);
}

// Detalle de una ejecución: qué columnas se anonimizaron, cuáles se conservaron y cómo se clasificó cada una.
function abrirDetalle(id) {
  const e = registro.lista().find(x => x.id === id);
  if (!e) return;
  const d = $('detalle-ejecucion');
  const cols = e.columnas ?? [];
  const anonimizadas = cols.filter(c => c.tecnica !== 'Conservar');
  const conservadas = cols.filter(c => c.tecnica === 'Conservar');
  const porClase = {};
  for (const c of cols) (porClase[c.clasificacion] ??= []).push(c.columna);
  // replaceChildren no aplana listas: se envuelve todo con h(), que sí lo hace.
  d.replaceChildren(h('div', { className: 'contenido-dialogo' },
    h('div', { className: 'cabeza-dialogo' },
      h('h2', { id: 'detalle-titulo' }, 'Detalle de la ejecución'),
      boton('Cerrar ×', () => d.close(), { className: 'cerrar-dialogo' })),
    resumenEjecucion(e),
    !cols.length
      ? aviso('aviso', 'Esta ejecución se registró antes de que el registro guardara el detalle por columna.')
      : [
        h('h3', {}, `Datos anonimizados: ${anonimizadas.filter(c => c.estado === 'Aplicada').length} columnas con cambios, de ${anonimizadas.length} con técnica de protección`),
        tablaAdaptable(['Columna', 'Clasificación', 'Categoría especial', 'Técnica', 'Cómo', 'Sale como', 'Celdas modificadas', 'Estado'],
          anonimizadas.map(c => [c.columna, c.clasificacion, c.categoria, c.tecnica, c.parametro || '—', c.salida,
            num(c.modificadas), etiqueta(c.estado === 'Aplicada' ? 'ok' : 'neutro', c.estado)])),
        h('h3', {}, `Datos conservados sin cambios (${conservadas.length} columnas)`),
        conservadas.length
          ? tablaAdaptable(['Columna', 'Clasificación', 'Categoría especial', '¿La pide el estudio?', 'Sale como'],
            conservadas.map(c => [c.columna, c.clasificacion, c.categoria, c.solicitada, c.salida]))
          : h('p', {}, 'Ninguna columna se conservó sin cambios.'),
        h('h3', {}, `Clasificación de columnas (${e.columnasClasificadas} de ${e.totalColumnas})`),
        tablaAdaptable(['Clasificación', 'Columnas', 'Total'],
          Object.entries(porClase).map(([clase, nombres]) => [clase, nombres.join(', '), nombres.length])),
      ],
    h('h3', {}, 'Descargas'),
    e.descargas.length
      ? tablaAdaptable(['Archivo', 'Fecha de entrega', 'Entregado a'], e.descargas.map(x => [x.archivo, fechaHora(x.fecha), etiquetaDestinatario(x.entregadoA)]))
      : h('p', {}, 'Este dataset no se ha descargado.'),
    h('p', { className: 'nota' }, 'Solo se muestran nombres de columnas, técnicas y conteos; nunca valores de las personas.')));
  d.showModal();
  d.scrollTop = 0;
}

// Filtros y paginación del registro (se conservan al volver al tablero).
const filtrosTablero = { peticionDesde: '', peticionHasta: '', entregaDesde: '', entregaHasta: '', texto: '' };
let paginaTablero = 1, porPaginaTablero = TAMANOS_PAGINA[0];

function filaRegistro(e) {
  const ultima = e.descargas.at(-1);
  return [
    fechaCorta(e.solicitadoEn),
    fechaCorta(e.elaboradoEn),
    etiquetaDestinatario(e.destinatario),
    e.archivo || '—',
    h('div', { className: 'celda-doble' }, etiqueta(e.kDespues >= e.kMeta ? 'ok' : 'mal', `k = ${e.kDespues}`),
      h('small', {}, `Antes ${e.kAntes} · meta ≥ ${e.kMeta}`)),
    h('div', { className: 'celda-doble' }, `${e.anonimizaciones} columnas`,
      h('small', {}, `${e.columnasClasificadas} de ${e.totalColumnas} clasificadas`)),
    etiqueta(e.apto ? 'ok' : 'mal', e.apto ? 'Apto' : 'No apto'),
    ultima
      ? h('div', { className: 'celda-doble' }, fechaCorta(ultima.fecha), h('small', {}, `a ${ultima.entregadoA?.id ?? '—'} · ${e.descargas.length} archivo(s)`))
      : etiqueta('neutro', 'Sin entrega'),
    boton('Ver detalle', () => abrirDetalle(e.id), { id: 'detalle-' + e.id, 'aria-haspopup': 'dialog', 'aria-label': `Ver detalle de ${e.id}` }),
  ];
}

function pintarResultados(caja, entradas) {
  const f = filtrosTablero;
  const rangoMal = (f.peticionDesde && f.peticionHasta && f.peticionDesde > f.peticionHasta)
    || (f.entregaDesde && f.entregaHasta && f.entregaDesde > f.entregaHasta);
  const filtradas = filtrarRegistro(entradas, f);
  const p = paginar(filtradas, paginaTablero, porPaginaTablero);
  paginaTablero = p.pagina;
  const ir = n => { paginaTablero = n; pintarResultados(caja, entradas); $('registro-tabla')?.focus(); };
  const tabla = tablaAdaptable(['Petición', 'Elaboración', 'Dirigida a', 'Archivo', 'Riesgo k', 'Anonimización', 'Estado', 'Entrega', 'Detalle'],
    p.filas.map(filaRegistro));
  tabla.classList.add('tabla-registro');
  tabla.id = 'registro-tabla';
  tabla.setAttribute('aria-label', `Registro, página ${p.pagina} de ${p.paginas}`);
  caja.replaceChildren(
    rangoMal ? aviso('mal', 'La fecha inicial no puede ser posterior a la final.') : '',
    h('p', { className: 'nota', role: 'status' }, p.total
      ? `Mostrando ${num(p.desde)}–${num(p.hasta)} de ${num(p.total)} ejecuciones${p.total < entradas.length ? ` (filtradas de ${num(entradas.length)})` : ''}.`
      : 'Ninguna ejecución coincide con la búsqueda.'),
    p.total ? tabla : '',
    h('div', { className: 'paginacion' },
      h('label', { className: 'por-pagina' }, 'Filas por página',
        h('select', { id: 'por-pagina', onchange: e => { porPaginaTablero = Number(e.target.value); paginaTablero = 1; pintarResultados(caja, entradas); } },
          TAMANOS_PAGINA.map(n => h('option', { value: n, selected: n === porPaginaTablero }, String(n))))),
      h('div', { className: 'paginas' },
        boton('Anterior', () => ir(p.pagina - 1), { id: 'pagina-anterior', disabled: p.pagina <= 1 }),
        h('span', {}, `Página ${p.pagina} de ${p.paginas}`),
        boton('Siguiente', () => ir(p.pagina + 1), { id: 'pagina-siguiente', disabled: p.pagina >= p.paginas }))));
}

function busquedaRegistro(caja, entradas) {
  const hoy = diaLocalHoy();
  const fecha = (texto, clave, opuesta, esDesde) => h('label', {}, texto,
    h('input', { type: 'date', id: 'f-' + clave, value: filtrosTablero[clave], max: hoy,
      min: esDesde ? undefined : filtrosTablero[opuesta] || undefined,
      onchange: e => {
        filtrosTablero[clave] = e.target.value; paginaTablero = 1;
        const otra = $('f-' + opuesta);
        if (otra) { if (esDesde) otra.min = e.target.value; else otra.max = e.target.value || hoy; }
        pintarResultados(caja, entradas);
      } }));
  const desdeMax = (clave, opuesta) => { const i = $('f-' + clave); if (i) i.max = filtrosTablero[opuesta] || hoy; };
  const bloque = h('fieldset', { className: 'busqueda-registro' }, h('legend', {}, 'Buscar en el registro'),
    h('div', { className: 'filtros-registro' },
      fecha('Petición desde', 'peticionDesde', 'peticionHasta', true),
      fecha('Petición hasta', 'peticionHasta', 'peticionDesde', false),
      fecha('Entrega desde', 'entregaDesde', 'entregaHasta', true),
      fecha('Entrega hasta', 'entregaHasta', 'entregaDesde', false),
      h('label', {}, 'Destinatario, archivo o código',
        h('input', { type: 'search', id: 'f-texto', value: filtrosTablero.texto, placeholder: 'Ej.: IESS-0002',
          oninput: e => { filtrosTablero.texto = e.target.value; paginaTablero = 1; pintarResultados(caja, entradas); } }))),
    boton('Limpiar búsqueda', () => { Object.keys(filtrosTablero).forEach(k => { filtrosTablero[k] = ''; }); paginaTablero = 1; pintarTablero(); },
      { id: 'limpiar-busqueda' }));
  queueMicrotask(() => { desdeMax('peticionDesde', 'peticionHasta'); desdeMax('entregaDesde', 'entregaHasta'); });
  return bloque;
}

// Tabla de entregas completadas (con búsqueda y paginación) dentro del tablero de TI.
function pintarRegistro(caja, entradas) {
  const resultados = h('div', { className: 'resultados-registro' });
  if (entradas.length) pintarResultados(resultados, entradas);
  caja.replaceChildren(...(entradas.length === 0
    ? [h('div', { className: 'vacio' }, h('p', {}, 'Todavía no hay entregas completas: aquí aparecen las peticiones que el destinatario descargó.'))]
    : [busquedaRegistro(resultados, entradas), resultados]),
  h('p', { className: 'nota' }, 'El registro no contiene datos de personas atendidas: solo fechas, identificadores de destinatarios, conteos, nombres de columnas y resultados. Por no repudio no se puede borrar ni modificar.'));
}

function pintar() {
  const u = sesion.actual();
  if (!u) vista = 'login';
  else if (!VISTAS[u.rol].some(([v]) => v === vista)) vista = VISTAS[u.rol][0][0];
  pintarCabecera(u);
  for (const id of VISTAS_ID) $(id).hidden = id !== vista;
  if (vista === 'login') return pintarLogin($('login'), () => { vista = ''; pintar(); });
  if (vista === 'tablero') return pintarTiTablero($('tablero'), { pintarRegistro, irAPeticiones: () => irA('ti-peticiones') });
  if (vista === 'ti-peticiones') return pintarTiPeticiones($('ti-peticiones'), { procesar: procesarPeticion, repintar: pintar });
  if (vista === 'ti-logs') return pintarTiLogs($('ti-logs'));
  if (vista === 'ce-peticiones') return pintarComite($('ce-peticiones'));
  if (vista === 'doc-peticiones') return pintarDoctor($('doc-peticiones'));
  pintarProceso();
}

// Solo el paso elegido; al pie, el paso anterior y el siguiente.
function pintarProceso() {
  const foco = document.activeElement?.id;
  const i = Math.max(0, SECCIONES.findIndex(([s]) => s === paso));
  const [id, titulo, descripcion, panel] = SECCIONES[i];
  paso = id;
  const contenido = panel();
  const anterior = SECCIONES[i - 1], siguiente = SECCIONES[i + 1];
  const [, destino] = siguientePaso();
  const seccion = h('section', { id, className: 'panel', 'aria-labelledby': id + '-h' },
    h('h2', { id: id + '-h', tabIndex: -1 }, titulo), h('p', { className: 'descripcion' }, descripcion),
    h('div', {}, contenido));
  // Pie fijo: si el paso siguiente todavía está bloqueado, el pie ofrece la acción que lo desbloquea
  // (la misma del panel, que se oculta para no repetirla). Si no hay acción, «Siguiente» avisa que está bloqueado.
  const bloqueado = !!siguiente && ['Bloqueado', 'Pendiente'].includes(siguiente[4]()[1]);
  const accion = ['confirmar-ia', 'extraer', 'anonimizar', 'publicar-boton'].map(x => seccion.querySelector('#' + x)).find(Boolean);
  let derecha = null;
  if (accion && (bloqueado || !siguiente)) {
    accion.hidden = true;
    derecha = boton(accion.textContent, () => accion.click(), { className: 'principal', id: accion.id + '-pie', disabled: accion.disabled });
  } else if (siguiente && bloqueado) {
    derecha = boton([icono('candado'), `Siguiente: ${siguiente[1]} (bloqueado)`], () => {}, { id: 'paso-siguiente', disabled: true,
      title: 'Primero termine este paso' });
  } else if (siguiente) {
    derecha = boton([`Siguiente: ${siguiente[1]}`, icono('siguiente')], () => irA(siguiente[0]),
      { id: 'paso-siguiente', className: destino === siguiente[0] ? 'principal' : '' });
  }
  seccion.append(h('div', { className: 'pie-paso', role: 'group', 'aria-label': 'Acciones del paso' },
    anterior ? boton([icono('anterior'), `Anterior: ${anterior[1]}`], () => irA(anterior[0]), { id: 'paso-anterior' }) : h('span'),
    derecha));
  $('contenido').replaceChildren(seccion);
  pintarNavegacion();
  if (contenido.alMontar) contenido.alMontar();
  if (foco) $(foco)?.focus?.({ preventScroll: true });
}

menuLateral = iniciarMenuLateral({ disposicion: $('proceso'), plegar: $('plegar-menu'), tirador: $('tirador-menu'), reiniciar: $('reiniciar') });
$('reiniciar').addEventListener('click', empezarDeNuevo);
$('cerrar-sesion').addEventListener('click', cerrarSesion);
$('ayuda-abrir').addEventListener('click', () => $('ayuda').showModal());
$('ayuda-cerrar').addEventListener('click', () => $('ayuda').close());
// Atajos de TI: Alt+0 abre el tablero; Alt+1…5 salta a cada paso del procesamiento.
globalThis.addEventListener?.('keydown', e => {
  if (!e.altKey || sesion.actual()?.rol !== 'ti') return;
  if (e.key === '0') { e.preventDefault(); irA('tablero'); return; }
  const seccion = SECCIONES[Number(e.key) - 1];
  if (seccion) { e.preventDefault(); irA(seccion[0]); }
});
// Evita perder el trabajo al recargar o cerrar por accidente.
globalThis.addEventListener?.('beforeunload', e => { if (S.datos || S.revision) { e.preventDefault(); e.returnValue = ''; } });

pintar();
