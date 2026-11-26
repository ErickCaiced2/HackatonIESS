// CSV separado por comas, con comillas (RFC 4180). Todo se lee como texto.
export function parsearCSV(texto) {
  const filas = [];
  let fila = [], campo = '', enComillas = false;
  const t = texto.replace(/^﻿/, '');
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (enComillas) {
      if (c !== '"') campo += c;
      else if (t[i + 1] === '"') { campo += '"'; i++; }
      else enComillas = false;
    } else if (c === '"' && campo === '') enComillas = true;
    else if (c === ',') { fila.push(campo); campo = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++;
      fila.push(campo); filas.push(fila); fila = []; campo = '';
    } else campo += c;
  }
  if (enComillas) throw new Error('CSV inválido: hay una comilla sin cerrar.');
  if (campo !== '' || fila.length) { fila.push(campo); filas.push(fila); }
  return filas.filter(f => !(f.length === 1 && f[0] === ''));
}

// Neutraliza fórmulas para quien abra el archivo en una hoja de cálculo.
function celda(v) {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function aCSV(columnas, filas) {
  return [columnas, ...filas.map(f => columnas.map(c => f[c]))]
    .map(f => f.map(celda).join(',')).join('\r\n') + '\r\n';
}
