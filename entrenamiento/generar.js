// Columnas INVENTADAS para entrenar y evaluar. No usa la base del reto ni pruebas_ia/.
import { REGIONES } from '../src/motor/config.js';

export function crearAzar(semilla) {
  let s = semilla >>> 0;
  const azar = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const entero = (a, b) => a + Math.floor(azar() * (b - a + 1));
  const uno = l => l[entero(0, l.length - 1)];
  return { azar, entero, uno };
}

// Nombres de ENTRENAMIENTO por clase (separados por |).
export const NOMBRES = {
  id_atencion: 'id_atencion|idAtencion|num_atencion|codigo_atencion|id_episodio|nro_registro|encounter_id|visit_id|id_consulta|folio atencion',
  historia_clinica: 'historia_clinica|id_hc|hc|num_historia|nro_historia_clinica|numero_hc|medical_record|mrn|historiaClinica|cod_historia|expediente',
  cedula: 'cedula|ced|num_cedula|cedula_paciente|identificacion|numero_identificacion|doc_identidad|documento|dni|id_paciente|id_persona|patient_id|national_id|ci_afiliado|cod_paciente',
  nombres: 'nombres|nombre|primer_nombre|nombres_paciente|first_name|given_name|nom_afiliado',
  apellidos: 'apellidos|apellido|apellidos_paciente|apellido_paterno|last_name|surname|family_name|ape_afiliado',
  fecha_nacimiento: 'fecha_nacimiento|fec_nac|fecha_nac|nacimiento|fnacimiento|birth_date|dob|date_of_birth|fechaNacimiento',
  edad: 'edad|edad_paciente|edad_anios|anios|edad_cumplida|age|patient_age|edad_actual|años',
  sexo: 'sexo|genero|sexo_paciente|sex|gender|sexo_biologico|cod_sexo',
  etnia: 'etnia|autoidentificacion|grupo_etnico|raza|ethnicity|etnia_paciente',
  provincia: 'provincia|provincia_residencia|prov|provincia_domicilio|prov_paciente|state|province|departamento_residencia',
  canton: 'canton|canton_residencia|ciudad|municipio|city|county|canton_domicilio',
  region: 'region|region_natural|zona_geografica|region_residencia|macroregion',
  telefono: 'telefono|celular|tel|numero_telefono|movil|phone|phone_number|telf_contacto|whatsapp',
  correo: 'correo|email|correo_electronico|mail|e_mail|email_address|correo_contacto',
  tipo_seguro: 'tipo_seguro|seguro|cobertura|tipo_afiliacion|afiliacion|insurance_type',
  discapacidad: 'discapacidad|tipo_discapacidad|condicion_discapacidad|disability',
  establecimiento_id: 'establecimiento_id|id_establecimiento|cod_establecimiento|unidad_medica|codigo_unidad|facility_id|hospital_id',
  tipo_establecimiento: 'tipo_establecimiento|tipologia|clase_establecimiento|facility_type|tipo_unidad',
  nivel_atencion: 'nivel_atencion|nivel|nivel_complejidad|care_level',
  fecha_ingreso: 'fecha_ingreso|fec_ingreso|fecha_atencion|fec_atencion|fecha_consulta|fecha|admission_date|visit_date|encounter_date|fechaIngreso|date',
  fecha_egreso: 'fecha_egreso|fec_egreso|fecha_alta|fec_salida|discharge_date|exit_date|fechaEgreso',
  tipo_atencion: 'tipo_atencion|tipo_de_atencion|modalidad|modalidad_atencion|atencion|clase_atencion|encounter_type|visit_type|tipo_consulta|tipo_ingreso',
  servicio: 'servicio|especialidad|area_atencion|departamento_medico|specialty|service',
  diagnostico_cie10: 'diagnostico_cie10|cie10|cod_cie10|codigo_diagnostico|diagnostico|dx|dx_principal|cod_dx|icd10|icd_code|diagnosis_code|cie_10',
  diagnostico_descripcion: 'diagnostico_descripcion|descripcion_diagnostico|nombre_diagnostico|desc_dx|diagnosis_description|enfermedad',
  dias_estancia: 'dias_estancia|estancia|dias_hospitalizado|dias_hospitalizacion|dias_internado|length_of_stay|los_days|num_dias|diasEstancia',
  condicion_egreso: 'condicion_egreso|estado_egreso|tipo_alta|condicion_salida|discharge_status|resultado_egreso',
  costo_atencion_usd: 'costo_atencion_usd|costo|valor_atencion|monto|precio_usd|cost|total_charge|valor_usd',
  observacion: 'observacion|observaciones|nota|notas|comentario|comentarios|notes|remarks|detalle_medico',
  desconocida: 'medico_tratante|doctor|nombre_medico|cama|sala|piso|id_factura|num_factura|peso|talla|presion_arterial|temperatura|religion|estado_civil|ocupacion|direccion|barrio|parroquia|usuario_registro|fecha_registro_sistema|codigo_interno|turno|prioridad|alergias|grupo_sanguineo|contacto_emergencia|empresa|ruc|numero_hijos|nivel_instruccion|idioma|pais|zip_code|nacionalidad|acompanante|medicamento',
};

