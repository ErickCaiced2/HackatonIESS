// Entrena el clasificador, lo evalúa y guarda los pesos. Uso: node entrenamiento/entrenar.js
import { writeFileSync } from 'node:fs';
import { perfilar, DIMENSION, normalizarNombre } from '../src/ia/perfil.js';
import { crearAzar, ejemplos, NOMBRES, NOMBRES_EVALUACION } from './generar.js';

const clases = Object.keys(NOMBRES);
const datos = ejemplos({ porClase: 260, semilla: 7, nombres: NOMBRES, decorar: true })
  .map(e => ({ y: clases.indexOf(e.clase), x: perfilar(e.nombre, e.valores).map(([i, v]) => [i, v]) }));

const pesos = clases.map(() => new Float64Array(DIMENSION));
const sesgos = new Array(clases.length).fill(0);
const { entero } = crearAzar(11);
const EPOCAS = 40, L2 = 2e-5;
for (let epoca = 0; epoca < EPOCAS; epoca++) {
  const tasa = 0.2 / (1 + epoca * 0.12);
  for (let i = datos.length - 1; i > 0; i--) { const j = entero(0, i); [datos[i], datos[j]] = [datos[j], datos[i]]; }
  let perdida = 0;
  for (const { x, y } of datos) {
    const z = pesos.map((w, c) => { let s = sesgos[c]; for (const [i, v] of x) s += w[i] * v; return s; });
    const max = Math.max(...z);
    const e = z.map(v => Math.exp(v - max));
    const total = e.reduce((a, b) => a + b, 0);
    perdida -= Math.log(e[y] / total + 1e-12);
    for (let c = 0; c < clases.length; c++) {
      const g = e[c] / total - (c === y ? 1 : 0);
      if (Math.abs(g) < 1e-4) continue;
      sesgos[c] -= tasa * g;
      for (const [i, v] of x) pesos[c][i] -= tasa * (g * v + L2 * pesos[c][i]);
    }
  }
  if (epoca % 10 === 9) console.log(`época ${epoca + 1}: pérdida ${(perdida / datos.length).toFixed(4)}`);
}

const redondear = v => Math.round(v * 1000) / 1000;
const modelo = {
  version: 'softmax-1.0', clases,
  sesgos: sesgos.map(redondear), pesos: pesos.map(w => Array.from(w, redondear)),
};
writeFileSync(new URL('../src/ia/pesos.js', import.meta.url),
  '// Generado por entrenamiento/entrenar.js con datos inventados. No editar a mano.\nexport default ' + JSON.stringify(modelo) + ';\n');

// ---------- Evaluación con nombres no vistos ----------
const { predecir } = await import('../src/ia/modelo.js');
const ESENCIALES = ['cedula', 'edad', 'sexo', 'provincia', 'fecha_ingreso', 'tipo_atencion', 'diagnostico_cie10', 'dias_estancia'];
const SENSIBLES = ['historia_clinica', 'cedula', 'nombres', 'apellidos', 'telefono', 'correo', 'observacion'];
const DE_SALIDA = ['edad', 'sexo', 'provincia', 'region', 'fecha_ingreso', 'tipo_atencion', 'diagnostico_cie10', 'dias_estancia'];
const diccionario = new Map(Object.entries(NOMBRES).flatMap(([c, l]) => l.split('|').map(n => [normalizarNombre(n), c])));

function evaluar(nombre, casos) {
  let bien = 0, base = 0, esencialesBien = 0, esenciales = 0, criticos = 0, altas = 0, altasBien = 0;
  for (const caso of casos) {
    const p = predecir(caso.nombre, caso.valores);
    const ok = p.clase === caso.clase;
    bien += ok;
    base += (diccionario.get(normalizarNombre(caso.nombre)) ?? 'desconocida') === caso.clase;
    if (ESENCIALES.includes(caso.clase)) { esenciales++; esencialesBien += ok; }
    if (SENSIBLES.includes(caso.clase) && DE_SALIDA.includes(p.clase)) criticos++;
    if (p.confianza >= 0.85) { altas++; altasBien += ok; }
  }
  const pct = (a, b) => (b ? (100 * a / b).toFixed(1) + ' %' : '—');
  return { conjunto: nombre, columnas: casos.length, aciertos: pct(bien, casos.length), esenciales: pct(esencialesBien, esenciales),
    lineaBaseDiccionario: pct(base, casos.length), confianzaAlta: pct(altas, casos.length), aciertoConConfianzaAlta: pct(altasBien, altas),
    erroresCriticosAntesDeGuardas: criticos };
}

const informe = {
  version: modelo.version, ejemplosEntrenamiento: datos.length,
  advertencia: 'Todo es sintético y del mismo generador de valores: sobrestima el rendimiento con bases reales.',
  evaluaciones: [
    evaluar('nombres no vistos', ejemplos({ porClase: 20, semilla: 99, nombres: NOMBRES_EVALUACION, decorar: false })),
    evaluar('nombres de entrenamiento con ruido y columnas sin nombre', ejemplos({ porClase: 20, semilla: 1234, nombres: NOMBRES, decorar: true })),
  ],
};
writeFileSync(new URL('./evaluacion.json', import.meta.url), JSON.stringify(informe, null, 2));
console.log(JSON.stringify(informe, null, 2));
