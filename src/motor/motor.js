// Motor sin interfaz: carga, cohorte, anonimización, medición y trazabilidad.
import { COLUMNAS, ALIAS, IDENTIFICADORES, CUASIIDENTIFICADORES, REGIONES, VERSION } from './config.js';
import { parsearCSV } from './csv.js';
import { FILTRO_ESTUDIO, coincide, esDelEstudio, etiquetaFiltro, enPeriodo, etiquetaPeriodo, validarPeriodo,
  enRangoEdad, etiquetaEdad, validarEdad } from './cie10.js';

const distintos = arr => new Set(arr).size;
const personas = (filas, id) => distintos(filas.map(f => f[id]));
const clave = (f, cols) => JSON.stringify(cols.map(c => f[c]));

function fechaValida(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

// Los mensajes de error nunca incluyen valores de las celdas.
export function leer(texto) {
  const [encabezado, ...datos] = parsearCSV(texto);
  if (!encabezado) throw new Error('El archivo está vacío.');
  const originales = encabezado.map(c => c.trim());
  const nombres = originales.map(c => ALIAS[c] ?? c);
  if (distintos(nombres) !== nombres.length) throw new Error('Hay columnas repetidas.');
  const conocidas = COLUMNAS.map(c => c.nombre);
  const faltan = conocidas.filter(c => !nombres.includes(c));
  if (faltan.length) throw new Error('Faltan columnas: ' + faltan.join(', '));
  const sobran = nombres.length - conocidas.length;
  if (sobran) throw new Error(`Hay ${sobran} columna(s) sin clasificar.`);
  if (!datos.length) throw new Error('El archivo no tiene filas de datos.');

  const errores = {};
  const anotar = m => { errores[m] = (errores[m] ?? 0) + 1; };
  const filas = datos.map(valores => {
    if (valores.length !== nombres.length) { anotar('número de campos incorrecto'); return null; }
    const f = Object.fromEntries(nombres.map((c, i) => [c, valores[i]]));
    if (!f.cedula.trim()) anotar('cedula vacía');
    if (!/^\d+$/.test(f.edad)) anotar('edad inválida');
    if (!fechaValida(f.fecha_ingreso)) anotar('fecha_ingreso inválida');
    return f;
  });
  const resumen = Object.entries(errores).map(([m, n]) => `${m} (${n} fila/s)`);
  if (resumen.length) throw new Error('Filas inválidas: ' + resumen.join('; '));

  const avisos = originales.filter(c => ALIAS[c]).map(c => `«${c}» se trata como ${ALIAS[c]}.`);
  const nombreOriginal = Object.fromEntries(nombres.map((c, i) => [c, originales[i]]));
  return { filas, columnas: nombres, nombreOriginal, avisos, personas: personas(filas, 'cedula') };
}

// Cuántas personas daría cada filtro, con las mismas reglas de edad y periodo de la cohorte.
export function contadorPorFiltro(filas) {
  const porCodigo = new Map(); // código de 3 caracteres -> «fecha|edad» -> personas
  for (const f of filas) {
    const codigo = f.diagnostico_cie10.slice(0, 3);
    if (!porCodigo.has(codigo)) porCodigo.set(codigo, new Map());
    const grupo = porCodigo.get(codigo), clave = `${f.fecha_ingreso}|${Number(f.edad)}`;
    if (!grupo.has(clave)) grupo.set(clave, new Set());
    grupo.get(clave).add(f.cedula);
  }
  const contar = filtro => {
    const personasFiltro = new Set();
    for (const [codigo, grupo] of porCodigo) {
      if (!coincide(codigo, filtro)) continue;
      for (const [clave, ids] of grupo) {
        const [fecha, edad] = clave.split('|');
        if (enPeriodo(fecha, filtro) && enRangoEdad(edad, filtro)) for (const id of ids) personasFiltro.add(id);
      }
    }
    return personasFiltro.size;
  };
  // Códigos de 3 caracteres del archivo: alimentan las categorías fuera del capítulo V.
  contar.codigos = [...porCodigo.keys()];
  return contar;
}

export function extraerCohorte(filas, filtro = FILTRO_ESTUDIO) {
  const errorPeriodo = validarPeriodo(filtro) || validarEdad(filtro);
  if (errorPeriodo) throw new Error(errorPeriodo);
  const excluidas = { diagnostico: 0, edad: 0, periodo: 0 };
  const cohorte = filas.filter(f => {
    if (!coincide(f.diagnostico_cie10, filtro)) excluidas.diagnostico++;
    else if (!enRangoEdad(f.edad, filtro)) excluidas.edad++;
    else if (!enPeriodo(f.fecha_ingreso, filtro)) excluidas.periodo++;
    else return true;
    return false;
  });
  return {
    filas: cohorte, excluidas, entrada: filas.length,
    filtro: { ...filtro }, etiquetaFiltro: etiquetaFiltro(filtro), periodo: etiquetaPeriodo(filtro), edad: etiquetaEdad(filtro), esEstudio: esDelEstudio(filtro),
    personas: personas(cohorte, 'cedula'), atenciones: cohorte.length,
  };
}

// Combinación de cuasiidentificadores -> personas y diagnósticos (3 caracteres).
function agrupar(filas, id, qi) {
  const grupos = new Map();
  for (const f of filas) {
    const c = clave(f, qi);
    if (!grupos.has(c)) grupos.set(c, { valores: qi.map(q => f[q]), personas: new Set(), dx: new Set() });
    grupos.get(c).personas.add(f[id]);
    grupos.get(c).dx.add(f.diagnostico_cie10.slice(0, 3));
  }
  return grupos;
}

function kPorPersona(filas, id, qi) {
  const grupos = agrupar(filas, id, qi);
  const k = new Map();
  for (const g of grupos.values()) {
    for (const p of g.personas) k.set(p, Math.min(k.get(p) ?? Infinity, g.personas.size));
  }
  return { k, grupos };
}

const PATRONES = [
  /[\w.+-]+@[\w-]+(\.[\w-]+)+/,       // correo
  /HC-\d{7}/i,                        // historia clínica
  /(?<!\d)\d{10}(?!\d)/,              // cédula o teléfono
  /(?<!\d)0\d{2}[ -]\d{3}[ -]\d{4}(?!\d)/, // teléfono con separadores
];

export function contarIdentificadores(filas) {
  if (!filas.length) return { columnas: 0, texto: 0 };
  const cols = Object.keys(filas[0]);
  const resto = cols.filter(c => !IDENTIFICADORES.includes(c));
  let texto = 0;
  for (const f of filas) for (const c of resto) if (PATRONES.some(p => p.test(f[c]))) texto++;
  return { columnas: cols.filter(c => IDENTIFICADORES.includes(c)).length, texto };
}

function gruposHomogeneos(grupos, kMeta) {
  return [...grupos.values()]
    .filter(g => g.personas.size >= kMeta && g.dx.size === 1)
    .map(g => ({ combinacion: g.valores.join(' · '), personas: g.personas.size, diagnostico: [...g.dx][0] }));
}

export function medir(filas, id, kMeta = 5) {
  const qi = filas.length ? CUASIIDENTIFICADORES.filter(c => c in filas[0]) : [];
  const { k, grupos } = kPorPersona(filas, id, qi);
  const valores = [...k.values()];
  return {
    personas: k.size,
    atenciones: filas.length,
    kMin: valores.length ? valores.reduce((a, b) => Math.min(a, b)) : 0,
    pctUnicas: valores.length ? 100 * valores.filter(v => v === 1).length / valores.length : 0,
    identificadores: contarIdentificadores(filas),
    homogeneos: gruposHomogeneos(grupos, kMeta),
  };
}

const regionDe = f => f.region ?? REGIONES[f.provincia];

export function consultaEstudio(cohorte, salida) {
  const contar = (filas, id) => {
    const celdas = new Map();
    for (const f of filas) {
      const c = `${regionDe(f)} · ${f.sexo}`;
      if (!celdas.has(c)) celdas.set(c, new Set());
      celdas.get(c).add(f[id]);
    }
    return celdas;
  };
  const antes = contar(cohorte, 'cedula');
  const despues = contar(salida, 'id_paciente_estudio');
  const celdas = [...antes.keys()].sort().map(celda => {
    const a = antes.get(celda).size, d = despues.get(celda)?.size ?? 0;
    return { celda, antes: a, despues: d, cambio: 100 * Math.abs(a - d) / a };
  });
  return {
    celdas,
    maximo: Math.max(0, ...celdas.map(c => c.cambio)),
    promedio: celdas.length ? celdas.reduce((s, c) => s + c.cambio, 0) / celdas.length : 0,
  };
}

export function validarConfig(c) {
  const e = [];
  if (!Number.isInteger(c.k) || c.k < 5) e.push('k debe ser un entero de 5 o más.');
  if (!Number.isInteger(c.anchoEdad) || c.anchoEdad < ANCHO_EDAD.min || c.anchoEdad > ANCHO_EDAD.max) {
    e.push(`El rango de edad debe ser un entero entre ${ANCHO_EDAD.min} y ${ANCHO_EDAD.max} años.`);
  }
  if (!['region', 'provincia'].includes(c.ubicacion)) e.push('Ubicación inválida.');
  if (!['mes', 'anio'].includes(c.fecha)) e.push('Nivel de fecha inválido.');
  if (!Number.isInteger(c.l) || c.l < 1) e.push('l debe ser un entero de 1 o más.');
  if (c.topeEstancia !== null && (!Number.isInteger(c.topeEstancia) || c.topeEstancia < 1)) {
    e.push('El tope de estancia debe ser un entero positivo o quedar vacío.');
  }
  return e;
}

// Ancho de los grupos de edad que el operador puede elegir (en años).
export const ANCHO_EDAD = Object.freeze({ min: 5, max: 60 });

// Inicio de cada grupo de edad. Los cortes caen en múltiplos del ancho; el primer grupo empieza
// en 18 y se elige el primer corte que deja ese grupo más cercano al ancho (con 20: 18-39, 40-59,
// 60-79; con 10: 18-29, 30-39…). Un último tramo menor que medio ancho se une al anterior. 80+ aparte.
function iniciosDeEdad(ancho) {
  const m1 = Math.ceil(19 / ancho) * ancho, m2 = m1 + ancho;
  const primero = Math.abs(m1 - 18 - ancho) < Math.abs(m2 - 18 - ancho) ? m1 : m2;
  const inicios = [18];
  for (let c = primero; c < 80; c += ancho) inicios.push(c);
  if (inicios.length > 1 && 80 - inicios.at(-1) < ancho / 2) inicios.pop();
  return inicios;
}

export function grupoEdad(edad, ancho) {
  if (edad >= 80) return '80+';
  const inicios = iniciosDeEdad(ancho);
  const i = inicios.findLastIndex(x => x <= edad);
  return `${inicios[i]}-${(inicios[i + 1] ?? 80) - 1}`;
}

// Lista de grupos que produce un ancho, para mostrarla antes de proteger.
export function gruposDeEdad(ancho) {
  const grupos = [];
  for (let edad = 18; edad <= 80; edad++) {
    const g = grupoEdad(edad, ancho);
    if (grupos.at(-1) !== g) grupos.push(g);
  }
  return grupos;
}

function enteroAleatorio(n) { // uniforme en [0, n)
  const limite = Math.floor(2 ** 32 / n) * n;
  const b = new Uint32Array(1);
  do globalThis.crypto.getRandomValues(b); while (b[0] >= limite);
  return b[0] % n;
}

function barajar(lista) {
  for (let i = lista.length - 1; i > 0; i--) {
    const j = enteroAleatorio(i + 1);
    [lista[i], lista[j]] = [lista[j], lista[i]];
  }
  return lista;
}

const columnaUbicacion = c => c.ubicacion;
const columnaFecha = c => (c.fecha === 'mes' ? 'anio_mes' : 'anio');

export function columnasSalida(config) {
  return ['id_paciente_estudio', 'grupo_edad', 'sexo', columnaUbicacion(config), columnaFecha(config),
    'tipo_atencion', 'diagnostico_cie10', 'dias_estancia'];
}

// columna de entrada -> [técnica, parámetro, columna de salida]
export function plan(config) {
  const p = {
    cedula: ['Código aleatorio', 'Sin correspondencia', 'id_paciente_estudio'],
    edad: ['Generalización', `Rangos de ${config.anchoEdad} años desde 18; 80+; primera atención`, 'grupo_edad'],
    sexo: ['Conservar', '', 'sexo'],
    provincia: config.ubicacion === 'region'
      ? ['Jerarquía', 'De provincia a región', 'region'] : ['Conservar', '', 'provincia'],
    fecha_ingreso: ['Generalización', config.fecha === 'mes' ? 'AAAA-MM' : 'AAAA', columnaFecha(config)],
    tipo_atencion: ['Conservar', '', 'tipo_atencion'],
    diagnostico_cie10: ['Conservar', '', 'diagnostico_cie10'],
    dias_estancia: config.topeEstancia === null
      ? ['Conservar', '', 'dias_estancia']
      : ['Agrupar extremos', `${config.topeEstancia} días o más se agrupan como ${config.topeEstancia}+`, 'dias_estancia'],
  };
  return COLUMNAS.map(c => {
    const [tecnica, parametro, salida] = p[c.nombre] ?? ['Supresión', '', null];
    return { ...c, tecnica, parametro, salida };
  });
}

function transformar(cohorte, config) {
  const primera = new Map();
  for (const f of cohorte) {
    const previa = primera.get(f.cedula);
    const orden = x => `${x.fecha_ingreso}|${x.id_atencion}`;
    if (!previa || orden(f) < orden(previa)) primera.set(f.cedula, f);
  }
  if (config.ubicacion === 'provincia' && cohorte.some(f => f.provincia === undefined)) {
    throw new Error('El archivo solo trae región: elija Región como ubicación (provincia no está disponible).');
  }
  const sinRegion = new Set(cohorte.filter(f => !(f.region ?? REGIONES[f.provincia])).map(f => f.provincia));
  // Una provincia no es un identificador directo, pero no se repite el valor por si la celda está mal.
  if (sinRegion.size) throw new Error(`Hay ${sinRegion.size} valor(es) de provincia sin región. Revise la columna provincia.`);

  // Clave interna temporal; solo vive durante esta función y la supresión.
  const internas = new Map([...primera.keys()].map((cedula, i) => [cedula, i]));
  return cohorte.map(f => ({
    _p: internas.get(f.cedula),
    grupo_edad: grupoEdad(Number(primera.get(f.cedula).edad), config.anchoEdad),
    sexo: f.sexo,
    [columnaUbicacion(config)]: config.ubicacion === 'region' ? f.region ?? REGIONES[f.provincia] : f.provincia,
    [columnaFecha(config)]: f.fecha_ingreso.slice(0, config.fecha === 'mes' ? 7 : 4),
    tipo_atencion: f.tipo_atencion,
    diagnostico_cie10: f.diagnostico_cie10,
    dias_estancia: config.topeEstancia !== null && Number(f.dias_estancia) >= config.topeEstancia
      ? `${config.topeEstancia}+` : f.dias_estancia,
  }));
}

// Suprime por k y luego por diversidad, repitiendo hasta que no cambie nada.
function suprimir(filas, config) {
  const operaciones = [];
  const qi = ['grupo_edad', 'sexo', columnaUbicacion(config)];
  const aplicar = (malas, operacion, regla, vuelta) => {
    const antes = medir(filas, '_p', config.k);
    filas = filas.filter(f => !malas.has(f._p));
    const despues = medir(filas, '_p', config.k);
    operaciones.push({
      operacion, regla, vuelta,
      personasAntes: antes.personas, personasDespues: despues.personas,
      atencionesAntes: antes.atenciones, atencionesDespues: despues.atenciones,
      kAntes: antes.kMin, kDespues: despues.kMin,
      homogeneosAntes: antes.homogeneos.length, homogeneosDespues: despues.homogeneos.length,
    });
  };
  for (let vuelta = 1; ; vuelta++) {
    const { k } = kPorPersona(filas, '_p', qi);
    const bajoK = new Set([...k].filter(([, v]) => v < config.k).map(([p]) => p));
    // La primera pasada de k siempre se registra, aunque no retire a nadie.
    if (bajoK.size || vuelta === 1) aplicar(bajoK, 'Supresión por k', `k < ${config.k}`, vuelta);
    if (bajoK.size) continue;
    if (config.l < 2) break;
    const pocoDiversas = new Set([...agrupar(filas, '_p', qi).values()]
      .filter(g => g.dx.size < config.l).flatMap(g => [...g.personas]));
    if (pocoDiversas.size || !operaciones.some(o => o.operacion === 'Supresión por diversidad')) {
      aplicar(pocoDiversas, 'Supresión por diversidad', `l < ${config.l}`, vuelta);
    }
    if (!pocoDiversas.size) break;
  }
  return { filas, operaciones };
}

// Los códigos se asignan al final, al azar; ordenar por código también mezcla las filas.
function codificar(filas, columnas) {
  const ids = barajar([...new Set(filas.map(f => f._p))]);
  const ancho = Math.max(5, String(ids.length).length);
  const codigos = new Map(ids.map((p, i) => [p, 'P' + String(i + 1).padStart(ancho, '0')]));
  return barajar(filas.slice())
    .map(f => Object.fromEntries(columnas.map(c => [c, c === 'id_paciente_estudio' ? codigos.get(f._p) : f[c]])))
    .sort((a, b) => a.id_paciente_estudio.localeCompare(b.id_paciente_estudio));
}

function trazarColumnas(cohorte, transformadas, config, nombreOriginal) {
  return plan(config).map(c => {
    if (cohorte[0][c.nombre] === undefined) {
      const soloRegion = c.nombre === 'provincia' && cohorte[0].region !== undefined;
      return {
        columna_entrada: soloRegion ? nombreOriginal?.region ?? 'region' : 'no venía en el archivo',
        variable: c.nombre, clasificacion: c.clasificacion, categoria_especial: c.categoria || 'Ninguna',
        solicitada: c.solicitada, tecnica: soloRegion ? 'Conservar' : c.tecnica,
        parametro: soloRegion ? 'Se recibió la región ya agrupada' : c.parametro,
        columna_salida: c.salida ?? 'no sale', justificacion: c.justificacion,
        valores_modificados: 0, distintos_antes: 0,
        distintos_despues: soloRegion ? distintos(transformadas.map(f => f.region)) : 0,
        estado: soloRegion ? 'Aplicada' : 'No venía en el archivo',
      };
    }
    const antes = cohorte.map(f => f[c.nombre]);
    // El código conserva una correspondencia uno a uno durante el proceso.
    const despues = !c.salida ? []
      : transformadas.map(f => (c.salida === 'id_paciente_estudio' ? f._p : f[c.salida]));
    let cambiados;
    if (!c.salida) cambiados = antes.filter(v => v !== '').length;
    else if (c.salida === 'id_paciente_estudio') cambiados = antes.length;
    else cambiados = antes.filter((v, i) => v !== despues[i]).length;
    return {
      columna_entrada: nombreOriginal?.[c.nombre] ?? c.nombre,
      variable: c.nombre,
      clasificacion: c.clasificacion,
      categoria_especial: c.categoria || 'Ninguna',
      solicitada: c.solicitada,
      tecnica: c.tecnica,
      parametro: c.parametro,
      columna_salida: c.salida ?? 'no sale',
      justificacion: c.justificacion,
      valores_modificados: cambiados,
      distintos_antes: distintos(antes),
      distintos_despues: distintos(despues),
      estado: c.tecnica !== 'Conservar' && cambiados === 0 ? 'No fue necesaria (0 cambios)' : 'Aplicada',
    };
  });
}

export function verificar({ config, salida, columnas, traza, operaciones, despues, cohorte }) {
  const esperadas = columnasSalida(config);
  const trazadas = traza.map(t => t.columna_salida).filter(c => c !== 'no sale');
  const mismas = (a, b) => a.length === b.length && a.every(x => b.includes(x));
  let p = cohorte.personas, a = cohorte.atenciones, cuadra = true;
  for (const o of operaciones) {
    if (o.personasAntes !== p || o.atencionesAntes !== a) cuadra = false;
    p = o.personasDespues; a = o.atencionesDespues;
  }
  const v = (id, texto, ok) => ({ id, texto, ok });
  return [
    v('V-01', 'Las 28 columnas tienen registro', traza.length === COLUMNAS.length),
    v('V-02', 'Las columnas del informe son las del CSV',
      mismas(trazadas, esperadas) && mismas(columnas, esperadas)
      && salida.every(f => mismas(Object.keys(f), esperadas))),
    v('V-03', 'Ninguna transformación falló', traza.every(t => t.estado !== 'Fallida')),
    v('V-04', 'Personas y atenciones cuadran entre pasos',
      cuadra && p === despues.personas && a === salida.length),
    v('V-05', 'k mínimo de 5 o más en la salida', despues.kMin >= Math.max(5, config.k)),
    v('V-06', 'Cero identificadores directos y en texto',
      despues.identificadores.columnas === 0 && despues.identificadores.texto === 0),
    v('V-07', 'La salida no está vacía', salida.length > 0),
    v('V-08', 'Con l de 2 o más, no quedan grupos homogéneos', config.l < 2 || despues.homogeneos.length === 0),
  ];
}

// Siempre parte de la cohorte original, nunca de una salida anterior.
export function ejecutar(cohorte, config, nombreOriginal) {
  const errores = validarConfig(config);
  if (errores.length) throw new Error(errores.join(' '));
  if (!cohorte.filas.length) throw new Error('La cohorte está vacía.');

  const antes = medir(cohorte.filas, 'cedula', config.k);
  const transformadas = transformar(cohorte.filas, config);
  const traza = trazarColumnas(cohorte.filas, transformadas, config, nombreOriginal);
  const supresion = suprimir(transformadas, config);
  const columnas = columnasSalida(config);
  const salida = codificar(supresion.filas, columnas);
  const despues = medir(salida, 'id_paciente_estudio', config.k);

  const paso = (operacion, regla, pa, pd, aa, ad) =>
    ({ operacion, regla, personasAntes: pa, personasDespues: pd, atencionesAntes: aa, atencionesDespues: ad });
  const recorrido = [
    paso('Transformar columnas', 'Técnica definida para cada una de las 28 columnas',
      cohorte.personas, cohorte.personas, cohorte.atenciones, cohorte.atenciones),
    ...supresion.operaciones,
  ];
  const verificaciones = verificar({ config, salida, columnas, traza, operaciones: recorrido, despues, cohorte });
  const ahora = new Date();
  return {
    id: `R2-${ahora.toISOString().replace(/\D/g, '').slice(0, 14)}-${enteroAleatorio(1e6)}`,
    fecha: ahora.toISOString(),
    version: VERSION,
    config: { ...config },
    columnas, salida, antes, despues,
    consulta: consultaEstudio(cohorte.filas, salida),
    conservadas: 100 * despues.personas / cohorte.personas,
    cohorte: { entrada: cohorte.entrada, excluidas: cohorte.excluidas, filtro: cohorte.filtro,
      etiquetaFiltro: cohorte.etiquetaFiltro, periodo: cohorte.periodo, edad: cohorte.edad, esEstudio: cohorte.esEstudio, personas: cohorte.personas, atenciones: cohorte.atenciones },
    traza,
    recorrido: [
      paso('Cohorte', `${cohorte.etiquetaFiltro}, ${cohorte.edad}, ${cohorte.periodo}`, null, cohorte.personas, cohorte.entrada, cohorte.atenciones),
      ...recorrido,
    ],
    verificaciones,
    apto: verificaciones.every(x => x.ok),
  };
}
