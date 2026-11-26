// Todos los datos de estas pruebas son inventados aquí mismo.
import test from 'node:test';
import assert from 'node:assert/strict';
import { COLUMNAS, REFERENCIA, PROPIA } from '../src/motor/config.js';
import { aCSV, parsearCSV } from '../src/motor/csv.js';
import { leer, extraerCohorte, contadorPorFiltro, medir, ejecutar, grupoEdad, validarConfig } from '../src/motor/motor.js';
import { ptaHTML, trazabilidadJSON, configuracionJSON } from '../src/motor/entregables.js';
import { sintetico } from './sintetico.js';
import { nombreCIE10, CATEGORIAS_F, BLOQUES_F, CAPITULOS, bloquesDe, categoriasDe } from '../src/motor/cie10.js';
import { zip } from '../src/motor/zip.js';

const preparar = () => {
  const datos = leer(sintetico());
  return { datos, cohorte: extraerCohorte(datos.filas) };
};

test('carga: acepta id_hc, conserva ceros iniciales y nombra la columna que falta', () => {
  const { datos } = preparar();
  assert.equal(datos.avisos.length, 1);
  assert.ok(datos.filas[0].cedula.startsWith('0'));
  const sinSexo = aCSV(COLUMNAS.map(c => c.nombre).filter(c => c !== 'sexo'), [{}]);
  assert.throws(() => leer(sinSexo), /Faltan columnas: sexo/);
});

test('carga: los errores no repiten valores de las celdas', () => {
  const malo = sintetico().replace('2023-01-01', 'SECRETO');
  assert.throws(() => leer(malo), e => /fecha_ingreso inválida/.test(e.message) && !e.message.includes('SECRETO'));
});

test('CSV: comillas, comas, saltos de línea y neutralización de fórmulas', () => {
  const t = aCSV(['a', 'b'], [{ a: 'x,"y"\nz', b: '=1+1' }]);
  assert.deepEqual(parsearCSV(t)[1], ['x,"y"\nz', "'=1+1"]);
});

test('cohorte: exclusiones que cuadran', () => {
  const { cohorte } = preparar();
  const x = cohorte.excluidas;
  assert.deepEqual(x, { diagnostico: 1, menor: 2, periodo: 1 });
  assert.equal(cohorte.entrada - x.diagnostico - x.menor - x.periodo, cohorte.atenciones);
});

test('grupos de edad', () => {
  assert.deepEqual([18, 39, 40, 60, 79, 80, 104].map(e => grupoEdad(e, 20)),
    ['18-39', '18-39', '40-59', '60-79', '60-79', '80+', '80+']);
  assert.deepEqual([18, 29, 30, 79].map(e => grupoEdad(e, 10)), ['18-29', '18-29', '30-39', '70-79']);
});

test('antes: k cuenta personas y detecta identificadores en texto', () => {
  const m = medir(preparar().cohorte.filas, 'cedula');
  assert.equal(m.kMin, 1);
  assert.equal(m.identificadores.columnas, 6);
  assert.equal(m.identificadores.texto, 1);
});

test('referencia: suprime a quien queda solo, alerta el homogéneo y queda APTA', () => {
  const { datos, cohorte } = preparar();
  const r = ejecutar(cohorte, REFERENCIA, datos.nombreOriginal);
  assert.equal(cohorte.personas, 19);
  assert.equal(r.despues.personas, 18);
  assert.equal(r.despues.kMin, 6);
  assert.deepEqual(r.despues.identificadores, { columnas: 0, texto: 0 });
  assert.equal(r.despues.homogeneos.length, 1);
  assert.ok(!r.salida.some(f => f.region === 'Insular' || f.grupo_edad === '80+'));
  assert.equal(r.consulta.maximo, 100);
  assert.ok(r.apto);
  assert.equal(r.traza.length, 28);
  assert.equal(r.traza.find(t => t.variable === 'historia_clinica').columna_entrada, 'id_hc');
});

test('el grupo de edad sale de la primera atención y es igual en todas las filas', () => {
  const r = ejecutar(preparar().cohorte, REFERENCIA);
  const porPersona = new Map();
  for (const f of r.salida) porPersona.set(f.id_paciente_estudio,
    (porPersona.get(f.id_paciente_estudio) ?? new Set()).add(f.grupo_edad));
  assert.ok([...porPersona.values()].every(s => s.size === 1));
  assert.ok(r.salida.some(f => f.grupo_edad === '18-39' && f.anio_mes === '2025-12'));
});

test('propia: quita el grupo homogéneo y agrupa estancias extremas', () => {
  const r = ejecutar(preparar().cohorte, PROPIA);
  assert.equal(r.despues.homogeneos.length, 0);
  assert.equal(r.despues.personas, 12);
  assert.ok(r.salida.some(f => f.dias_estancia === '30+'));
  assert.ok(r.apto);
});

test('una salida vacía no es APTA', () => {
  const r = ejecutar(preparar().cohorte, { ...REFERENCIA, tipo: 'propia', k: 100 });
  assert.equal(r.salida.length, 0);
  assert.equal(r.apto, false);
});