// Nombres de EVALUACIÓN: no aparecen en el entrenamiento.
export const NOMBRES_EVALUACION = {
  id_atencion: 'secuencial_visita|cod_evento', historia_clinica: 'ficha_clinica|nhc', cedula: 'cedula_afiliado|identificador_usuario',
  nombres: 'nombre_pila|nombre_asegurado', apellidos: 'apellidos_asegurado|apellido_materno', fecha_nacimiento: 'f_nacim|nacido_el',
  edad: 'edad_al_ingreso|edad_usuario', sexo: 'sexo_afiliado|genero_registrado', etnia: 'pertenencia_etnica|etnico',
  provincia: 'provincia_origen|prov_vive', canton: 'canton_vive|ciudad_residencia', region: 'region_pais|zona_region',
  telefono: 'fono|num_celular', correo: 'direccion_email|correo_usuario', tipo_seguro: 'regimen_seguro|modalidad_cobertura',
  discapacidad: 'discapacidad_reportada|clase_discapacidad', establecimiento_id: 'cod_casa_salud|unidad_id',
  tipo_establecimiento: 'categoria_establecimiento|tipo_casa_salud', nivel_atencion: 'nivel_unidad|nivel_salud',
  fecha_ingreso: 'f_atencion|dia_admision', fecha_egreso: 'f_alta|dia_salida', tipo_atencion: 'forma_atencion|tipo_visita',
  servicio: 'especialidad_medica|servicio_atiende', diagnostico_cie10: 'codigo_cie|diag_principal_cod',
  diagnostico_descripcion: 'glosa_diagnostico|detalle_dx', dias_estancia: 'total_dias_internacion|estadia_dias',
  condicion_egreso: 'situacion_alta|estado_al_salir', costo_atencion_usd: 'importe_dolares|costo_total',
  observacion: 'anotaciones|texto_libre', desconocida: 'enfermera_cargo|numero_habitacion|saturacion|vehiculo|codigo_poliza',
};

const sinTildes = s => s.normalize('NFD').replace(/\p{M}/gu, '');

