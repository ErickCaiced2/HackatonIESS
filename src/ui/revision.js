// Pantalla de revisión: la IA propone y la persona confirma. No muestra valores de identificadores.
import { estandarizar, necesitaRevision, MINIMOS, CAMPOS, UMBRAL_ALTO } from '../ia/estandarizar.js';
import { num } from '../motor/entregables.js';
import { h, boton, tabla, etiqueta, aviso, detalle } from './dom.js';

const confianza = c => {
  if (c.origen === 'nombre oficial') return etiqueta('ok', 'Nombre oficial');
  const p = Math.round(c.modelo.confianza * 100) + ' %';
  if (c.propuesta === 'desconocida') return etiqueta('neutro', c.conflicto ? 'Repetida' : 'Sin correspondencia');
  if (c.sugerida) return etiqueta('aviso', 'Sugerencia: compruébela');
  return c.confianza >= UMBRAL_ALTO ? etiqueta('ok', 'Segura ' + p) : etiqueta('aviso', 'Dudosa ' + p);
};

export function panelRevision(revision, repintar, alConfirmar) {
  const { analisis: a, decisiones: d, codificacion } = revision;
  const res = estandarizar(a, d);

  const selector = c => h('select', {
    id: 'col-' + c.indice, 'aria-label': 'Campo para la columna ' + c.nombre,
    onchange: e => {
      d.asignacion[c.indice] = e.target.value;
      d.revisadas.add(c.indice);
      d.sexo = {}; d.tipo = {}; d.ordenFecha = {};
      repintar();
    },
  }, ['desconocida', ...CAMPOS].map(x => h('option', { value: x, selected: d.asignacion[c.indice] === x },
    x === 'desconocida' ? '— no usar (se elimina) —' : x)));

  const fila = c => [
    h('strong', {}, c.nombre),
    selector(c),
    confianza(c),
    h('small', {}, c.senales.join(' · ') || '—',
      c.conflicto ? ` · otra columna ya es «${c.conflicto}»` : '',
      c.origen === 'modelo' && c.modelo.confianza < UMBRAL_ALTO ? ` · segunda opción: ${c.modelo.segunda}` : ''),
    necesitaRevision(c)
      ? h('label', { className: 'casilla' }, h('input', {
        type: 'checkbox', id: 'rev-' + c.indice, checked: d.revisadas.has(c.indice),
        onchange: e => { if (e.target.checked) d.revisadas.add(c.indice); else d.revisadas.delete(c.indice); repintar(); },
      }), 'Revisada')
      : '—',
  ];
  const cabecera = ['Columna del archivo', 'La IA la toma como', 'Confianza', '¿Por qué?', 'Revisión'];
  const dudosas = a.columnas.filter(necesitaRevision);
  const usadas = a.columnas.filter(c => !necesitaRevision(c) && d.asignacion[c.indice] !== 'desconocida');
  const sobrantes = a.columnas.filter(c => !necesitaRevision(c) && d.asignacion[c.indice] === 'desconocida');

  const preguntas = res.preguntas.map(p => {
    if (p.tipo === 'fecha') {
      return h('fieldset', { className: 'pregunta' }, h('legend', {}, `¿Cómo están escritas las fechas de «${p.columna}»?`),
        h('label', {}, 'Orden', h('select', { id: 'orden-' + p.campo, onchange: e => { d.ordenFecha[p.campo] = e.target.value; repintar(); } },
          [['', 'Elija una opción'], ['dmy', 'Día / mes / año'], ['mdy', 'Mes / día / año']].map(([v, t]) =>
            h('option', { value: v, selected: (d.ordenFecha[p.campo] ?? '') === v }, t)))));
    }
    const sexo = p.tipo === 'sexo';
    const destinos = sexo ? [['H', 'Hombre'], ['M', 'Mujer']] : ['Consulta externa', 'Emergencia', 'Hospitalización'].map(x => [x, x]);
    return h('fieldset', { className: 'pregunta' },
      h('legend', {}, sexo ? `Confirme el sexo en «${p.columna}»` : `¿Qué tipo de atención es cada valor de «${p.columna}»?`),
      sexo && p.explicacion && aviso('aviso', p.explicacion),
      h('div', { className: 'fila' }, p.valores.map(v => h('label', {}, `«${sexo ? v.toUpperCase() : v}» significa`,
        h('select', {
          id: `${p.tipo}-${v}`,
          onchange: e => { (sexo ? d.sexo : d.tipo)[v] = e.target.value; repintar(); },
        }, [['', 'Elija una opción'], ...destinos].map(([x, t]) => h('option', { value: x, selected: (p.mapa[v] ?? '') === x }, t)))))));
  });

  return h('div', { className: 'revision' },
    h('h3', {}, 'Revisión de la IA'),
    h('p', {}, `${num(a.filas)} filas · ${a.columnas.length} columnas · separador: ${a.nombreSeparador} · codificación: ${codificacion}`),
    h('div', { className: 'indicadores compacto' },
      [['Reconocidas', usadas.length], ['Dudosas', dudosas.length], ['Se eliminan', sobrantes.length],
        ['Datos mínimos', `${MINIMOS.filter(m => m.opciones.some(o => d.asignacion.includes(o))).length} de ${MINIMOS.length}`]]
        .map(([n, v]) => h('div', { className: 'indicador' }, h('span', {}, n), h('b', {}, v)))),
    detalle('minimos', 'Ver los 8 datos mínimos', tabla(['Dato mínimo', 'Estado'], MINIMOS.map(m => {
      const hallado = m.opciones.find(o => d.asignacion.includes(o));
      return [m.dato, hallado ? etiqueta('ok', 'Viene como ' + hallado) : etiqueta('mal', 'Falta')];
    }))),
    dudosas.length > 0 && [h('h3', {}, 'Revise estas columnas una por una'), tabla(cabecera, dudosas.map(fila))],
    preguntas,
    detalle('reconocidas', `Ver o corregir las columnas reconocidas (${usadas.length})`, tabla(cabecera, usadas.map(fila))),
    sobrantes.length > 0 && detalle('sobrantes', `Ver o recuperar las columnas que se eliminan (${sobrantes.length})`, tabla(cabecera, sobrantes.map(fila))),
    res.problemas.length > 0
      ? aviso('mal', h('strong', {}, 'Todavía no se puede continuar:'), h('ul', {}, res.problemas.map(x => h('li', {}, x))))
      : aviso('ok', 'Todo se puede estandarizar. Revise las asignaciones y confirme.'),
    res.notas.map(n => aviso('aviso', n)),
    h('div', { className: 'acciones' },
      boton('Confirmar y estandarizar', alConfirmar, { className: 'principal', id: 'confirmar-ia', disabled: res.problemas.length > 0 })));
}
