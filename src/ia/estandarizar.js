// Lee cualquier texto delimitado, pide la propuesta a la IA y produce los datos canónicos.
// Los mensajes nunca incluyen valores de identificadores ni de texto libre.
import { COLUMNAS, ALIAS } from '../motor/config.js';
import { parsearCSV } from '../motor/csv.js';
import { predecir, VERSION_MODELO } from './modelo.js';
import { clave, normalizarNombre, RE } from './perfil.js';
import * as N from './normalizar.js';

export const UMBRAL_ALTO = 0.85;
export const UMBRAL_BAJO = 0.5;
export const CAMPOS = [...COLUMNAS.map(c => c.nombre), 'region'];
const NOMBRE_SEPARADOR = { ',': 'coma', ';': 'punto y coma', '\t': 'tabulador', '|': 'barra vertical' };

// Los 8 datos mínimos y sus alternativas.
export const MINIMOS = [
  { dato: 'Identificador estable de la persona', opciones: ['cedula', 'historia_clinica'] },
  { dato: 'Edad (o fecha de nacimiento)', opciones: ['edad', 'fecha_nacimiento'] },
  { dato: 'Sexo', opciones: ['sexo'] },
  { dato: 'Ubicación: provincia o región', opciones: ['provincia', 'region'] },
  { dato: 'Fecha de atención o ingreso', opciones: ['fecha_ingreso'] },
  { dato: 'Tipo de atención', opciones: ['tipo_atencion'] },
  { dato: 'Diagnóstico CIE-10 (código)', opciones: ['diagnostico_cie10'] },
  { dato: 'Días de estancia (o fecha de egreso)', opciones: ['dias_estancia', 'fecha_egreso'] },
];

function detectarSeparador(texto) {
  const muestra = texto.slice(0, 20000).split(/\r?\n/).slice(0, 20).join('\n');
  const candidatos = Object.keys(NOMBRE_SEPARADOR).map(sep => {
    try {
      const filas = parsearCSV(muestra, sep);
      const n = filas[0]?.length ?? 0;
      const iguales = filas.filter(f => f.length === n).length / (filas.length || 1);
      return { sep, n, nota: n > 1 ? iguales * 1000 + n : 0 };
    } catch { return { sep, n: 0, nota: 0 }; }
  }).sort((a, b) => b.nota - a.nota);
  if (!candidatos[0].nota) throw new Error('No se reconoce el separador. Use coma, punto y coma, tabulador o barra vertical.');
  return candidatos[0].sep;
}

export function analizar(texto) {
  if (texto.startsWith('PK')) throw new Error('Parece un archivo de Excel. Guárdelo como CSV y vuelva a cargarlo.');
  const separador = detectarSeparador(texto);
  const [encabezado, ...filas] = parsearCSV(texto, separador);
  if (!filas.length) throw new Error('El archivo no tiene filas de datos.');
  const nombres = encabezado.map(c => c.trim());
  // Si el encabezado parece contener datos, se detiene sin mostrarlo.
  if (nombres.some(n => RE.correo.test(n) || RE.diezDigitos.test(n) || RE.fecha.test(n) || RE.hc.test(n) || RE.cie.test(n) && n.includes('.'))) {
    throw new Error('La primera fila parece contener datos y no nombres de columnas. Agregue un encabezado.');
  }
  const malas = filas.filter(f => f.length !== nombres.length).length;
  if (malas) throw new Error(`Filas inválidas: número de campos incorrecto (${malas} fila/s).`);
  const valores = nombres.map((_, i) => filas.map(f => f[i].trim()));

  const columnas = nombres.map((nombre, i) => {
    const p = predecir(nombre, valores[i]);
    // Un nombre idéntico al diccionario no necesita al modelo; las guardas igual revisan los valores.
    const oficial = ALIAS[nombre] ?? (CAMPOS.includes(nombre) ? nombre : null);
    return {
      indice: i, nombre,
      propuesta: oficial ?? (p.confianza >= UMBRAL_BAJO ? p.clase : 'desconocida'),
      origen: oficial ? 'nombre oficial' : 'modelo',
      confianza: oficial ? 1 : p.confianza,
      modelo: { clase: p.clase, confianza: p.confianza, segunda: p.segunda, confianzaSegunda: p.confianzaSegunda },
      senales: oficial ? ['el nombre coincide con el diccionario'] : p.senales,
    };
  });

  // Una sola columna por campo: gana la de mayor confianza y la otra queda por revisar.
  for (const campo of CAMPOS) {
    const rivales = columnas.filter(c => c.propuesta === campo).sort((a, b) => b.confianza - a.confianza);
    for (const perdedora of rivales.slice(1)) {
      perdedora.propuesta = 'desconocida';
      perdedora.conflicto = campo;
    }
  }
  sugerirMinimos(columnas);
  return { separador, nombreSeparador: NOMBRE_SEPARADOR[separador], nombres, valores, filas: filas.length, columnas };
}