export function crearGenerador({ azar, entero, uno }) {
  const p2 = n => String(n).padStart(2, '0');
  const digitos = n => Array.from({ length: n }, () => entero(0, 9)).join('');
  const NOM = ['Rosa', 'Mario', 'Lucía', 'Pedro', 'Carmen', 'Andrés', 'Sofía', 'Diego', 'Nelly', 'Iván', 'Paola', 'Óscar'];
  const APE = ['Cevallos', 'Mora', 'Zurita', 'Andrade', 'Vega', 'Paz', 'Salazar', 'Ortiz', 'Naranjo', 'Ruiz'];
  const PROV = Object.keys(REGIONES);
  const FRASES = ['Paciente estable.', 'Se indica control en un mes.', 'Se entrega receta.', 'Acude con familiar.', 'Revisar resultados.', 'Llamar para confirmar cita.'];
  const letra = () => 'ABCDEFGHIJKLMNPQRSTZ'[entero(0, 19)];

  // Cada función devuelve un generador de celdas con un "estilo" fijo para toda la columna.
  const fecha = (a, b) => () => {
    const estilo = uno(['iso', 'iso', 'dmy', 'dmy-', 'hora']);
    return () => {
      const y = entero(a, b), m = p2(entero(1, 12)), d = p2(entero(1, 28));
      return estilo === 'iso' ? `${y}-${m}-${d}` : estilo === 'dmy' ? `${d}/${m}/${y}` : estilo === 'dmy-' ? `${d}-${m}-${y}` : `${y}-${m}-${d} ${p2(entero(0, 23))}:00`;
    };
  };
  const lista = (...opciones) => () => { const l = uno(opciones); return () => uno(l); };
  const caja = base => () => {
    const f = base();
    const estilo = uno([s => s, s => s, s => s.toUpperCase(), s => sinTildes(s).toLowerCase(), s => sinTildes(s).toUpperCase()]);
    return () => estilo(f());
  };

  const VALORES = {
    id_atencion: () => { const t = entero(0, 2); let n = entero(1, 500); return () => (t === 0 ? `AT-${String(n++).padStart(6, '0')}` : t === 1 ? String(n++) : `REG${n++}00`); },
    historia_clinica: () => { const t = entero(0, 2); return () => (t === 0 ? `HC-${digitos(7)}` : t === 1 ? `HC${digitos(6)}` : digitos(8)); },
    cedula: () => { const t = entero(0, 3); return () => (t < 3 ? p2(entero(1, 24)) + digitos(8) : 'P' + digitos(6)); },
    nombres: caja(() => () => (azar() < 0.4 ? `${uno(NOM)} ${uno(NOM)}` : uno(NOM))),
    apellidos: caja(() => () => (azar() < 0.8 ? `${uno(APE)} ${uno(APE)}` : uno(APE))),
    fecha_nacimiento: fecha(1925, 2015),
    edad: () => { const centro = entero(25, 60); return () => String(Math.max(0, Math.min(104, centro + entero(-35, 35)))); },
    sexo: caja(lista(['H', 'M'], ['M', 'F'], ['Hombre', 'Mujer'], ['Masculino', 'Femenino'], ['male', 'female'], ['1', '2'])),
    etnia: caja(lista(['Mestizo/a', 'Indígena', 'Montubio/a', 'Afroecuatoriano/a', 'Blanco/a', 'Otro'])),
    provincia: caja(() => { const l = azar() < 0.5 ? PROV : ['Pichincha', 'Guayas', 'Azuay', 'Manabí', 'Loja']; return () => uno(l); }),
    canton: caja(lista(['Quito', 'Guayaquil', 'Cuenca', 'Cayambe', 'Manta', 'Machala', 'Ambato', 'Ibarra', 'Riobamba', 'Durán', 'Mejía', 'Rumiñahui'])),
    region: caja(lista(['Costa', 'Sierra', 'Amazonía', 'Insular'], ['Costa', 'Sierra', 'Oriente'])),
    telefono: () => { const t = entero(0, 2); return () => (t === 0 ? '09' + digitos(8) : t === 1 ? `09${digitos(2)}-${digitos(3)}-${digitos(3)}` : '+5939' + digitos(8)); },
    correo: () => () => `${sinTildes(uno(NOM)).toLowerCase()}.${uno(APE).toLowerCase()}${entero(1, 999)}@${uno(['correo.example', 'mail.test', 'dominio.example'])}`,
    tipo_seguro: lista(['Seguro General', 'Jubilado/a', 'Seguro Social Campesino', 'Afiliación voluntaria', 'Montepío', 'Cónyuge o conviviente']),
    discapacidad: caja(lista(['Ninguna', 'Ninguna', 'Ninguna', 'Física', 'Intelectual', 'Auditiva', 'Visual', 'Psicosocial'])),
    establecimiento_id: () => { const pre = uno(['EST', 'EST-', 'UM', 'H']); return () => pre + p2(entero(1, 20)); },
    tipo_establecimiento: lista(['Hospital General', 'Hospital Básico', 'Hospital de Especialidades', 'Centro de Salud tipo A', 'Dispensario del Seguro Campesino']),
    nivel_atencion: lista(['I', 'II', 'III'], ['1', '2', '3']),
    fecha_ingreso: fecha(2021, 2026),
    fecha_egreso: fecha(2021, 2026),
    tipo_atencion: caja(lista(['Consulta externa', 'Emergencia', 'Hospitalización'], ['Consulta', 'Urgencias', 'Hospitalizado'], ['Ambulatorio', 'Emergencia', 'Internación'], ['outpatient', 'emergency', 'inpatient'])),
    servicio: lista(['Psiquiatría', 'Medicina general', 'Pediatría', 'Cirugía general', 'Medicina interna', 'Psicología', 'Ginecología', 'Traumatología']),
    diagnostico_cie10: () => { const estilo = entero(0, 2), mental = azar() < 0.5; return () => { const c = (mental && azar() < 0.7 ? 'F' : letra()) + p2(entero(0, 99)); return azar() < 0.15 ? c : estilo === 0 ? `${c}.${entero(0, 9)}` : estilo === 1 ? `${c}${entero(0, 9)}` : `${c.toLowerCase()}.${entero(0, 9)}`; }; },
    diagnostico_descripcion: lista(['Episodio depresivo moderado', 'Trastorno de ansiedad generalizada', 'Diabetes mellitus tipo 2', 'Apendicitis aguda', 'Fiebre del dengue', 'Examen médico general', 'Esquizofrenia paranoide']),
    dias_estancia: () => { const ceros = 0.4 + azar() * 0.5; return () => (azar() < ceros ? '0' : String(azar() < 0.97 ? entero(1, 15) : entero(20, 200))); },
    condicion_egreso: lista(['Alta', 'Alta', 'Referido', 'Fallecido'], ['Alta', 'Transferido']),
    costo_atencion_usd: () => { const t = azar() < 0.8; return () => (t ? (entero(2000, 900000) / 100).toFixed(2) : String(entero(20, 9000))); },
    observacion: () => () => (azar() < 0.6 ? '' : uno(FRASES)),
    desconocida: () => {
      const t = entero(0, 7);
      const cat = uno([['Soltero', 'Casado', 'Divorciado'], ['Mañana', 'Tarde', 'Noche'], ['Alta prioridad', 'Normal'], ['O+', 'A-', 'B+'], ['Sí', 'No'], ['Católica', 'Ninguna religión']]);
      return () => [() => String(entero(1, 400)), () => (entero(400, 1900) / 10).toFixed(1), () => uno(cat), () => `${uno(NOM)} ${uno(APE)}`,
        () => `${entero(90, 160)}/${entero(60, 100)}`, () => `X${digitos(5)}`, () => `Calle ${uno(APE)} N${entero(1, 90)}`, () => ''][t]();
    },
  };

  const decorar = nombre => {
    const x = azar();
    if (x < 0.14) return uno(['col_', 'campo', 'columna ', 'X', 'v', 'field_']) + entero(1, 40);
    let n = nombre;
    if (azar() < 0.25) n = uno(['pac_', 'paciente_', 'reg_', '']) + n;
    if (azar() < 0.2) n += uno(['_1', '_pac', ' paciente', '_reg']);
    if (azar() < 0.25) n = n.toUpperCase();
    if (azar() < 0.2) n = n.replaceAll('_', uno([' ', '', '-', '.']));
    if (azar() < 0.1 && n.length > 5) { const i = entero(2, n.length - 2); n = n.slice(0, i) + n.slice(i + 1); }
    return n;
  };

  const valores = (clase, filas = 120) => {
    const f = VALORES[clase]();
    const vacios = azar() < 0.25 ? azar() * 0.2 : 0;
    return Array.from({ length: filas }, () => (azar() < vacios ? '' : f()));
  };
  return { valores, decorar };
}

export function ejemplos({ porClase, semilla, nombres, decorar: conRuido }) {
  const azar = crearAzar(semilla);
  const g = crearGenerador(azar);
  const salida = [];
  for (const [clase, lista] of Object.entries(nombres)) {
    const opciones = lista.split('|');
    // «desconocida» cubre muchas cosas distintas: recibe más ejemplos.
    const n = clase === 'desconocida' ? porClase * 2 : porClase;
    for (let i = 0; i < n; i++) {
      const nombre = i < opciones.length ? opciones[i] : azar.uno(opciones);
      salida.push({ clase, nombre: conRuido ? g.decorar(nombre) : nombre, valores: g.valores(clase) });
    }
  }
  return salida;
}
