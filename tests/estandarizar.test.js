// Pasa las 8 bases INVENTADAS de pruebas_ia/ por la IA. Estas bases no se usaron para entrenar.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import '../pruebas_ia/generar.js';
import { analizar, decisionesIniciales, estandarizar, necesitaRevision } from '../src/ia/estandarizar.js';
import { proponerSexo } from '../src/ia/normalizar.js';
import { REFERENCIA, PROPIA } from '../src/motor/config.js';
import { leer, extraerCohorte, ejecutar } from '../src/motor/motor.js';
import { trazabilidadJSON, ptaHTML } from '../src/motor/entregables.js';

const archivo = n => readFileSync(new URL('../pruebas_ia/datos/' + n, import.meta.url), 'utf8');
const esperado = JSON.parse(archivo('respuestas.json'));
// Simula a la persona que marca como revisadas las columnas dudosas SIN corregir nada.
const aceptar = a => {
  const d = decisionesIniciales(a);
  a.columnas.filter(necesitaRevision).forEach(c => d.revisadas.add(c.indice));
  return d;
};
const huella = r => r.salida.map(f => Object.entries(f).filter(([c]) => c !== 'id_paciente_estudio').map(x => x[1]).join('|')).sort().join('\n');

test('IA-01: el formato oficial pasa sin cambiar ningún valor', () => {
  const original = leer(archivo('1_oficial.csv'));
  const r = estandarizar(analizar(archivo('1_oficial.csv')), aceptar(analizar(archivo('1_oficial.csv'))));
  assert.deepEqual(r.problemas, []);
  assert.equal(r.cambios.length, 0);
  assert.deepEqual(r.datos.filas, original.filas);
});

for (const caso of esperado.archivos.filter(c => c.esperado === 'igual')) {
  test(`${caso.archivo}: reconoce lo necesario sin correcciones y el resultado es el mismo`, () => {
    const a = analizar(archivo(caso.archivo));
    // Se admiten errores solo si no tocan un campo necesario ni la salida (esas columnas se eliminan).
    const usados = ['cedula', 'historia_clinica', 'edad', 'fecha_nacimiento', 'sexo', 'provincia', 'region', 'fecha_ingreso', 'fecha_egreso', 'tipo_atencion', 'diagnostico_cie10', 'dias_estancia'];
    const errores = a.columnas.filter(c => c.propuesta !== caso.asignaciones[c.nombre]
      && (usados.includes(c.propuesta) || usados.includes(caso.asignaciones[c.nombre])))
      .map(c => `${c.nombre}: propuso ${c.propuesta}, era ${caso.asignaciones[c.nombre]}`);
    assert.deepEqual(errores, []);
    const r = estandarizar(a, aceptar(a));
    assert.deepEqual(r.problemas, []);
    const base = extraerCohorte(leer(archivo('1_oficial.csv')).filas);
    const cohorte = extraerCohorte(r.datos.filas);
    assert.deepEqual([cohorte.personas, cohorte.atenciones], [esperado.cohorte.personas, esperado.cohorte.atenciones]);
    for (const config of [REFERENCIA, PROPIA]) {
      const x = ejecutar(cohorte, config, r.datos.nombreOriginal);
      assert.ok(x.apto, x.verificaciones.filter(v => !v.ok).map(v => v.id).join());
      assert.equal(huella(x), huella(ejecutar(base, config)));
    }
  });
}

test('6 y 7: bloquea si falta el tipo de atención o si la columna trae correos', () => {
  for (const n of ['6_falta_tipo.csv', '7_correo_disfrazado.csv']) {
    const a = analizar(archivo(n));
    const r = estandarizar(a, aceptar(a));
    assert.equal(r.datos, null, n);
    assert.ok(r.problemas.some(p => /Tipo de atención|tipo_atencion/.test(p)), n);
  }
});

test('guarda: aunque la persona asigne los correos como tipo de atención, se bloquea y no se muestran', () => {
  const a = analizar(archivo('7_correo_disfrazado.csv'));
  const d = aceptar(a);
  const i = a.nombres.indexOf('atencion');
  d.asignacion[i] = 'tipo_atencion';
  const r = estandarizar(a, d);
  assert.equal(r.datos, null);
  assert.ok(!JSON.stringify([r.problemas, r.preguntas, r.notas]).includes('@'));
});

test('8: pregunta el orden de las fechas ambiguas y continúa al responder', () => {
  const a = analizar(archivo('8_fechas_ambiguas.csv'));
  const d = aceptar(a);
  const antes = estandarizar(a, d);
  assert.equal(antes.datos, null);
  assert.ok(antes.preguntas.some(p => p.tipo === 'fecha'));
  d.ordenFecha.fecha_ingreso = 'dmy';
  assert.ok(estandarizar(a, d).datos);
});

test('sexo: la letra M depende de las demás', () => {
  assert.equal(proponerSexo(['h', 'm']).equivalencias.m, 'M');
  assert.equal(proponerSexo(['m', 'f']).equivalencias.m, 'H');
  assert.deepEqual(proponerSexo(['m']).pendientes, ['m']);
  assert.deepEqual(proponerSexo(['h', 'm', 'f']).pendientes, ['m']);
  assert.deepEqual(proponerSexo(['1', '2']).pendientes, ['1', '2']);
});

test('un encabezado con datos se rechaza sin repetirlos', () => {
  assert.throws(() => analizar('persona@correo.example,34\notra@correo.example,40'), e => !e.message.includes('@'));
});

test('sin fugas: trazabilidad y PTA no llevan identificadores ni nombres de columnas eliminadas', async () => {
  const a = analizar(archivo('2_hospital.csv'));
  const r = estandarizar(a, aceptar(a));
  const x = ejecutar(extraerCohorte(r.datos.filas), REFERENCIA, r.datos.nombreOriginal);
  x.estandarizacion = r.datos.estandarizacion;
  const salida = await trazabilidadJSON(x, 'a', 'b') + ptaHTML(x, { equipo: '01', riesgo: 'r', titular: 't' });
  for (const m of ['@correo.example', '0900', 'Ficticio', 'MEDICO_TRATANTE']) assert.ok(!salida.includes(m), m);
});
