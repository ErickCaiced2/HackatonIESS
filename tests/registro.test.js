// Registro del tablero: solo metadatos, nunca datos de personas.
import test from 'node:test';
import assert from 'node:assert/strict';
import { REFERENCIA } from '../src/motor/config.js';
import { leer, extraerCohorte, ejecutar } from '../src/motor/motor.js';
import { crearRegistro, entradaDeEjecucion, resumenRegistro } from '../src/motor/registro.js';
import { sintetico } from './sintetico.js';

const ejecucion = () => {
  const datos = leer(sintetico());
  return { datos, r: ejecutar(extraerCohorte(datos.filas), REFERENCIA, datos.nombreOriginal) };
};

test('registro: la entrada resume petición, k, anonimizaciones, clasificación y fechas', () => {
  const { r } = ejecucion();
  const e = entradaDeEjecucion(r, { archivo: 'prueba.csv', solicitadoEn: '2026-01-01T00:00:00.000Z' });
  assert.equal(e.id, r.id);
  assert.equal(e.solicitadoEn, '2026-01-01T00:00:00.000Z');
  assert.equal(e.elaboradoEn, r.fecha);
  assert.equal(e.kAntes, r.antes.kMin);
  assert.equal(e.kDespues, r.despues.kMin);
  assert.equal(e.kMeta, REFERENCIA.k);
  assert.equal(e.totalColumnas, 28);
  assert.equal(e.columnasClasificadas, 28);
  assert.ok(e.anonimizaciones > 0);
  assert.equal(e.anonimizaciones, Object.values(e.tecnicas).reduce((a, n) => a + n, 0));
  assert.deepEqual(e.descargas, []);
});

test('registro: no guarda cédulas ni valores de la salida', () => {
  const { datos, r } = ejecucion();
  const texto = JSON.stringify(entradaDeEjecucion(r, { archivo: 'prueba.csv' }));
  for (const f of datos.filas.slice(0, 50)) assert.ok(!texto.includes(f.cedula));
  assert.ok(!texto.includes(r.salida[0].id_paciente_estudio));
});

test('registro: guarda ejecuciones y descargas en el almacén, la más reciente primero', () => {
  const m = new Map();
  const almacen = { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: k => m.delete(k) };
  const reg = crearRegistro(almacen);
  assert.equal(reg.persistente, true);
  const { r } = ejecucion();
  const a = { ...entradaDeEjecucion(r), id: 'A', apto: true };
  const b = { ...entradaDeEjecucion(r), id: 'B', apto: false };
  reg.agregar(a); reg.agregar(b);
  assert.deepEqual(reg.lista().map(e => e.id), ['B', 'A']);
  assert.equal(reg.descarga('A', 'R2_Equipo07_paquete.zip', '2026-02-02T10:00:00.000Z'), true);
  assert.equal(reg.descarga('X', 'otro.zip'), false);
  // Otro registro sobre el mismo almacén ve lo guardado.
  const t = resumenRegistro(crearRegistro(almacen).lista());
  assert.equal(t.ejecuciones, 2);
  assert.equal(t.aptas, 1);
  assert.equal(t.descargas, 1);
  assert.equal(t.ultimaDescarga.fecha, '2026-02-02T10:00:00.000Z');
  // No repudio: no existe forma de borrar y una ejecución registrada no se reemplaza.
  assert.equal('borrar' in reg, false);
  assert.equal(reg.agregar({ ...a, apto: false }), false);
  assert.equal(reg.lista().find(e => e.id === 'A').apto, true);
  assert.equal(reg.lista().length, 2);
});

test('registro: guarda el detalle por columna (anonimizadas y clasificación) sin valores', () => {
  const { datos, r } = ejecucion();
  const e = entradaDeEjecucion(r);
  assert.equal(e.columnas.length, 28);
  assert.ok(e.columnas.every(c => c.columna && c.clasificacion && c.tecnica && c.salida));
  assert.equal(e.columnas.filter(c => c.tecnica !== 'Conservar' && c.estado === 'Aplicada').length, e.anonimizaciones);
  assert.equal(e.columnas.find(c => c.columna === 'cedula').salida, 'id_paciente_estudio');
  const texto = JSON.stringify(e.columnas);
  for (const f of datos.filas.slice(0, 50)) for (const v of [f.cedula, f.nombres, f.telefono]) if (v) assert.ok(!texto.includes(v), v);
});

test('registro: sin almacén usa memoria y lo indica', () => {
  const reg = crearRegistro(null);
  assert.equal(reg.persistente, false);
  reg.agregar({ id: 'A', descargas: [], anonimizaciones: 1, apto: true });
  assert.equal(reg.lista().length, 1);
});

