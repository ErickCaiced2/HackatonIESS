// Configuración, informe de trazabilidad y PTA. Solo cifras agregadas del proceso.
export const num = n => n.toLocaleString('es-EC', { maximumFractionDigits: 1 });
export const pct = n => n.toLocaleString('es-EC', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' %';
export const ident = i => `${i.columnas} columnas + ${i.texto} en texto`;

export async function sha256(texto) {
  const h = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export function configuracionJSON(r) {
  return JSON.stringify({
    id_ejecucion: r.id,
    parametros: r.config,
    columnas_salida: r.columnas,
    reglas: r.traza.map(({ variable, tecnica, parametro, columna_salida }) =>
      ({ variable, tecnica, parametro, columna_salida })),
  }, null, 2);
}

export async function trazabilidadJSON(r, huellaCSV, huellaConfig) {
  return JSON.stringify({
    id_ejecucion: r.id, fecha: r.fecha, version: r.version,
    configuracion: r.config.tipo, parametros: r.config,
    sha256_csv: huellaCSV, sha256_configuracion: huellaConfig,
    estado: r.apto ? 'APTO' : 'NO APTO',
    // Sin k ni conteos de grupos intermedios: solo personas y atenciones.
    operaciones_sobre_filas: r.recorrido.map(o => ({
      operacion: o.operacion, regla: o.regla, vuelta: o.vuelta ?? null,
      personas_antes: o.personasAntes, personas_despues: o.personasDespues,
      atenciones_antes: o.atencionesAntes, atenciones_despues: o.atencionesDespues,
    })),
    columnas: r.traza,
    verificaciones: r.verificaciones,
  }, null, 2);
}

const esc = s => String(s).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const tabla = (cab, filas) =>
  `<table><tr>${cab.map(c => `<th>${esc(c)}</th>`).join('')}</tr>${filas
    .map(f => `<tr>${f.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</table>`;

export const BORRADOR_RIESGO = 'El riesgo residual no es cero. La métrica k del reto no incluye la fecha de atención, el tipo de atención, el diagnóstico ni los días de estancia: quien conozca esos datos podría acotar a una persona. Medidas: uso exclusivo para este estudio, acceso restringido, prohibido reidentificar o cruzar con otras fuentes y publicar solo resultados agregados. El riesgo se reevalúa al menos una vez al año.';
export const BORRADOR_TITULAR = 'Se usaron datos de atenciones de salud mental de 2023 a 2025 para estudiar cómo se distribuyen por región y sexo. Se quitaron los datos que le identifican directamente, se redujo el detalle de otros y se retiraron grupos pequeños para dificultar que alguien sepa quién es usted. Ningún método elimina todo el riesgo. Sobre sus datos en el IESS conserva los derechos que reconoce la ley, entre ellos información y acceso.';

export function ptaHTML(r, { equipo, riesgo, titular, atacante = '', canal = '' }) {
  const a = r.antes, d = r.despues;
  const pasos = r.recorrido.filter(o => o.operacion.startsWith('Supresión'))
    .map(o => [o.operacion, o.regla, `${o.personasAntes} → ${o.personasDespues}`, `${o.atencionesAntes} → ${o.atencionesDespues}`]);
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>PTA R2 Equipo ${esc(equipo)}</title>
<style>body{font:14px/1.45 system-ui,sans-serif;max-width:900px;margin:24px auto;padding:0 16px}table{border-collapse:collapse;width:100%;font-size:12px}th,td{border:1px solid #888;padding:4px 6px;text-align:left}p{white-space:pre-wrap}</style></head><body>
<h1>Protocolo Técnico de Anonimización (PTA)</h1>
<p>Ejercicio académico con datos sintéticos; no sustituye la autorización de la SPDP.</p>
<h2>1. Datos generales</h2>
${tabla(['Campo', 'Valor'], [
    ['Equipo', equipo], ['Estudio', 'Distribución de la atención en salud mental en la red del IESS, 2023-2025'],
    ['Cohorte entregada', `${d.personas} personas, ${d.atenciones} atenciones`],
    ['Herramienta', `Prototipo R2 ${r.version}`], ['Configuración', r.config.tipo], ['Fecha', r.fecha.slice(0, 10)],
    ['Ejecución', r.id]])}
<h2>2. Minimización</h2>
<p>Cohorte: atenciones del capítulo F de personas de 18 años o más, entre 2023 y 2025. Se entregan: ${esc(r.columnas.join(', '))}. El resto se elimina porque el estudio no lo pide; la cédula solo sirve para unir las atenciones.</p>
<h2>3. Clasificación y técnicas por variable</h2>
${tabla(['Variable', 'Clasificación', 'Técnica', 'Parámetro', 'Justificación', 'Celdas modificadas'],
    r.traza.map(t => [t.variable, t.clasificacion, t.tecnica, t.parametro || '—', t.justificacion, t.valores_modificados]))}
<h2>4. Riesgo de reidentificación</h2>
${tabla(['Indicador', 'Antes', 'Después'], [
    ['Personas', a.personas, d.personas], ['Atenciones', a.atenciones, d.atenciones],
    ['k mínimo (meta: 5 o más)', a.kMin, d.kMin], ['Personas únicas', pct(a.pctUnicas), pct(d.pctUnicas)],
    ['Identificadores', ident(a.identificadores), ident(d.identificadores)],
    ['Personas conservadas', '100 %', pct(r.conservadas)],
    ['Cambio en la consulta: máx. / prom.', '—', `${pct(r.consulta.maximo)} / ${pct(r.consulta.promedio)}`],
    ['Grupos homogéneos en la salida', '—', d.homogeneos.length]])}
<h3>Efecto de la supresión</h3>
${tabla(['Operación', 'Regla', 'Personas', 'Atenciones'], pasos)}
<p>${r.config.l >= 2 ? `Los grupos con menos de ${r.config.l} diagnósticos distintos (3 caracteres) se suprimen.` : 'Esta configuración no trata los grupos homogéneos: solo se alertan en la pantalla del operador.'} No se detallan grupos pequeños para no revelar información sobre ellos.</p>
<h2>5. Riesgo residual y mitigación</h2><p>${esc(riesgo)}</p>
<p>Supuesto sobre quién podría intentar reidentificar: ${esc(atacante)}</p>
<h2>6. Resumen para el titular</h2><p>${esc(titular)}</p>
<p>Canal para ejercer sus derechos: ${esc(canal)}</p>
</body></html>`;
}
