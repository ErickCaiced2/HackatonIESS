// Genera bases 100 % inventadas para probar el estandarizador. No usa la base del reto.
// La misma población se escribe como si viniera de distintos orígenes.
import { mkdirSync, writeFileSync } from 'node:fs';
import { COLUMNAS, REGIONES, REFERENCIA, PROPIA } from '../src/motor/config.js';
import { leer, extraerCohorte, ejecutar } from '../src/motor/motor.js';

// Azar con semilla: siempre salen los mismos datos.
let semilla = 20261126;
const azar = () => {
  semilla = (semilla + 0x6d2b79f5) >>> 0;
  let t = semilla;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const entero = (a, b) => a + Math.floor(azar() * (b - a + 1));
const uno = lista => lista[entero(0, lista.length - 1)];

const dia = 86400000;
const iso = ms => new Date(ms).toISOString().slice(0, 10);
const fecha = (desde, hasta) => iso(Date.parse(desde) + entero(0, (Date.parse(hasta) - Date.parse(desde)) / dia) * dia);
const aniosCumplidos = (nacimiento, en) =>
  Number(en.slice(0, 4)) - Number(nacimiento.slice(0, 4)) - (en.slice(5) < nacimiento.slice(5) ? 1 : 0);
const nacidoPara = (edad, en) => {
  // Cumpleaños 30 a 330 días antes de la atención.
  const d = new Date(Date.parse(en) - entero(30, 330) * dia);
  d.setUTCFullYear(d.getUTCFullYear() - edad);
  return d.toISOString().slice(0, 10);
};

const NOMBRES = ['Alba', 'Bruno', 'Celia', 'Dario', 'Elena', 'Fabio', 'Gilda', 'Hugo', 'Irma', 'Julio'];
const APELLIDOS = ['Prueba', 'Ficticio', 'Ensayo', 'Muestra', 'Inventado', 'Simulado'];
const DX_F = ['F32.1', 'F41.1', 'F20.0', 'F43.2', 'F31.9', 'F10.2'];
const DX_OTROS = ['J06.9', 'E11.9', 'K35.8', 'A09.9', 'I10.0'];
const DX_TEXTO = { F32: 'Episodio depresivo', F41: 'Otro trastorno de ansiedad' };
const PROVINCIAS = ['Pichincha', 'Pichincha', 'Guayas', 'Guayas', 'Azuay', 'Manabí', 'Loja', 'El Oro', 'Imbabura', 'Los Ríos'];
const CANTONES = ['Canton Uno', 'Canton Dos', 'Canton Tres'];
const TIPOS = ['Consulta externa', 'Consulta externa', 'Consulta externa', 'Emergencia', 'Hospitalización'];

const filas = [];
let personas = 0;
function persona({ edad, sexo, provincia, dx, atenciones = 1, extra = {} }) {
  const n = ++personas;
  // Cédula inventada: empieza como una real, pero se completa con un contador.
  const cedula = String(uno([1, 3, 7, 9, 13, 17])).padStart(2, '0') + String(n).padStart(8, '0');
  const primera = fecha('2023-01-01', '2024-12-31');
  const nacimiento = nacidoPara(edad, primera);
  const nombres = uno(NOMBRES), apellidos = uno(APELLIDOS);
  for (let i = 0; i < atenciones; i++) {
    const ingreso = i === 0 ? primera : fecha(primera, '2025-12-31');
    const tipo = extra.tipo_atencion ?? uno(TIPOS);
    const dias = extra.dias_estancia ?? (tipo === 'Hospitalización' ? String(entero(1, 14)) : '0');
    const codigo = typeof dx === 'function' ? dx() : dx;
    filas.push({
      ...Object.fromEntries(COLUMNAS.map(c => [c.nombre, ''])),
      historia_clinica: `HC-${String(5000000 + n)}`, cedula, nombres, apellidos,
      fecha_nacimiento: nacimiento, edad: String(aniosCumplidos(nacimiento, ingreso)), sexo,
      etnia: uno(['Mestizo/a', 'Indígena', 'Montubio/a', '']), provincia, canton: uno(CANTONES),
      telefono: `0900${String(100000 + n)}`, correo: `persona${n}@correo.example`,
      tipo_seguro: 'Seguro General', discapacidad: 'Ninguna', establecimiento_id: `EST0${entero(1, 9)}`,
      tipo_establecimiento: 'Hospital General', nivel_atencion: 'II',
      fecha_ingreso: ingreso, fecha_egreso: iso(Date.parse(ingreso) + Number(dias) * dia),
      tipo_atencion: tipo, servicio: 'Servicio de prueba', diagnostico_cie10: codigo,
      diagnostico_descripcion: DX_TEXTO[codigo.slice(0, 3)] ?? 'Descripción de prueba',
      condicion_egreso: 'Alta', costo_atencion_usd: (entero(2200, 90000) / 100).toFixed(2),
      observacion: azar() < 0.3 ? 'Nota inventada de control.' : '',
      ...extra, dias_estancia: dias,
    });
  }
}

// Población general
for (let i = 0; i < 700; i++) {
  persona({
    edad: entero(19, 78), sexo: uno(['H', 'M']), provincia: uno(PROVINCIAS),
    dx: () => uno(azar() < 0.6 ? DX_F : DX_OTROS), atenciones: azar() < 0.15 ? 2 : 1,
  });
}
// Casos trampa
for (let i = 0; i < 6; i++) persona({ edad: entero(45, 55), sexo: 'H', provincia: 'Galápagos', dx: 'F10.2' }); // grupo homogéneo
persona({ edad: 104, sexo: 'M', provincia: 'Pichincha', dx: 'F32.1' });
persona({ edad: 24, sexo: 'M', provincia: 'Napo', dx: 'F41.1' }); // persona sola en la Amazonía
persona({ edad: 15, sexo: 'H', provincia: 'Guayas', dx: 'F32.1' }); // menor
persona({ edad: 35, sexo: 'H', provincia: 'Guayas', dx: 'F32.1',
  extra: { observacion: 'Nota inventada: llamar al 0900999999.' } });
persona({ edad: 50, sexo: 'M', provincia: 'Azuay', dx: 'F20.0',
  extra: { tipo_atencion: 'Hospitalización', dias_estancia: '163' } });

filas.sort((a, b) => a.fecha_ingreso.localeCompare(b.fecha_ingreso));
filas.forEach((f, i) => { f.id_atencion = `AT-${String(i + 1).padStart(6, '0')}`; });

// ---------- Orígenes ----------
const celda = (v, sep) => (v.includes(sep) || /["\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
// columnas: [nombre en el origen, campo canónico o null, función de valor]
const escribir = (columnas, sep, datos = filas) => [
  columnas.map(c => c[0]), ...datos.map((f, i) => columnas.map(([, campo, valor]) => String(valor ? valor(f, i) : f[campo]))),
].map(l => l.map(v => celda(v, sep)).join(sep)).join('\r\n') + '\r\n';

const dmy = campo => f => f[campo].split('-').reverse().join('/');
const sinTildes = s => s.normalize('NFD').replace(/\p{M}/gu, '');
const sexoMF = f => (f.sexo === 'H' ? 'M' : 'F'); // aquí M significa MASCULINO
const tipoOtro = f => ({ 'Consulta externa': 'CONSULTA', Emergencia: 'Urgencias', Hospitalización: 'Hospitalizado' }[f.tipo_atencion]);

const oficial = COLUMNAS.map(c => [c.nombre, c.nombre]);

const hospital = [
  ['NUM_REGISTRO', 'id_atencion'], ['CED_PACIENTE', 'cedula'], ['NOMBRE_COMPLETO', null, f => `${f.nombres} ${f.apellidos}`],
  ['F_NACIMIENTO', 'fecha_nacimiento', dmy('fecha_nacimiento')], ['EDAD_ANIOS', 'edad'],
  ['GENERO', 'sexo', f => (f.sexo === 'H' ? 'Masculino' : 'Femenino')],
  ['PROV_RESIDENCIA', 'provincia', f => sinTildes(f.provincia).toUpperCase()],
  ['CELULAR', 'telefono'], ['EMAIL', 'correo'],
  ['FEC_ATENCION', 'fecha_ingreso', dmy('fecha_ingreso')], ['TIPO_DE_ATENCION', 'tipo_atencion'],
  ['COD_CIE10', 'diagnostico_cie10', f => f.diagnostico_cie10.replace('.', '')], ['DIAS_HOSPITALIZADO', 'dias_estancia'],
  ['MEDICO_TRATANTE', null, () => 'Profesional Ficticio'], ['CAMA', null, (f, i) => (i % 40) + 1],
  ['OBSERVACIONES', 'observacion'],
];

const clinica = [
  ['patient_id', 'cedula'], ['birth_date', 'fecha_nacimiento'], ['gender', 'sexo', sexoMF],
  ['state', 'provincia'], ['admission_date', 'fecha_ingreso'], ['discharge_date', 'fecha_egreso'],
  ['encounter_type', 'tipo_atencion', tipoOtro], ['icd10_code', 'diagnostico_cie10', f => f.diagnostico_cie10.toLowerCase()],
  ['full_name', null, f => `${f.apellidos}, ${f.nombres}`], ['notes', 'observacion'],
];

// Solo el mínimo de 8 datos, desordenados y sin nombres con significado.
const sinNombres = [
  ['col_1', 'diagnostico_cie10'], ['col_2', 'edad'], ['col_3', 'historia_clinica'], ['col_4', 'tipo_atencion'],
  ['col_5', 'fecha_ingreso'], ['col_6', 'sexo'], ['col_7', 'dias_estancia'], ['col_8', 'provincia'],
];

const minimo = [
  ['id_persona', 'cedula'], ['edad', 'edad'], ['sexo', 'sexo'], ['provincia', 'provincia'],
  ['fecha', 'fecha_ingreso'], ['atencion', 'tipo_atencion'], ['cie10', 'diagnostico_cie10'], ['estancia', 'dias_estancia'],
];

// Columna llamada «atencion» que en realidad trae correos.
const correoDisfrazado = minimo.map(c => (c[0] === 'atencion' ? ['atencion', 'correo'] : c));
// Todas las fechas con día <= 12: no se puede saber si es DD/MM o MM/DD.
const ambiguas = filas.filter(f => Number(f.fecha_ingreso.slice(8)) <= 12);

const ARCHIVOS = [
  { archivo: '1_oficial.csv', columnas: oficial, sep: ',', esperado: 'igual', nota: 'Formato del diccionario. No debe cambiar ningún valor.' },
  { archivo: '2_hospital.csv', columnas: hospital, sep: ';', esperado: 'igual', nota: 'Punto y coma, nombres distintos, fechas DD/MM/AAAA, sexo en palabras, provincias en mayúsculas sin tildes, CIE-10 sin punto, columnas extra.' },
  { archivo: '3_clinica_ingles.tsv', columnas: clinica, sep: '\t', esperado: 'igual', nota: 'Tabulador, nombres en inglés, sin edad ni días de estancia (se derivan). M = MASCULINO y F = femenino.' },
  { archivo: '4_sin_nombres.csv', columnas: sinNombres, sep: ',', esperado: 'igual', nota: 'Solo los 8 datos mínimos, desordenados y con nombres col_N. Identificador: historia clínica.' },
  { archivo: '5_minimo.csv', columnas: minimo, sep: ',', esperado: 'igual', nota: 'Solo los 8 datos mínimos.' },
  { archivo: '6_falta_tipo.csv', columnas: minimo.filter(c => c[0] !== 'atencion'), sep: ',', esperado: 'bloquear', nota: 'Falta el tipo de atención.' },
  { archivo: '7_correo_disfrazado.csv', columnas: correoDisfrazado, sep: ',', esperado: 'bloquear', nota: 'La columna «atencion» trae correos. No puede llegar a la salida.' },
  { archivo: '8_fechas_ambiguas.csv', columnas: minimo.map(c => (c[0] === 'fecha' ? ['fecha', 'fecha_ingreso', dmy('fecha_ingreso')] : c)), sep: ',', datos: ambiguas, esperado: 'preguntar', nota: 'Todas las fechas tienen día y mes de 1 a 12. Debe preguntar el orden.' },
];

const carpeta = new URL('./datos/', import.meta.url);
mkdirSync(carpeta, { recursive: true });
for (const a of ARCHIVOS) writeFileSync(new URL(a.archivo, carpeta), escribir(a.columnas, a.sep, a.datos));

// Respuestas correctas: las calcula el motor actual sobre el formato oficial.
const base = leer(escribir(oficial, ','));
const cohorte = extraerCohorte(base.filas);
const resumir = config => {
  const r = ejecutar(cohorte, config);
  return {
    apto: r.apto, personas: r.despues.personas, atenciones: r.despues.atenciones, k_minimo: r.despues.kMin,
    identificadores: r.despues.identificadores, grupos_homogeneos: r.despues.homogeneos.length,
    conservadas_pct: +r.conservadas.toFixed(1),
    consulta_maximo_pct: +r.consulta.maximo.toFixed(1), consulta_promedio_pct: +r.consulta.promedio.toFixed(1),
  };
};
const esperado = {
  filas: base.filas.length, personas: base.personas,
  cohorte: { personas: cohorte.personas, atenciones: cohorte.atenciones },
  referencia: resumir(REFERENCIA), propia: resumir(PROPIA),
  nota: 'Con menos columnas, el k y los identificadores de «antes» pueden cambiar; la cohorte y los resultados de «después» no.',
  archivos: ARCHIVOS.map(a => ({
    archivo: a.archivo, esperado: a.esperado, nota: a.nota,
    asignaciones: Object.fromEntries(a.columnas.map(([nombre, campo]) => [nombre, campo ?? 'desconocida'])),
  })),
};
writeFileSync(new URL('respuestas.json', carpeta), JSON.stringify(esperado, null, 2));
const { archivos, ...resumen } = esperado;
console.log(JSON.stringify(resumen, null, 2));
console.log('Regiones usadas:', [...new Set(filas.map(f => REGIONES[f.provincia]))].join(', '));
console.log(archivos.map(a => `${a.archivo}: ${a.esperado}`).join('\n'));
