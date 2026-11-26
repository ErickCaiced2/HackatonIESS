// CSV inventado con casos trampa. No proviene de la base del reto.
import { COLUMNAS } from '../src/motor/config.js';
import { aCSV } from '../src/motor/csv.js';

export function sintetico() {
  const filas = [];
  const agregar = (n, extra = {}) => {
    const i = filas.length + 1;
    filas.push({
      ...Object.fromEntries(COLUMNAS.map(c => [c.nombre, ''])),
      id_atencion: `AT-${String(i).padStart(6, '0')}`,
      historia_clinica: `HC-${String(n).padStart(7, '0')}`,
      cedula: String(n).padStart(10, '0'),
      nombres: 'MARCADOR_NOMBRE', apellidos: 'MARCADOR_APELLIDO',
      telefono: '0999999999', correo: 'MARCADOR@correo.example',
      fecha_nacimiento: '1990-01-01', edad: '30', sexo: 'H', provincia: 'Pichincha', canton: 'MARCADOR_CANTON',
      fecha_ingreso: '2023-01-01', tipo_atencion: 'Consulta externa',
      diagnostico_cie10: n % 2 ? 'F32.1' : 'F41.1', dias_estancia: '0', ...extra,
    });
  };
  // Grupo diverso: 12 personas en 18-39 · H · Sierra.
  for (let n = 1; n <= 12; n++) agregar(n, n === 2 ? { dias_estancia: '45' } : {});
  // Segunda atención de la persona 1, ya con otra edad: sigue siendo una persona.
  agregar(1, { edad: '41', fecha_ingreso: '2025-12-31' });
  // Grupo homogéneo: 6 personas con el mismo diagnóstico.
  for (let n = 21; n <= 26; n++) agregar(n, { edad: '45', sexo: 'M', provincia: 'Guayas', diagnostico_cie10: 'F10.2' });
  // 104 años y sola en Galápagos, con identificador en texto y estancia extrema.
  agregar(30, { edad: '104', provincia: 'Galápagos', dias_estancia: '163',
    observacion: 'MARCADOR llamar, cédula 0000000001' });
  // Excluidas.
  agregar(40, { edad: '17' });
  agregar(41, { edad: '17', fecha_ingreso: '2024-02-02' });
  agregar(42, { diagnostico_cie10: 'J06.9' });
  agregar(43, { fecha_ingreso: '2026-01-01' });
  // Como el CSV de práctica, la historia clínica llega con el nombre id_hc.
  return aCSV(COLUMNAS.map(c => c.nombre), filas).replace('historia_clinica', 'id_hc');
}
