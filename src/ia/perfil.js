// Convierte una columna (nombre + valores) en características numéricas para el modelo.
// El resultado no contiene ningún valor de las celdas.
import { REGIONES } from '../motor/config.js';

export const clave = s => String(s).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim().replace(/\s+/g, ' ');

export const CATALOGOS = {
  sexo: new Set(['h', 'm', 'f', 'hombre', 'mujer', 'masculino', 'femenino', 'male', 'female']),
  provincia: new Set(Object.keys(REGIONES).map(clave)),
  region: new Set(['costa', 'sierra', 'amazonia', 'insular', 'oriente', 'galapagos region']),
  etnia: new Set(['mestizo/a', 'mestizo', 'mestiza', 'indigena', 'montubio/a', 'montubio', 'afroecuatoriano/a', 'afroecuatoriano', 'blanco/a', 'blanco', 'otro']),
  tipoAtencion: new Set(['consulta externa', 'consulta', 'ambulatorio', 'ambulatoria', 'emergencia', 'emergencias', 'urgencia', 'urgencias', 'hospitalizacion', 'hospitalizado', 'internacion', 'ingreso hospitalario', 'outpatient', 'emergency', 'inpatient']),
  discapacidad: new Set(['ninguna', 'fisica', 'intelectual', 'auditiva', 'visual', 'psicosocial']),
  egreso: new Set(['alta', 'referido', 'fallecido', 'transferido']),
  nivel: new Set(['i', 'ii', 'iii']),
};

export const RE = {
  correo: /^[\w.+-]+@[\w-]+(\.[\w-]+)+$/,
  hc: /^hc-?\d{4,}$/i,
  atencion: /^(at|aten|reg)-?\d{3,}$/i,
  fecha: /^(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{4})([ T].*)?$/,
  cie: /^[A-TV-Z]\d{2}([ .]?\d{1,2})?$/i,
  diezDigitos: /^\d{10}$/,
  entero: /^\d+$/,
  decimal: /^\d+[.,]\d+$/,
  establecimiento: /^est-?\d+$/i,
};

const SIN_SIGNIFICADO = /^(col|column|columna|campo|field|var|variable|dato|x|v|c|f|a)?\s?\d*$/;

export const normalizarNombre = n => clave(String(n)
  .replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[^\p{L}\p{N}]+/gu, ' '));

const DIM_NOMBRE = 512;
function dispersar(s) {
  let x = 2166136261;
  for (let i = 0; i < s.length; i++) x = Math.imul(x ^ s.charCodeAt(i), 16777619);
  return (x >>> 0) % DIM_NOMBRE;
}

// Máximo de filas para el perfil (muestra repartida). Las guardas revisan TODAS las filas.
const MUESTRA = 2000;

export const NOMBRES_CONTENIDO = [
  'columna vacía en parte', 'proporción de enteros', 'proporción de decimales', 'proporción de fechas', 'fechas anteriores a 2020',
  'fechas desde 2020', 'valores de 10 dígitos', 'parecen teléfonos', 'parecen correos', 'parecen historias clínicas',
  'parecen códigos CIE-10', 'códigos de salud mental', 'valores de sexo', 'nombres de provincias', 'nombres de regiones',
  'valores de etnia', 'tipos de atención', 'tipos de discapacidad', 'condiciones de egreso', 'niveles I, II, III',
  'códigos de atención', 'códigos de establecimiento', 'textos de varias palabras', 'textos largos', 'valores muy variados',
  'pocos valores distintos', 'muchos ceros', 'enteros de edad (0 a 105)', 'media de los enteros', 'enteros mayores de 110',
  'palabras con mayúscula', 'dos o tres palabras con mayúscula', 'frases con punto final', 'columna sin datos',
];

function contenido(valores) {
  const paso = Math.max(1, Math.floor(valores.length / MUESTRA));
  const muestra = [];
  for (let i = 0; i < valores.length; i += paso) muestra.push(valores[i]);
  const llenos = muestra.map(v => String(v ?? '').trim()).filter(v => v !== '');
  const n = llenos.length;
  const prop = f => (n ? llenos.filter(f).length / n : 0);
  const en = cat => prop(v => CATALOGOS[cat].has(clave(v)));
  const anios = llenos.filter(v => RE.fecha.test(v)).map(v => Number(v.match(/\d{4}/)[0]));
  const enteros = llenos.filter(v => RE.entero.test(v) && v.length < 6).map(Number);
  const media = enteros.length ? enteros.reduce((a, b) => a + b, 0) / enteros.length : 0;
  const distintos = new Set(llenos).size;
  return [
    muestra.length ? 1 - n / muestra.length : 1,
    prop(v => RE.entero.test(v) && v.length < 6),
    prop(v => RE.decimal.test(v)),
    prop(v => RE.fecha.test(v)),
    anios.length ? anios.filter(a => a < 2020).length / anios.length : 0,
    anios.length ? anios.filter(a => a >= 2020).length / anios.length : 0,
    prop(v => RE.diezDigitos.test(v)),
    prop(v => /^09\d{8}$/.test(v)),
    prop(v => RE.correo.test(v)),
    prop(v => RE.hc.test(v)),
    prop(v => RE.cie.test(v)),
    prop(v => /^f\d{2}/i.test(v) && RE.cie.test(v)),
    en('sexo'), en('provincia'), en('region'), en('etnia'), en('tipoAtencion'), en('discapacidad'), en('egreso'), en('nivel'),
    prop(v => RE.atencion.test(v)),
    prop(v => RE.establecimiento.test(v)),
    prop(v => v.split(/\s+/).length >= 2),
    n ? Math.min(1, llenos.reduce((a, v) => a + v.length, 0) / n / 40) : 0,
    n ? distintos / n : 0,
    n && distintos <= 12 ? 1 : 0,
    prop(v => v === '0'),
    enteros.length === n && n && Math.max(...enteros.slice(0, 5000)) <= 105 ? 1 : 0,
    Math.min(1, media / 100),
    enteros.length ? enteros.filter(v => v > 110).length / enteros.length : 0,
    prop(v => /^\p{Lu}[\p{Ll}]+$/u.test(v)),
    prop(v => /^\p{Lu}[\p{Ll}]+,?( \p{Lu}[\p{Ll}]+){1,3}$/u.test(v)),
    prop(v => /\s.*\.$/.test(v)),
    n ? 0 : 1,
  ];
}

export const DIMENSION = DIM_NOMBRE + 1 + NOMBRES_CONTENIDO.length;

// Devuelve [indice, valor, explicación] solo para las características activas.
export function perfilar(nombre, valores) {
  const salida = [];
  const limpio = normalizarNombre(nombre);
  if (SIN_SIGNIFICADO.test(limpio)) salida.push([DIM_NOMBRE, 1, 'el nombre no dice nada']);
  else {
    const piezas = new Map();
    for (const palabra of limpio.split(' ')) {
      piezas.set('palabra:' + palabra, `el nombre contiene «${palabra}»`);
      const p = `^${palabra}$`;
      for (const largo of [3, 4]) {
        for (let i = 0; i + largo <= p.length; i++) {
          const g = p.slice(i, i + largo);
          piezas.set(g, `el nombre se parece por «${g.replace(/[\^$]/g, '')}»`);
        }
      }
    }
    const peso = 3 / Math.sqrt(piezas.size);
    for (const [g, texto] of piezas) salida.push([dispersar(g), peso, texto]);
  }
  contenido(valores).forEach((v, i) => {
    if (v) salida.push([DIM_NOMBRE + 1 + i, v * 1.5, 'contenido: ' + NOMBRES_CONTENIDO[i]]);
  });
  return salida;
}