// Si falta un dato mínimo, sugiere el mejor candidato. La sugerencia SIEMPRE exige revisión.
function sugerirMinimos(columnas) {
  const asignada = campo => columnas.find(c => c.propuesta === campo);
  const sugerir = (c, campo) => { c.propuesta = campo; c.sugerida = true; };
  // Una fecha de egreso sin fecha de ingreso no sirve: probablemente es la de atención.
  if (!asignada('fecha_ingreso') && asignada('fecha_egreso')) {
    const c = asignada('fecha_egreso');
    if (c.origen === 'modelo') sugerir(c, 'fecha_ingreso');
  }
  for (const m of MINIMOS) {
    if (m.opciones.some(asignada)) continue;
    const candidata = columnas
      .filter(c => c.propuesta === 'desconocida' && c.origen === 'modelo' && m.opciones.includes(c.modelo.clase) && c.modelo.confianza >= 0.3)
      .sort((a, b) => b.modelo.confianza - a.modelo.confianza)[0];
    if (candidata) sugerir(candidata, candidata.modelo.clase);
  }
}

export const decisionesIniciales = a => ({
  asignacion: a.columnas.map(c => c.propuesta),
  revisadas: new Set(),
  ordenFecha: {}, sexo: {}, tipo: {},
});

export const necesitaRevision = c => !!c.sugerida ||
  c.origen === 'modelo' && (c.confianza < UMBRAL_ALTO || !!c.conflicto) && c.propuesta !== 'desconocida' || !!c.conflicto;

