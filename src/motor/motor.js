// Motor sin interfaz: carga, cohorte, anonimización, medición y trazabilidad.
import { COLUMNAS, ALIAS, IDENTIFICADORES, CUASIIDENTIFICADORES, REGIONES, VERSION } from './config.js';
import { parsearCSV } from './csv.js';
import { FILTRO_ESTUDIO, coincide, esDelEstudio, etiquetaFiltro } from './cie10.js';

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
  const porCodigo = new Map();
  for (const f of filas) {
    if (Number(f.edad) < 18 || f.fecha_ingreso < '2023-01-01' || f.fecha_ingreso > '2025-12-31') continue;
    const codigo = f.diagnostico_cie10.slice(0, 3);
    if (!porCodigo.has(codigo)) porCodigo.set(codigo, new Set());
    porCodigo.get(codigo).add(f.cedula);
  }
  return filtro => {
    const personasFiltro = new Set();
    for (const [codigo, ids] of porCodigo) {
      if (coincide(codigo, filtro)) for (const id of ids) personasFiltro.add(id);
    }
    return personasFiltro.size;
  };
}

export function extraerCohorte(filas, filtro = FILTRO_ESTUDIO) {
  const excluidas = { diagnostico: 0, menor: 0, periodo: 0 };
  const cohorte = filas.filter(f => {
    if (!coincide(f.diagnostico_cie10, filtro)) excluidas.diagnostico++;
    else if (Number(f.edad) < 18) excluidas.menor++;
    else if (f.fecha_ingreso < '2023-01-01' || f.fecha_ingreso > '2025-12-31') excluidas.periodo++;
    else return true;
    return false;
  });
  return {
    filas: cohorte, excluidas, entrada: filas.length,
    filtro: { ...filtro }, etiquetaFiltro: etiquetaFiltro(filtro), esEstudio: esDelEstudio(filtro),
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
  if (![10, 20].includes(c.anchoEdad)) e.push('El rango de edad debe ser de 10 o 20 años.');
  if (!['region', 'provincia'].includes(c.ubicacion)) e.push('Ubicación inválida.');
  if (!['mes', 'anio'].includes(c.fecha)) e.push('Nivel de fecha inválido.');
  if (!Number.isInteger(c.l) || c.l < 1) e.push('l debe ser un entero de 1 o más.');
  if (c.topeEstancia !== null && (!Number.isInteger(c.topeEstancia) || c.topeEstancia < 1)) {
    e.push('El tope de estancia debe ser un entero positivo o quedar vacío.');
  }
  return e;
}

export function grupoEdad(edad, ancho) {
  if (edad >= 80) return '80+';
  const inicio = ancho === 20
    ? (edad < 40 ? 18 : edad < 60 ? 40 : 60)
    : (edad < 30 ? 18 : Math.floor(edad / 10) * 10);
  const fin = ancho === 20 ? (inicio === 18 ? 39 : inicio + 19) : (inicio === 18 ? 29 : inicio + 9);
  return `${inicio}-${fin}`;
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
      ? ['Jerarquía', 'Provincia → región', 'region'] : ['Conservar', '', 'provincia'],
    fecha_ingreso: ['Generalización', config.fecha === 'mes' ? 'AAAA-MM' : 'AAAA', columnaFecha(config)],
    tipo_atencion: ['Conservar', '', 'tipo_atencion'],
    diagnostico_cie10: ['Conservar', '', 'diagnostico_cie10'],
    dias_estancia: config.topeEstancia === null
      ? ['Conservar', '', 'dias_estancia']
      : ['Agrupar extremos', `${config.topeEstancia} o más → ${config.topeEstancia}+`, 'dias_estancia'],
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
  const sinRegion = new Set(cohorte.filter(f => !REGIONES[f.provincia]).map(f => f.provincia));
  // Una provincia no es un identificador directo, pero no se repite el valor por si la celda está mal.
  if (sinRegion.size) throw new Error(`Hay ${sinRegion.size} valor(es) de provincia sin región. Revise la columna provincia.`);

  // Clave interna temporal; solo vive durante esta función y la supresión.
  const internas = new Map([...primera.keys()].map((cedula, i) => [cedula, i]));
  return cohorte.map(f => ({
    _p: internas.get(f.cedula),
    grupo_edad: grupoEdad(Number(primera.get(f.cedula).edad), config.anchoEdad),
    sexo: f.sexo,
    [columnaUbicacion(config)]: config.ubicacion === 'region' ? REGIONES[f.provincia] : f.provincia,
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
    paso('Transformar columnas', 'Ver detalle por columna',
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
      etiquetaFiltro: cohorte.etiquetaFiltro, esEstudio: cohorte.esEstudio, personas: cohorte.personas, atenciones: cohorte.atenciones },
    traza,
    recorrido: [
      paso('Cohorte', `${cohorte.etiquetaFiltro}, 18 años o más, 2023-2025`, null, cohorte.personas, cohorte.entrada, cohorte.atenciones),
      ...recorrido,
    ],
    verificaciones,
    apto: verificaciones.every(x => x.ok),
  };
}
