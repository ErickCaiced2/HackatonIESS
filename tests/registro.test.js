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
  reg.borrar();
  assert.equal(reg.lista().length, 0);
});

test('registro: sin almacén usa memoria y lo indica', () => {
  const reg = crearRegistro(null);
  assert.equal(reg.persistente, false);
  reg.agregar({ id: 'A', descargas: [], anonimizaciones: 1, apto: true });
  assert.equal(reg.lista().length, 1);
});