test('configuración: no admite k menor que 5', () => {
  assert.ok(validarConfig({ ...REFERENCIA, k: 4 }).length);
});

test('códigos aleatorios: las métricas se repiten y los códigos no dependen del orden', () => {
  const { cohorte } = preparar();
  const a = ejecutar(cohorte, REFERENCIA), b = ejecutar(cohorte, REFERENCIA);
  assert.deepEqual(a.despues, b.despues);
  const firma = r => r.salida.map(f => Object.values(f).join()).join(';');
  assert.notEqual(firma(a), firma(b));
});

test('sin fugas: informe, configuración, PTA y CSV no llevan marcadores', async () => {
  const r = ejecutar(preparar().cohorte, REFERENCIA);
  const salidas = [
    await trazabilidadJSON(r, 'x', 'y'), configuracionJSON(r),
    ptaHTML(r, { equipo: '01', riesgo: 'texto', titular: '<script>' }), aCSV(r.columnas, r.salida),
  ].join('\n');
  for (const marcador of ['MARCADOR', '0999999999', '0000000001', 'HC-0000001']) {
    assert.ok(!salidas.includes(marcador), marcador);
  }
  assert.ok(!salidas.includes('<script>'));
});

test('CIE-10: el filtro del estudio, un grupo, una categoría y otro capítulo', () => {
  const { datos } = preparar();
  const con = (capitulo, bloque = '', categoria = '') =>
    extraerCohorte(datos.filas, { capitulo, bloque, categoria });
  assert.equal(con('V').atenciones, 20);
  assert.ok(con('V').esEstudio);
  assert.deepEqual([...new Set(con('V', 'F10-F19').filas.map(f => f.diagnostico_cie10))], ['F10.2']);
  assert.equal(con('V', '', 'F10').personas, 6);
  assert.equal(con('V', '', 'F10').esEstudio, false);
  assert.equal(con('X').atenciones, 1);
  assert.equal(nombreCIE10('F32.1'), 'Episodio depresivo');
  assert.ok(Object.keys(CATEGORIAS_F).every(c => BLOQUES_F.some(b => c >= b.desde && c <= b.hasta)));
});

test('ZIP: firma, número de archivos y contenido', () => {
  const z = zip([['a.txt', 'hola'], ['b.txt', 'ñandú']]);
  assert.deepEqual([...z.slice(0, 4)], [0x50, 0x4b, 3, 4]);
  assert.equal(z[z.length - 12], 2);
  assert.ok(new TextDecoder().decode(z).includes('ñandú'));
});

test('filtro: el conteo previo coincide con la cohorte y marca las opciones sin datos', () => {
  const { datos } = preparar();
  const contar = contadorPorFiltro(datos.filas);
  for (const [capitulo, bloque, categoria] of [['V', '', ''], ['V', 'F10-F19', ''], ['V', '', 'F20'], ['X', '', ''], ['I', '', '']]) {
    const filtro = { capitulo, bloque, categoria };
    assert.equal(contar(filtro), extraerCohorte(datos.filas, filtro).personas);
  }
  assert.equal(contar({ capitulo: 'V', bloque: '', categoria: 'F20' }), 0);
});

test('filtro: cada capítulo tiene grupos dentro de su rango y categorías que dependen del grupo', () => {
  for (const c of CAPITULOS) {
    const grupos = bloquesDe(c.id);
    assert.ok(grupos.length > 0, c.id);
    assert.ok(grupos.every(b => b.desde >= c.desde && b.hasta <= c.hasta && b.desde <= b.hasta), c.id);
  }
  const { datos } = preparar();
  const contar = contadorPorFiltro(datos.filas);
  // Fuera del capítulo V, las categorías salen de los códigos del archivo.
  assert.deepEqual(categoriasDe('X', '', contar.codigos).map(([c]) => c), ['J06']);
  assert.deepEqual(categoriasDe('X', 'J00-J06', contar.codigos).map(([c]) => c), ['J06']);
  assert.deepEqual(categoriasDe('X', 'J09-J18', contar.codigos), []);
  assert.deepEqual(categoriasDe('IV', '', contar.codigos), []);
  // En el capítulo V se usa el catálogo y se acota al grupo.
  assert.ok(categoriasDe('V', 'F10-F19').every(([c]) => c >= 'F10' && c <= 'F19'));
  // El conteo por grupo de otro capítulo coincide con la cohorte.
  for (const filtro of [{ capitulo: 'X', bloque: 'J00-J06', categoria: '' }, { capitulo: 'X', bloque: 'J00-J06', categoria: 'J06' }, { capitulo: 'IV', bloque: 'E10-E14', categoria: '' }]) {
    assert.equal(contar(filtro), extraerCohorte(datos.filas, filtro).personas);
  }
  assert.equal(contar({ capitulo: 'X', bloque: 'J00-J06', categoria: '' }), 1);
});
