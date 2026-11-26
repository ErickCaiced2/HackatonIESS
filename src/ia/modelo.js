// Regresión logística multiclase (softmax). Solo predice; no aprende de los archivos cargados.
import { perfilar } from './perfil.js';
import MODELO from './pesos.js';

export const VERSION_MODELO = MODELO.version;

export function probabilidades(rasgos, pesos, sesgos) {
  const z = sesgos.map((b, c) => rasgos.reduce((s, [i, v]) => s + pesos[c][i] * v, b));
  const max = Math.max(...z);
  const e = z.map(x => Math.exp(x - max));
  const total = e.reduce((a, b) => a + b, 0);
  return e.map(x => x / total);
}

export function predecir(nombre, valores) {
  const rasgos = perfilar(nombre, valores);
  const p = probabilidades(rasgos, MODELO.pesos, MODELO.sesgos);
  const orden = p.map((valor, i) => [MODELO.clases[i], valor]).sort((a, b) => b[1] - a[1]);
  const clase = MODELO.clases.indexOf(orden[0][0]);
  // Señales: las características que más sumaron a la clase elegida.
  const senales = [...new Set(rasgos.map(([i, v, texto]) => [MODELO.pesos[clase][i] * v, texto])
    .filter(([aporte]) => aporte > 0).sort((a, b) => b[0] - a[0]).map(([, texto]) => texto))].slice(0, 3);
  return { clase: orden[0][0], confianza: orden[0][1], segunda: orden[1][0], confianzaSegunda: orden[1][1], senales, orden };
}
