// Reglas fijas (no son IA). Cada función devuelve el valor canónico o null; nunca adivina.
import { REGIONES } from '../motor/config.js';
import { clave } from './perfil.js';

const dos = n => String(n).padStart(2, '0');

function armarFecha(a, m, d) {
  const s = `${a}-${dos(m)}-${dos(d)}`;
  const f = new Date(s + 'T00:00:00Z');
  return !Number.isNaN(f.getTime()) && f.toISOString().slice(0, 10) === s ? s : null;
}

const ISO = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T].*)?$/;
const CORTA = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:[ T].*)?$/;

// Decide el orden mirando toda la columna.
export function ordenDeFechas(valores) {
  let primeroDia = 0, primeroMes = 0, cortas = 0;
  for (const v of valores) {
    const x = CORTA.exec(v);
    if (!x) continue;
    cortas++;
    if (Number(x[1]) > 12) primeroDia++;
    if (Number(x[2]) > 12) primeroMes++;
  }
  if (!cortas) return 'iso';
  if (primeroDia && primeroMes) return 'mezcla';
  return primeroDia ? 'dmy' : primeroMes ? 'mdy' : 'ambigua';
}

export function fecha(v, orden) {
  let x = ISO.exec(v);
  if (x) return armarFecha(x[1], Number(x[2]), Number(x[3]));
  x = CORTA.exec(v);
  if (!x || (orden !== 'dmy' && orden !== 'mdy')) return null;
  const [dia, mes] = orden === 'dmy' ? [x[1], x[2]] : [x[2], x[1]];
  return armarFecha(x[3], Number(mes), Number(dia));
}

export const aniosCumplidos = (nacimiento, en) =>
  Number(en.slice(0, 4)) - Number(nacimiento.slice(0, 4)) - (en.slice(5) < nacimiento.slice(5) ? 1 : 0);

export const entero = (v, max = Infinity) => (/^\d+$/.test(v) && Number(v) <= max ? String(Number(v)) : null);

export function cie10(v) {
  const x = /^([A-Za-z])(\d{2})(?:[ .]?(\d{1,2}))?$/.exec(v);
  return x ? x[1].toUpperCase() + x[2] + (x[3] ? '.' + x[3] : '') : null;
}

// ---------- Sexo ----------
const PALABRAS_SEXO = { hombre: 'H', masculino: 'H', male: 'H', mujer: 'M', femenino: 'M', female: 'M' };

// valores: distintos ya normalizados con clave(). Devuelve la equivalencia propuesta.
export function proponerSexo(valores) {
  const letras = new Set(valores.filter(v => ['h', 'm', 'f'].includes(v)));
  const equivalencias = {};
  for (const v of valores) if (PALABRAS_SEXO[v]) equivalencias[v] = PALABRAS_SEXO[v];
  let explicacion = '';
  if (letras.size) {
    const [h, m, f] = ['h', 'm', 'f'].map(l => letras.has(l));
    if (m && f && !h) { Object.assign(equivalencias, { m: 'H', f: 'M' }); explicacion = 'Hay M y F: aquí M significa MASCULINO.'; }
    else if (h && m && !f) { Object.assign(equivalencias, { h: 'H', m: 'M' }); explicacion = 'Hay H y M: aquí M significa MUJER.'; }
    else if (!m) {
      if (h) equivalencias.h = 'H';
      if (f) equivalencias.f = 'M';
    } else {
      if (h) equivalencias.h = 'H';
      if (f) equivalencias.f = 'M';
      explicacion = 'No se puede saber qué significa «M»: indíquelo.';
    }
  }
  return { equivalencias, pendientes: valores.filter(v => !equivalencias[v]), explicacion };
}

// ---------- Ubicación ----------
const PROVINCIAS = Object.keys(REGIONES).map(p => [clave(p), p]);
const REGIONES_CANONICAS = { costa: 'Costa', sierra: 'Sierra', amazonia: 'Amazonía', oriente: 'Amazonía', insular: 'Insular' };

function distancia(a, b) {
  let fila = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const nueva = [i];
    for (let j = 1; j <= b.length; j++) {
      nueva[j] = Math.min(nueva[j - 1] + 1, fila[j] + 1, fila[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    fila = nueva;
  }
  return fila[b.length];
}

export function provincia(v) {
  const k = clave(v);
  const exacta = PROVINCIAS.find(([p]) => p === k);
  if (exacta) return { valor: exacta[1], aproximada: false };
  if (k.length < 5) return null;
  // Error leve de tipeo con un único candidato.
  const cercanas = PROVINCIAS.filter(([p]) => distancia(k, p) <= (k.length >= 8 ? 2 : 1));
  return cercanas.length === 1 ? { valor: cercanas[0][1], aproximada: true } : null;
}

export const region = v => REGIONES_CANONICAS[clave(v)] ?? null;

// ---------- Tipo de atención ----------
const TIPOS = {
  'consulta externa': 'Consulta externa', consulta: 'Consulta externa', ambulatorio: 'Consulta externa', ambulatoria: 'Consulta externa', outpatient: 'Consulta externa',
  emergencia: 'Emergencia', emergencias: 'Emergencia', urgencia: 'Emergencia', urgencias: 'Emergencia', emergency: 'Emergencia',
  hospitalizacion: 'Hospitalización', hospitalizado: 'Hospitalización', internacion: 'Hospitalización', 'ingreso hospitalario': 'Hospitalización', inpatient: 'Hospitalización',
};
export const TIPOS_CANONICOS = ['Consulta externa', 'Emergencia', 'Hospitalización'];
export const tipoAtencion = v => TIPOS[clave(v)] ?? null;