export function estandarizar(a, d) {
  const problemas = [], preguntas = [], notas = [], cambios = [];
  const col = {};
  d.asignacion.forEach((campo, i) => {
    if (campo === 'desconocida') return;
    if (campo in col) problemas.push(`Dos columnas están asignadas a «${campo}». Deje solo una.`);
    else col[campo] = i;
  });
  for (const m of MINIMOS) {
    if (!m.opciones.some(o => o in col)) problemas.push(`Falta un dato mínimo: ${m.dato}.`);
  }
  const porRevisar = a.columnas.filter(c => necesitaRevision(c) && !d.revisadas.has(c.indice)).length;
  if (porRevisar) problemas.push(`Faltan ${porRevisar} columna(s) dudosa(s) por revisar.`);
  if (problemas.length) return { problemas, preguntas, notas, cambios, datos: null };

  const idDeHistoria = !('cedula' in col);
  const salida = Object.fromEntries(Object.entries(col).map(([campo, i]) => [campo, a.valores[i].slice()]));
  const nombreOriginal = Object.fromEntries(Object.entries(col).map(([campo, i]) => [campo, a.nombres[i]]));

  // Convierte una columna; si algún valor no se puede, bloquea e informa solo la cantidad.
  const convertir = (campo, regla, convertidor) => {
    let invalidos = 0, modificados = 0;
    salida[campo] = salida[campo].map(v => {
      const x = convertidor(v);
      if (x === null) { invalidos++; return v; }
      if (x !== v) modificados++;
      return x;
    });
    if (invalidos) problemas.push(`La columna asignada a «${campo}» tiene ${invalidos} valor(es) vacío(s) o que no cumplen: ${regla}.`);
    if (modificados) cambios.push({ campo, regla, modificados });
  };

  for (const campo of ['fecha_ingreso', 'fecha_nacimiento', 'fecha_egreso']) {
    if (!(campo in salida)) continue;
    // Las fechas opcionales que no se usan para derivar se eliminan: no se exigen.
    const usada = campo === 'fecha_ingreso' || (campo === 'fecha_nacimiento' && !('edad' in col)) || (campo === 'fecha_egreso' && !('dias_estancia' in col));
    if (!usada) continue;
    let orden = N.ordenDeFechas(salida[campo]);
    if (orden === 'mezcla') { problemas.push(`«${campo}» mezcla día/mes y mes/día. Puede ser un archivo de varios orígenes: cárguelos por separado.`); continue; }
    if (orden === 'ambigua') {
      preguntas.push({ tipo: 'fecha', campo, columna: nombreOriginal[campo] });
      orden = d.ordenFecha[campo];
      if (!orden) { problemas.push(`Indique el orden de las fechas de «${campo}».`); continue; }
    }
    convertir(campo, 'fecha válida en formato AAAA-MM-DD', v => N.fecha(v, orden));
  }

  if ('edad' in salida) convertir('edad', 'entero de 0 a 120', v => N.entero(v, 120));
  if ('dias_estancia' in salida) convertir('dias_estancia', 'entero de 0 o más', v => N.entero(v, 3650));
  convertir('diagnostico_cie10', 'código CIE-10', N.cie10);

  // Sexo: siempre se muestra la equivalencia para confirmarla.
  {
    const unicos = [...new Set(salida.sexo.map(clave))];
    const validos = unicos.filter(v => /^(h|m|f|1|2|hombre|mujer|masculino|femenino|male|female)$/.test(v));
    if (validos.length !== unicos.length) {
      problemas.push(`La columna asignada a «sexo» tiene ${salida.sexo.filter(v => !validos.includes(clave(v))).length} valor(es) que no son un sexo reconocido.`);
    } else {
      const propuesta = N.proponerSexo(unicos);
      const mapa = { ...propuesta.equivalencias, ...d.sexo };
      preguntas.push({ tipo: 'sexo', columna: nombreOriginal.sexo, valores: unicos, mapa, explicacion: propuesta.explicacion });
      if (unicos.some(v => !mapa[v])) problemas.push('Indique qué significa cada valor de la columna de sexo.');
      else convertir('sexo', 'H (hombre) o M (mujer)', v => mapa[clave(v)]);
    }
  }

  let aproximadas = 0;
  if ('provincia' in salida) {
    convertir('provincia', 'una de las 24 provincias', v => {
      const x = N.provincia(v);
      if (x?.aproximada) aproximadas++;
      return x?.valor ?? null;
    });
    if (aproximadas) notas.push(`${aproximadas} provincia(s) con errores leves se corrigieron por aproximación. Compruébelo.`);
    delete salida.region; // la región se calcula de la provincia
  } else convertir('region', 'Costa, Sierra, Amazonía o Insular', N.region);

  {
    const desconocidos = [...new Set(salida.tipo_atencion.filter(v => !N.tipoAtencion(v)))];
    // Solo se muestran valores si son pocas categorías cortas, nunca datos que parezcan personales.
    const sePuedenMostrar = desconocidos.length && desconocidos.length <= 6
      && desconocidos.every(v => /^[\p{L} .-]{1,30}$/u.test(v));
    if (sePuedenMostrar) preguntas.push({ tipo: 'tipo', columna: nombreOriginal.tipo_atencion, valores: desconocidos, mapa: d.tipo });
    convertir('tipo_atencion', 'Consulta externa, Emergencia u Hospitalización',
      v => N.tipoAtencion(v) ?? (sePuedenMostrar ? d.tipo[v] ?? null : null));
  }

  // Identificador de la persona (nunca se genera a partir del número de fila).
  if (idDeHistoria) {
    salida.cedula = salida.historia_clinica;
    delete salida.historia_clinica;
    nombreOriginal.cedula = nombreOriginal.historia_clinica;
    delete nombreOriginal.historia_clinica;
    notas.push('No hay cédula: se usa la historia clínica para unir atenciones. Confirme que cada persona tiene una sola; si tiene varias, k parecerá mayor de lo real.');
  }
  const sinId = salida.cedula.filter(v => v === '').length;
  if (sinId) problemas.push(`Hay ${sinId} fila(s) sin identificador de persona.`);
  if (!idDeHistoria) {
    const nueve = salida.cedula.filter(v => /^\d{9}$/.test(v)).length;
    if (nueve) {
      salida.cedula = salida.cedula.map(v => (/^\d{9}$/.test(v) ? '0' + v : v));
      cambios.push({ campo: 'cedula', regla: 'reponer el cero inicial', modificados: nueve });
      notas.push(`${nueve} cédula(s) de 9 dígitos: se repuso el cero inicial.`);
    }
  }
  if (problemas.length) return { problemas, preguntas, notas, cambios, datos: null };

  const derivados = [];
  if (!('edad' in salida)) {
    salida.edad = salida.fecha_ingreso.map((f, i) => String(N.aniosCumplidos(salida.fecha_nacimiento[i], f)));
    const raras = salida.edad.filter(e => Number(e) < 0 || Number(e) > 120).length;
    if (raras) problemas.push(`Hay ${raras} edad(es) calculadas fuera de 0-120. Revise las fechas.`);
    derivados.push({ campo: 'edad', desde: 'fecha_nacimiento y fecha_ingreso' });
    nombreOriginal.edad = 'calculada desde las fechas';
  }
  if (!('dias_estancia' in salida)) {
    salida.dias_estancia = salida.fecha_ingreso.map((f, i) => String(Math.round((Date.parse(salida.fecha_egreso[i]) - Date.parse(f)) / 86400000)));
    const negativas = salida.dias_estancia.filter(x => Number(x) < 0).length;
    if (negativas) problemas.push(`Hay ${negativas} atención(es) con egreso anterior al ingreso.`);
    derivados.push({ campo: 'dias_estancia', desde: 'fecha_egreso y fecha_ingreso' });
    nombreOriginal.dias_estancia = 'calculada desde las fechas';
  }
  if (!('id_atencion' in salida)) {
    salida.id_atencion = salida.edad.map((_, i) => `AT-${String(i + 1).padStart(6, '0')}`);
    derivados.push({ campo: 'id_atencion', desde: 'orden de las filas' });
    nombreOriginal.id_atencion = 'generada por orden de fila';
  }
  if (problemas.length) return { problemas, preguntas, notas, cambios, datos: null };

  const columnas = CAMPOS.filter(c => c in salida);
  const filas = salida.id_atencion.map((_, i) => Object.fromEntries(columnas.map(c => [c, salida[c][i]])));
  const eliminadas = d.asignacion.filter(c => c === 'desconocida').length;
  if (eliminadas) notas.push(`${eliminadas} columna(s) sin correspondencia se eliminan.`);

  // Solo se registra el nombre original de las columnas que se usan. El resto se elimina y un nombre
  // podría contener información personal (incluso si el modelo clasificó mal la columna).
  const usados = new Set([...MINIMOS.flatMap(m => m.opciones), 'id_atencion']);
  for (const campo of Object.keys(nombreOriginal)) if (!usados.has(campo)) nombreOriginal[campo] = campo;
  const asignaciones = a.columnas.map(c => {
    const final = d.asignacion[c.indice];
    const usada = usados.has(final);
    return {
      columna_original: usada ? c.nombre : `columna ${c.indice + 1}`,
      campo: final,
      decidio: final !== c.propuesta ? 'corregido por la persona' : c.origen === 'modelo' ? 'modelo, confirmado' : 'nombre oficial',
      confianza_modelo: c.origen === 'modelo' ? Math.round(c.modelo.confianza * 1000) / 1000 : null,
      senales: !usada ? [] : c.senales.filter(s => !s.startsWith('el nombre')),
    };
  });

  const datos = {
    filas, columnas, nombreOriginal, avisos: notas,
    personas: new Set(salida.cedula).size,
    estandarizacion: {
      modelo: VERSION_MODELO, separador: a.nombreSeparador, columnas_de_entrada: a.columnas.length,
      asignaciones, cambios_de_formato: cambios, derivados,
      equivalencia_sexo: preguntas.find(p => p.tipo === 'sexo')?.mapa ?? null,
    },
  };
  return { problemas, preguntas, notas, cambios, datos };
}

export { normalizarNombre };
