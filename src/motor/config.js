// Reglas del reto (diccionario v3). No contiene datos ni valores de control.
export const VERSION = '0.1.0';

const ID = 'Identificador directo';
const QI = 'Cuasiidentificador';
const OBJ = 'Atributo objetivo';
const OTRO = 'Otro atributo';
const NNA = 'b) NNA (si es menor de 18)';
const SALUD = 'c) Salud';

// [columna, clasificación, categoría especial art. 25, solicitada, justificación]
const NO = 'El estudio no la pide: se elimina por minimización.';
const DIR = 'Identifica a la persona: no se entrega.';
export const COLUMNAS = [
  ['id_atencion', 'Identificador técnico', '', 'No', NO],
  ['historia_clinica', ID, '', 'No', DIR],
  ['cedula', ID, '', 'Solo para unir', 'Une las atenciones sin identificar a la persona.'],
  ['nombres', ID, '', 'No', DIR],
  ['apellidos', ID, '', 'No', DIR],
  ['fecha_nacimiento', QI, NNA, 'No', NO],
  ['edad', QI, NNA, 'Sí', 'El estudio usa grupos de edad.'],
  ['sexo', QI, '', 'Sí', 'La pregunta del estudio lo requiere.'],
  ['etnia', QI, 'a) Dato sensible', 'No', NO],
  ['provincia', QI, '', 'Sí', 'El estudio solo necesita la ubicación agrupada.'],
  ['canton', QI, '', 'No', NO],
  ['telefono', ID, '', 'No', DIR],
  ['correo', ID, '', 'No', DIR],
  ['tipo_seguro', OTRO, NNA, 'No', NO],
  ['discapacidad', OTRO, 'd) Discapacidad', 'No', NO],
  ['establecimiento_id', QI, SALUD, 'No', NO],
  ['tipo_establecimiento', OTRO, SALUD, 'No', NO],
  ['nivel_atencion', OTRO, SALUD, 'No', NO],
  ['fecha_ingreso', OTRO, SALUD, 'Sí', 'El estudio pide año y mes.'],
  ['fecha_egreso', OTRO, SALUD, 'No', NO],
  ['tipo_atencion', OTRO, SALUD, 'Sí', 'Pedida tal como está.'],
  ['servicio', OTRO, SALUD, 'No', NO],
  ['diagnostico_cie10', OBJ, SALUD, 'Sí', 'Es el objeto del estudio.'],
  ['diagnostico_descripcion', OBJ, SALUD, 'No', NO],
  ['dias_estancia', OBJ, SALUD, 'Sí', 'Pedida por el estudio.'],
  ['condicion_egreso', OTRO, SALUD, 'No', NO],
  ['costo_atencion_usd', OTRO, SALUD, 'No', NO],
  ['observacion', 'Texto libre', 'c) Salud y datos de terceros', 'No', 'Puede esconder identificadores.'],
].map(([nombre, clasificacion, categoria, solicitada, justificacion]) =>
  ({ nombre, clasificacion, categoria, solicitada, justificacion }));

// El CSV de práctica usa un nombre distinto al del diccionario.
export const ALIAS = { id_hc: 'historia_clinica' };

export const IDENTIFICADORES = ['historia_clinica', 'cedula', 'nombres', 'apellidos', 'telefono', 'correo'];
export const CUASIIDENTIFICADORES = ['fecha_nacimiento', 'edad', 'grupo_edad', 'sexo', 'etnia',
  'provincia', 'region', 'canton', 'establecimiento_id'];

const POR_REGION = {
  'Amazonía': ['Morona Santiago', 'Napo', 'Orellana', 'Pastaza', 'Sucumbíos', 'Zamora Chinchipe'],
  Costa: ['El Oro', 'Esmeraldas', 'Guayas', 'Los Ríos', 'Manabí', 'Santa Elena', 'Santo Domingo de los Tsáchilas'],
  Insular: ['Galápagos'],
  Sierra: ['Azuay', 'Bolívar', 'Carchi', 'Cañar', 'Chimborazo', 'Cotopaxi', 'Imbabura', 'Loja', 'Pichincha', 'Tungurahua'],
};
export const REGIONES = Object.fromEntries(
  Object.entries(POR_REGION).flatMap(([region, ps]) => ps.map(p => [p, region])));

export const REFERENCIA = Object.freeze({
  tipo: 'referencia', k: 5, anchoEdad: 20, ubicacion: 'region', fecha: 'mes', l: 1, topeEstancia: null,
  // Posibles menores (edad ≥ 18 pero la fecha de nacimiento indica menos de 18 en la atención):
  // la referencia solo avisa para no alterar los valores de control del reto; la propia los retira.
  menores: 'avisar',
  // Diagnóstico: la referencia entrega el código completo; la propia, solo la categoría de 3 caracteres (F32).
  dx: 'completo',
});
export const PROPIA = Object.freeze({ ...REFERENCIA, tipo: 'propia', l: 2, topeEstancia: 30, menores: 'retirar', dx: 'categoria' });
