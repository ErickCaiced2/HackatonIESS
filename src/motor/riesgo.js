// Pruebas de ataque sobre la salida anonimizada. Solo devuelven conteos y porcentajes: nunca datos de personas.
//
// 1. Riesgo de trayectoria: un atacante que conoce la edad, el sexo y la región de alguien, y además 1 o 2 de sus
//    atenciones (mes y tipo, por ejemplo «hospitalizado en marzo de 2024»), ¿entre cuántas personas lo encuentra?
//    La k del reto no lo mide porque no incluye la fecha ni el tipo de atención.
// 2. Prueba de enlace: un registro auxiliar con edad exacta, sexo y provincia (como un padrón o redes sociales)
//    se cruza con los datos antes y después de proteger. Mide cuántas personas quedarían reidentificadas.
import { REGIONES } from './config.js';

const UMBRAL = 5; // riesgo aceptable: el atacante duda entre al menos 5 personas

const pct = (n, d) => (d ? (100 * n) / d : 0);
const columnaFecha = salida => (salida[0] && 'anio_mes' in salida[0] ? 'anio_mes' : 'anio');
const columnaUbicacion = salida => (salida[0] && 'provincia' in salida[0] ? 'provincia' : 'region');

// ---------- 1. Trayectoria ----------
export function riesgoTrayectoria(salida) {
  if (!salida.length) return { personas: 0, conocida1: resumen([]), conocida2: resumen([]) };
  const fecha = columnaFecha(salida), ubic = columnaUbicacion(salida);
  const personas = new Map(); // id -> { demo, atenciones: Set }
  for (const f of salida) {
    const p = personas.get(f.id_paciente_estudio) ?? { demo: `${f.grupo_edad}|${f.sexo}|${f[ubic]}`, atenciones: new Set() };
    p.atenciones.add(`${f[fecha]}|${f.tipo_atencion}`);
    personas.set(f.id_paciente_estudio, p);
  }
  // Índices por grupo demográfico: atención -> personas, par de atenciones -> personas.
  const uno = new Map(), dos = new Map();
  const sumar = (mapa, clave, id) => mapa.set(clave, (mapa.get(clave) ?? new Set()).add(id));
  for (const [id, p] of personas) {
    const lista = [...p.atenciones].sort();
    lista.forEach((a, i) => {
      sumar(uno, `${p.demo}#${a}`, id);
      for (const b of lista.slice(i + 1)) sumar(dos, `${p.demo}#${a}#${b}`, id);
    });
  }
  const k1 = [], k2 = [];
  for (const p of personas.values()) {
    const lista = [...p.atenciones].sort();
    k1.push(Math.min(...lista.map(a => uno.get(`${p.demo}#${a}`).size)));
    // Con una sola atención, conocer «dos» equivale a conocer una.
    let m = k1.at(-1);
    lista.forEach((a, i) => { for (const b of lista.slice(i + 1)) m = Math.min(m, dos.get(`${p.demo}#${a}#${b}`).size); });
    k2.push(m);
  }
  return { personas: personas.size, conocida1: resumen(k1), conocida2: resumen(k2) };
}

function resumen(ks) {
  return {
    kMin: ks.length ? Math.min(...ks) : 0,
    enRiesgo: ks.filter(k => k < UMBRAL).length,
    pctEnRiesgo: pct(ks.filter(k => k < UMBRAL).length, ks.length),
    unicas: ks.filter(k => k === 1).length,
  };
}

