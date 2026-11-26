// Roles, peticiones y logs. Todo en memoria: no toca datos reales.
import test from 'node:test';
import assert from 'node:assert/strict';
import { autenticar, normalizarUsuario } from '../src/motor/usuarios.js';
import { crearPeticiones, validarPeticion } from '../src/motor/peticiones.js';
import { crearLogs, actividadPorDia, incidencias } from '../src/motor/logs.js';

const memoria = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: k => m.delete(k) }; };
const PDF = { nombre: 'aprobacion.pdf', tamano: 1000, tipo: 'application/pdf', sha256: 'abc' };
const DOC = { tipo: 'msp', id: '1720-2015-123456' };
const FILTRO = { capitulo: 'V', bloque: '', categoria: '', desde: 2023, hasta: 2025 };

test('usuarios: ti/ti, ce/ce y el doctor con su licencia; nunca acepta una contraseña equivocada', async () => {
  assert.equal((await autenticar('ti', 'ti')).rol, 'ti');
  assert.equal((await autenticar(' CE ', 'ce')).rol, 'ce');
  const doc = await autenticar('1720-2015-123456', 'doc');
  assert.equal(doc.rol, 'receptor');
  assert.deepEqual(doc.destinatario, DOC);
  assert.equal(doc.hash, undefined);
  assert.equal((await autenticar('iess-0002', 'iess')).destinatario.id, 'IESS-0002');
  assert.equal(await autenticar('ti', 'TI'), null);
  assert.equal(await autenticar('doc', 'doc'), null);
  assert.equal(await autenticar('nadie', ''), null);
  assert.equal(normalizarUsuario('iess-0002'), 'IESS-0002');
});

test('peticiones: el comité crea, TI devuelve o procesa y publica, el destinatario firma y descarga', () => {
  const pet = crearPeticiones(memoria());
  assert.ok(validarPeticion({ destinatario: DOC, filtro: FILTRO, aprobacion: { nombre: 'x.docx' } }).some(e => /PDF/.test(e)));
  assert.throws(() => pet.crear({ destinatario: DOC, filtro: FILTRO }, 'ce'), /PDF/);
  const p = pet.crear({ destinatario: { tipo: 'iess', id: 'iess-0099' }, filtro: FILTRO, aprobacion: PDF }, 'ce');
  assert.match(p.id, /^PET-\d{8}-\d{4}$/);
  assert.equal(p.estado, 'enviada');
  // Devolución con motivo obligatorio y reenvío corregido.
  assert.throws(() => pet.devolver(p.id, '  ', 'ti'), /motivo/);
  pet.devolver(p.id, 'Falta la firma del presidente', 'ti');
  assert.equal(pet.obtener(p.id).historial.at(-1).motivo, 'Falta la firma del presidente');
  assert.throws(() => pet.tomar(p.id, 'ti'), /no puede pasar/);
  pet.reenviar(p.id, { destinatario: DOC }, 'ce');
  pet.tomar(p.id, 'ti');
  // Antes de publicar nadie firma; luego solo el destinatario.
  const doc = { usuario: DOC.id, destinatario: DOC };
  const otro = { usuario: 'IESS-0002', destinatario: { tipo: 'iess', id: 'IESS-0002' } };
  assert.throws(() => pet.firmar(p.id, doc), /no puede pasar/);
  pet.publicar(p.id, { id: 'R2-X' }, 'ti');
  assert.throws(() => pet.firmar(p.id, otro), /Solo el destinatario/);
  assert.throws(() => pet.registrarDescarga(p.id, { archivo: 'a.zip', tipo: 'zip' }, doc), /Firme/);
  pet.firmar(p.id, doc);
  pet.registrarDescarga(p.id, { archivo: 'a.zip', tipo: 'zip' }, doc);
  pet.registrarDescarga(p.id, { archivo: 'a.csv', tipo: 'csv' }, doc);
  const final = pet.obtener(p.id);
  assert.equal(final.estado, 'descargada');
  assert.deepEqual(final.descargas.map(d => d.tipo), ['zip', 'csv']);
  assert.deepEqual(final.historial.map(h => h.estado), ['enviada', 'devuelta', 'enviada', 'en_proceso', 'publicada', 'firmada', 'descargada']);
  assert.equal(pet.paraDestinatario(DOC).length, 1);
  assert.equal(pet.paraDestinatario(otro.destinatario).length, 0);
  assert.equal('borrar' in pet, false);
});

test('logs: por tipo, solo se agregan, actividad por día e incidencias', () => {
  const logs = crearLogs(memoria());
  logs.registrar({ tipo: 'sesion', accion: 'Inicio de sesión', usuario: 'ti', rol: 'ti' });
  logs.registrar({ tipo: 'sesion', accion: 'Inicio de sesión', usuario: 'ti', resultado: 'fallo' });
  logs.registrar({ tipo: 'peticion', accion: 'Devuelta al comité', usuario: 'ti' });
  logs.registrar({ tipo: 'descarga', accion: 'Descarga ZIP', usuario: DOC.id });
  logs.registrar({ tipo: 'error', accion: 'Error', detalle: 'x' });
  assert.throws(() => logs.registrar({ tipo: 'otro' }), /desconocido/);
  assert.equal(logs.lista().length, 5);
  assert.equal(logs.lista('sesion').length, 2);
  assert.deepEqual(incidencias(logs.lista()), { errores: 1, sesionesFallidas: 1, devoluciones: 1 });
  const serie = actividadPorDia(logs.lista(), 7);
  assert.equal(serie.length, 7);
  assert.deepEqual(serie.at(-1), { dia: serie.at(-1).dia, sesion: 2, peticion: 1, descarga: 1, error: 1 });
  assert.equal('borrar' in logs, false);
});
