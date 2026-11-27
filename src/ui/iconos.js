// Íconos de la interfaz: trazos propios de 24 × 24, con un mismo grosor. Sin librerías ni recursos externos.
const TRAZOS = {
  // Pasos del procesamiento
  datos: ['M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3z', 'M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6', 'M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3'],
  proteccion: ['M12 3l8 3v6c0 4.6-3.3 7.8-8 9-4.7-1.2-8-4.4-8-9V6z', 'M8.5 12l2.5 2.5 4.5-4.5'],
  resultados: ['M4 20h16', 'M7 20v-7', 'M12 20V5', 'M17 20v-10'],
  trazabilidad: ['M6 8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z', 'M18 20.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z', 'M8.5 6H15a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h6.5'],
  publicar: ['M21 3L10 14', 'M21 3l-7 18-4-7-7-4z'],
  // Acciones
  reiniciar: ['M4 12a8 8 0 1 0 2.5-5.8', 'M4 3v5h5'],
  plegar: ['M13 6l-6 6 6 6', 'M19 6l-6 6 6 6'],
  deshacer: ['M9 14L4 9l5-5', 'M4 9h10.5a5.5 5.5 0 0 1 0 11H11'],
  anterior: ['M15 18l-6-6 6-6'],
  siguiente: ['M9 18l6-6-6-6'],
  cerrar: ['M6 6l12 12', 'M18 6L6 18'],
  teclado: ['M3 6h18v12H3z', 'M7 10h.01', 'M11 10h.01', 'M15 10h.01', 'M7 14h10'],
  // Estados: siempre acompañan a un texto, nunca lo reemplazan
  ok: ['M5 12.5l4.5 4.5L19 7.5'],
  mal: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M15 9l-6 6', 'M9 9l6 6'],
  aviso: ['M12 3.5l9.5 16.5h-19z', 'M12 10v4.5', 'M12 17.5h.01'],
  neutro: ['M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z'],
  candado: ['M6 11h12v9H6z', 'M8.5 11V8a3.5 3.5 0 0 1 7 0v3'],
  // Marca: escudo de protección de datos
  marca: ['M12 3l8 3v6c0 4.6-3.3 7.8-8 9-4.7-1.2-8-4.4-8-9V6z', 'M9 12.5l2 2 4-4.5'],
};

export function icono(nombre, clase = 'icono-menu') {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  for (const [k, v] of Object.entries({ viewBox: '0 0 24 24', class: clase, 'aria-hidden': 'true', focusable: 'false' })) svg.setAttribute(k, v);
  for (const d of TRAZOS[nombre] ?? []) {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', d);
    svg.append(p);
  }
  return svg;
}