// ---------- 2. Enlace con un registro auxiliar ----------
// registro: [{ edad, sexo, provincia | region, ref? }]. Si no se pasa, se simula con las personas de la cohorte
// (el peor caso: el atacante sabe que su objetivo está en el estudio).
export function pruebaEnlace(cohorteFilas, salida, config, grupoEdad, registro = null) {
  const primera = new Map();
  for (const f of cohorteFilas) {
    const previa = primera.get(f.cedula);
    if (!previa || `${f.fecha_ingreso}|${f.id_atencion}` < `${previa.fecha_ingreso}|${previa.id_atencion}`) primera.set(f.cedula, f);
  }
  const simulado = !registro;
  const objetivos = simulado
    ? [...primera.values()].map(f => ({ edad: f.edad, sexo: f.sexo, provincia: f.provincia, region: f.region, ref: f.cedula }))
    : registro;
  const regionDe = o => o.region ?? REGIONES[o.provincia];

  // Antes: los datos originales con edad exacta, sexo y provincia.
  const antes = new Map();
  for (const f of primera.values()) {
    const c = `${f.edad}|${f.sexo}|${f.provincia ?? f.region}`;
    antes.set(c, (antes.get(c) ?? 0) + 1);
  }
  // Después: lo que el atacante ve en la salida (grupo de edad, sexo, región o provincia).
  const ubic = columnaUbicacion(salida);
  const despues = new Map();
  const vistas = new Set();
  for (const f of salida) {
    if (vistas.has(f.id_paciente_estudio)) continue;
    vistas.add(f.id_paciente_estudio);
    const c = `${f.grupo_edad}|${f.sexo}|${f[ubic]}`;
    despues.set(c, (despues.get(c) ?? 0) + 1);
  }
  let unicosAntes = 0, esperadoAntes = 0, unicosDespues = 0, esperadoDespues = 0, sinCoincidencia = 0;
  for (const o of objetivos) {
    const nA = antes.get(`${o.edad}|${o.sexo}|${o.provincia ?? o.region}`) ?? 0;
    if (nA === 1) unicosAntes++;
    if (nA) esperadoAntes += 1 / nA;
    const ubicacion = ubic === 'provincia' ? o.provincia : regionDe(o);
    const nD = despues.get(`${grupoEdad(Number(o.edad), config.anchoEdad)}|${o.sexo}|${ubicacion}`) ?? 0;
    if (!nD) { sinCoincidencia++; continue; }
    if (nD === 1) unicosDespues++;
    esperadoDespues += 1 / nD;
  }
  const n = objetivos.length;
  return {
    simulado, registros: n,
    antes: { unicos: unicosAntes, pctUnicos: pct(unicosAntes, n), reidentificacionEsperada: pct(esperadoAntes, n) },
    // Con el registro simulado, «sin coincidencia» son personas retiradas por la protección.
    despues: { unicos: unicosDespues, pctUnicos: pct(unicosDespues, n), reidentificacionEsperada: pct(esperadoDespues, n), sinCoincidencia },
  };
}

// En los datos del estudio H es hombre y M es mujer.
const SEXOS = { h: 'H', hombre: 'H', masculino: 'H', male: 'H', m: 'M', mujer: 'M', f: 'M', femenino: 'M', female: 'M' };
const sexoCanonico = v => SEXOS[String(v).trim().toLowerCase()] ?? String(v).trim().toUpperCase();

// Lee un registro auxiliar (CSV ya separado en filas): necesita edad, sexo y provincia o región.
export function registroDesdeFilas([cabecera, ...filas]) {
  const nombres = cabecera.map(c => c.trim().toLowerCase());
  const col = (...opciones) => opciones.map(o => nombres.indexOf(o)).find(i => i >= 0) ?? -1;
  const iEdad = col('edad'), iSexo = col('sexo'), iProv = col('provincia'), iReg = col('region', 'región');
  const faltan = [iEdad < 0 && 'edad', iSexo < 0 && 'sexo', iProv < 0 && iReg < 0 && 'provincia o región'].filter(Boolean);
  if (faltan.length) throw new Error(`Al registro auxiliar le faltan columnas: ${faltan.join(', ')}.`);
  return filas.filter(f => f.length === cabecera.length).map(f => ({
    edad: f[iEdad].trim(), sexo: sexoCanonico(f[iSexo]),
    provincia: iProv >= 0 ? f[iProv].trim() : undefined, region: iReg >= 0 ? f[iReg].trim() : undefined,
  }));
}