test('destinatario: licencia del MSP o identificador IESS, y la entrega debe ser a la misma persona', async () => {
  const { validarDestinatario, mismoDestinatario } = await import('../src/motor/destinatario.js');
  assert.equal(validarDestinatario({ tipo: 'iess', id: 'IESS-0002' }), '');
  assert.equal(validarDestinatario({ tipo: 'iess', id: ' iess-0002 ' }), '');
  assert.match(validarDestinatario({ tipo: 'iess', id: 'IESS-2' }), /Formato no válido/);
  assert.equal(validarDestinatario({ tipo: 'msp', id: '1720-2015-123456' }), '');
  assert.match(validarDestinatario({ tipo: 'msp', id: 'ABC' }), /Formato no válido/);
  assert.match(validarDestinatario({ tipo: 'msp', id: '' }), /Escriba/);
  assert.ok(mismoDestinatario({ tipo: 'iess', id: 'iess-0002' }, { tipo: 'iess', id: 'IESS-0002' }));
  assert.equal(mismoDestinatario({ tipo: 'iess', id: 'IESS-0003' }, { tipo: 'iess', id: 'IESS-0002' }), false);
  assert.equal(mismoDestinatario({ tipo: 'msp', id: '0002' }, { tipo: 'iess', id: '0002' }), false);
});

test('registro: guarda destinatario de la petición y a quién se entregó', async () => {
  const { trazabilidadJSON, acuerdoTexto } = await import('../src/motor/entregables.js');
  const { r } = ejecucion();
  r.destinatario = { tipo: 'iess', id: 'IESS-0002' };
  const reg = crearRegistro(null);
  reg.agregar(entradaDeEjecucion(r));
  reg.descarga(r.id, 'paquete.zip', '2026-03-01T12:00:00.000Z', { tipo: 'iess', id: 'IESS-0002' });
  const e = reg.lista()[0];
  assert.deepEqual(e.destinatario, { tipo: 'iess', id: 'IESS-0002' });
  assert.deepEqual(e.descargas[0].entregadoA, { tipo: 'iess', id: 'IESS-0002' });
  const traza = JSON.parse(await trazabilidadJSON(r, 'a', 'b', null, { tipo: 'iess', id: 'IESS-0002' }));
  assert.deepEqual(traza.destinatario_peticion, r.destinatario);
  assert.deepEqual(traza.entregado_a, { tipo: 'iess', id: 'IESS-0002' });
  assert.match(acuerdoTexto(r.id, 'x', r.destinatario), /Destinatario autorizado: IESS-0002/);
});

test('registro: búsqueda por fecha de petición, de entrega y texto; paginación de 10 a 100', async () => {
  const { filtrarRegistro, paginar, TAMANOS_PAGINA, diaLocal } = await import('../src/motor/registro.js');
  const base = { descargas: [], destinatario: { tipo: 'iess', id: 'IESS-0001' }, archivo: 'a.csv' };
  const iso = d => new Date(d + 'T12:00:00').toISOString(); // mediodía local: el día no cambia por zona horaria
  const lista = [
    { ...base, id: 'A', solicitadoEn: iso('2026-01-10') },
    { ...base, id: 'B', solicitadoEn: iso('2026-02-10'), descargas: [{ fecha: iso('2026-02-12'), archivo: 'x' }] },
    { ...base, id: 'C', solicitadoEn: iso('2026-03-10'), destinatario: { tipo: 'msp', id: '1720-2015-1' }, descargas: [{ fecha: iso('2026-03-20'), archivo: 'y' }] },
  ];
  assert.equal(diaLocal(iso('2026-01-10')), '2026-01-10');
  const ids = f => filtrarRegistro(lista, f).map(e => e.id);
  assert.deepEqual(ids({ peticionDesde: '2026-02-01' }), ['B', 'C']);
  assert.deepEqual(ids({ peticionDesde: '2026-02-01', peticionHasta: '2026-02-28' }), ['B']);
  assert.deepEqual(ids({ entregaDesde: '2026-03-01' }), ['C']);
  assert.deepEqual(ids({ entregaHasta: '2026-12-31' }), ['B', 'C']); // con filtro de entrega, sin entrega no aparece
  assert.deepEqual(ids({ texto: '1720' }), ['C']);
  assert.deepEqual(ids({ peticionDesde: '2026-03-01', peticionHasta: '2026-01-01' }), []);
  assert.deepEqual(TAMANOS_PAGINA, [10, 20, 50, 100]);
  const muchas = Array.from({ length: 23 }, (_, i) => i);
  assert.deepEqual(paginar(muchas, 1).filas, muchas.slice(0, 10));
  assert.deepEqual(paginar(muchas, 3), { filas: [20, 21, 22], pagina: 3, paginas: 3, total: 23, desde: 21, hasta: 23 });
  assert.equal(paginar(muchas, 9).pagina, 3);
  assert.equal(paginar(muchas, 1, 50).filas.length, 23);
  assert.deepEqual(paginar([], 1), { filas: [], pagina: 1, paginas: 1, total: 0, desde: 0, hasta: 0 });
});
