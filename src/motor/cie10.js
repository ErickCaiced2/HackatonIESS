// Catálogo CIE-10: los 22 capítulos, sus grupos (bloques) y, del capítulo V (salud mental),
// las categorías de 3 caracteres con nombre. No incluye subcategorías (F32.1) ni nombres de
// categorías de otros capítulos: fuera del V las categorías salen de los códigos del archivo.
// Nombres abreviados, escritos de memoria: VERIFICAR contra la publicación oficial OMS/OPS.
const rango = ([id, desde, hasta, nombre]) => ({ id, desde, hasta, nombre });

export const CAPITULOS = [
  ['I', 'A00', 'B99', 'Enfermedades infecciosas y parasitarias'],
  ['II', 'C00', 'D48', 'Tumores'],
  ['III', 'D50', 'D89', 'Sangre y mecanismo de la inmunidad'],
  ['IV', 'E00', 'E90', 'Endocrinas, nutricionales y metabólicas'],
  ['V', 'F00', 'F99', 'Trastornos mentales y del comportamiento'],
  ['VI', 'G00', 'G99', 'Sistema nervioso'],
  ['VII', 'H00', 'H59', 'Ojo y sus anexos'],
  ['VIII', 'H60', 'H95', 'Oído y apófisis mastoides'],
  ['IX', 'I00', 'I99', 'Sistema circulatorio'],
  ['X', 'J00', 'J99', 'Sistema respiratorio'],
  ['XI', 'K00', 'K93', 'Sistema digestivo'],
  ['XII', 'L00', 'L99', 'Piel y tejido subcutáneo'],
  ['XIII', 'M00', 'M99', 'Sistema osteomuscular y tejido conjuntivo'],
  ['XIV', 'N00', 'N99', 'Sistema genitourinario'],
  ['XV', 'O00', 'O99', 'Embarazo, parto y puerperio'],
  ['XVI', 'P00', 'P96', 'Afecciones del periodo perinatal'],
  ['XVII', 'Q00', 'Q99', 'Malformaciones y anomalías congénitas'],
  ['XVIII', 'R00', 'R99', 'Síntomas y hallazgos no clasificados'],
  ['XIX', 'S00', 'T98', 'Traumatismos, envenenamientos y otras causas externas'],
  ['XX', 'V01', 'Y98', 'Causas externas de morbilidad y mortalidad'],
  ['XXI', 'Z00', 'Z99', 'Factores que influyen en la salud'],
  ['XXII', 'U00', 'U99', 'Códigos para propósitos especiales'],
].map(rango);

export const BLOQUES_F = [
  ['F00-F09', 'F00', 'F09', 'Trastornos mentales orgánicos'],
  ['F10-F19', 'F10', 'F19', 'Debidos al consumo de sustancias psicoactivas'],
  ['F20-F29', 'F20', 'F29', 'Esquizofrenia y trastornos delirantes'],
  ['F30-F39', 'F30', 'F39', 'Trastornos del humor (afectivos)'],
  ['F40-F48', 'F40', 'F48', 'Neuróticos, relacionados con el estrés y somatomorfos'],
  ['F50-F59', 'F50', 'F59', 'Síndromes asociados a disfunciones fisiológicas'],
  ['F60-F69', 'F60', 'F69', 'Trastornos de la personalidad y del comportamiento adulto'],
  ['F70-F79', 'F70', 'F79', 'Retraso mental (término de la CIE-10)'],
  ['F80-F89', 'F80', 'F89', 'Trastornos del desarrollo psicológico'],
  ['F90-F98', 'F90', 'F98', 'Inicio habitual en la infancia y adolescencia'],
  ['F99', 'F99', 'F99', 'Trastorno mental no especificado'],
].map(rango);

export const CATEGORIAS_F = Object.fromEntries(`
F00|Demencia en la enfermedad de Alzheimer
F01|Demencia vascular
F02|Demencia en otras enfermedades
F03|Demencia no especificada
F04|Síndrome amnésico orgánico
F05|Delirio no inducido por sustancias
F06|Otros trastornos mentales por lesión o enfermedad física
F07|Trastornos de personalidad por lesión o disfunción cerebral
F09|Trastorno mental orgánico no especificado
F10|Consumo de alcohol
F11|Consumo de opiáceos
F12|Consumo de cannabinoides
F13|Consumo de sedantes o hipnóticos
F14|Consumo de cocaína
F15|Consumo de otros estimulantes
F16|Consumo de alucinógenos
F17|Consumo de tabaco
F18|Consumo de disolventes volátiles
F19|Consumo de múltiples drogas u otras sustancias
F20|Esquizofrenia
F21|Trastorno esquizotípico
F22|Trastornos delirantes persistentes
F23|Trastornos psicóticos agudos y transitorios
F24|Trastorno delirante inducido
F25|Trastornos esquizoafectivos
F28|Otros trastornos psicóticos no orgánicos
F29|Psicosis no orgánica no especificada
F30|Episodio maníaco
F31|Trastorno afectivo bipolar
F32|Episodio depresivo
F33|Trastorno depresivo recurrente
F34|Trastornos del humor persistentes
F38|Otros trastornos del humor
F39|Trastorno del humor no especificado
F40|Trastornos fóbicos de ansiedad
F41|Otros trastornos de ansiedad
F42|Trastorno obsesivo-compulsivo
F43|Reacción al estrés grave y trastornos de adaptación
F44|Trastornos disociativos
F45|Trastornos somatomorfos
F48|Otros trastornos neuróticos
F50|Trastornos de la ingestión de alimentos
F51|Trastornos del sueño no orgánicos
F52|Disfunción sexual no orgánica
F53|Trastornos asociados al puerperio
F54|Factores psicológicos asociados a otras enfermedades
F55|Abuso de sustancias que no producen dependencia
F59|Síndrome del comportamiento no especificado
F60|Trastornos específicos de la personalidad
F61|Trastornos mixtos y otros de la personalidad
F62|Cambios perdurables de la personalidad
F63|Trastornos de los hábitos y de los impulsos
F64|Trastornos de la identidad de género (término de la CIE-10)
F65|Trastornos de la preferencia sexual
F66|Trastornos del desarrollo y orientación sexual (término de la CIE-10)
F68|Otros trastornos de la personalidad y del comportamiento adulto
F69|Trastorno de la personalidad adulta no especificado
F70|Retraso mental leve
F71|Retraso mental moderado
F72|Retraso mental grave
F73|Retraso mental profundo
F78|Otro retraso mental
F79|Retraso mental no especificado
F80|Trastornos del habla y del lenguaje
F81|Trastornos del aprendizaje escolar
F82|Trastorno del desarrollo motor
F83|Trastornos específicos mixtos del desarrollo
F84|Trastornos generalizados del desarrollo
F88|Otros trastornos del desarrollo psicológico
F89|Trastorno del desarrollo psicológico no especificado
F90|Trastornos hipercinéticos
F91|Trastornos de la conducta
F92|Trastornos mixtos de la conducta y las emociones
F93|Trastornos emocionales de inicio en la infancia
F94|Trastornos del comportamiento social en la infancia
F95|Trastornos de tics
F98|Otros trastornos de inicio en la infancia y adolescencia
F99|Trastorno mental no especificado
`.trim().split('\n').map(l => l.split('|')));

// Grupos (bloques) de los demás capítulos: «desde-hasta|nombre» por línea.
const OTROS_BLOQUES = {
  I: `A00-A09|Infecciones intestinales
A15-A19|Tuberculosis
A20-A28|Zoonosis bacterianas
A30-A49|Otras enfermedades bacterianas
A50-A64|Infecciones de transmisión predominantemente sexual
A65-A69|Otras enfermedades por espiroquetas
A70-A74|Otras enfermedades por clamidias
A75-A79|Rickettsiosis
A80-A89|Infecciones virales del sistema nervioso central
A90-A99|Fiebres virales por artrópodos y fiebres hemorrágicas
B00-B09|Infecciones virales de la piel y las mucosas
B15-B19|Hepatitis viral
B20-B24|Enfermedad por VIH
B25-B34|Otras enfermedades virales
B35-B49|Micosis
B50-B64|Enfermedades por protozoarios
B65-B83|Helmintiasis
B85-B89|Pediculosis, acariasis y otras infestaciones
B90-B94|Secuelas de enfermedades infecciosas y parasitarias
B95-B98|Agentes bacterianos, virales y otros agentes infecciosos
B99-B99|Otras enfermedades infecciosas`,
  II: `C00-C14|Labio, cavidad bucal y faringe
C15-C26|Órganos digestivos
C30-C39|Órganos respiratorios e intratorácicos
C40-C41|Huesos y cartílagos articulares
C43-C44|Melanoma y otros tumores de la piel
C45-C49|Tejidos mesoteliales y tejidos blandos
C50-C50|Mama
C51-C58|Órganos genitales femeninos
C60-C63|Órganos genitales masculinos
C64-C68|Vías urinarias
C69-C72|Ojo, encéfalo y otras partes del sistema nervioso central
C73-C75|Tiroides y otras glándulas endocrinas
C76-C80|Sitios mal definidos, secundarios y no especificados
C81-C96|Tejido linfático, hematopoyético y afines
C97-C97|Sitios múltiples independientes
D00-D09|Tumores in situ
D10-D36|Tumores benignos
D37-D48|Tumores de comportamiento incierto o desconocido`,
  III: `D50-D53|Anemias nutricionales
D55-D59|Anemias hemolíticas
D60-D64|Anemias aplásicas y otras anemias
D65-D69|Defectos de la coagulación, púrpura y otras afecciones hemorrágicas
D70-D77|Otras enfermedades de la sangre y de los órganos hematopoyéticos
D80-D89|Trastornos del mecanismo de la inmunidad`,
  IV: `E00-E07|Trastornos de la glándula tiroides
E10-E14|Diabetes mellitus
E15-E16|Otros trastornos de la glucosa y de la secreción pancreática
E20-E35|Trastornos de otras glándulas endocrinas
E40-E46|Desnutrición
E50-E64|Otras deficiencias nutricionales
E65-E68|Obesidad y otros tipos de hiperalimentación
E70-E90|Trastornos metabólicos`,
  VI: `G00-G09|Enfermedades inflamatorias del sistema nervioso central
G10-G14|Atrofias sistémicas del sistema nervioso central
G20-G26|Trastornos extrapiramidales y del movimiento
G30-G32|Otras enfermedades degenerativas del sistema nervioso
G35-G37|Enfermedades desmielinizantes del sistema nervioso central
G40-G47|Trastornos episódicos y paroxísticos
G50-G59|Trastornos de los nervios, raíces y plexos nerviosos
G60-G64|Polineuropatías y otros trastornos del sistema nervioso periférico
G70-G73|Enfermedades de la unión neuromuscular y del músculo
G80-G83|Parálisis cerebral y otros síndromes paralíticos
G90-G99|Otros trastornos del sistema nervioso`,
  VII: `H00-H06|Párpado, aparato lagrimal y órbita
H10-H13|Conjuntiva
H15-H22|Esclerótica, córnea, iris y cuerpo ciliar
H25-H28|Cristalino
H30-H36|Coroides y retina
H40-H42|Glaucoma
H43-H45|Cuerpo vítreo y globo ocular
H46-H48|Nervio óptico y vías ópticas
H49-H52|Músculos oculares, movimiento binocular, acomodación y refracción
H53-H54|Alteraciones de la visión y ceguera
H55-H59|Otros trastornos del ojo y sus anexos`,
  VIII: `H60-H62|Oído externo
H65-H75|Oído medio y mastoides
H80-H83|Oído interno
H90-H95|Otros trastornos del oído`,
  IX: `I00-I02|Fiebre reumática aguda
I05-I09|Enfermedades cardíacas reumáticas crónicas
I10-I15|Enfermedades hipertensivas
I20-I25|Enfermedades isquémicas del corazón
I26-I28|Enfermedad cardiopulmonar y de la circulación pulmonar
I30-I52|Otras formas de enfermedad del corazón
I60-I69|Enfermedades cerebrovasculares
I70-I79|Enfermedades de las arterias, arteriolas y capilares
I80-I89|Enfermedades de las venas y de los vasos y ganglios linfáticos
I95-I99|Otros trastornos del sistema circulatorio`,
  X: `J00-J06|Infecciones agudas de las vías respiratorias superiores
J09-J18|Influenza y neumonía
J20-J22|Otras infecciones agudas de las vías respiratorias inferiores
J30-J39|Otras enfermedades de las vías respiratorias superiores
J40-J47|Enfermedades crónicas de las vías respiratorias inferiores
J60-J70|Enfermedades del pulmón debidas a agentes externos
J80-J84|Otras enfermedades respiratorias que afectan el intersticio
J85-J86|Afecciones supurativas y necróticas de las vías respiratorias inferiores
J90-J94|Otras enfermedades de la pleura
J95-J99|Otras enfermedades del sistema respiratorio`,
  XI: `K00-K14|Cavidad bucal, glándulas salivales y maxilares
K20-K31|Esófago, estómago y duodeno
K35-K38|Apéndice
K40-K46|Hernia
K50-K52|Enteritis y colitis no infecciosas
K55-K64|Otras enfermedades de los intestinos
K65-K67|Peritoneo
K70-K77|Hígado
K80-K87|Vesícula biliar, vías biliares y páncreas
K90-K93|Otras enfermedades del sistema digestivo`,
  XII: `L00-L08|Infecciones de la piel y del tejido subcutáneo
L10-L14|Trastornos flictenulares
L20-L30|Dermatitis y eczema
L40-L45|Trastornos papuloescamosos
L50-L54|Urticaria y eritema
L55-L59|Trastornos de la piel relacionados con radiación
L60-L75|Trastornos de las faneras
L80-L99|Otros trastornos de la piel y del tejido subcutáneo`,
  XIII: `M00-M25|Artropatías
M30-M36|Trastornos sistémicos del tejido conjuntivo
M40-M54|Dorsopatías
M60-M79|Trastornos de los tejidos blandos
M80-M94|Osteopatías y condropatías
M95-M99|Otros trastornos del sistema osteomuscular`,
  XIV: `N00-N08|Enfermedades glomerulares
N10-N16|Enfermedad renal tubulointersticial
N17-N19|Insuficiencia renal
N20-N23|Litiasis urinaria
N25-N29|Otros trastornos del riñón y del uréter
N30-N39|Otras enfermedades del sistema urinario
N40-N51|Enfermedades de los órganos genitales masculinos
N60-N64|Trastornos de la mama
N70-N77|Enfermedades inflamatorias de los órganos pélvicos femeninos
N80-N98|Trastornos no inflamatorios de los órganos genitales femeninos
N99-N99|Otros trastornos del sistema genitourinario`,
  XV: `O00-O08|Embarazo terminado en aborto
O10-O16|Edema, proteinuria y trastornos hipertensivos del embarazo
O20-O29|Otros trastornos maternos relacionados con el embarazo
O30-O48|Atención materna por el feto, la cavidad amniótica o problemas del parto
O60-O75|Complicaciones del trabajo de parto y del parto
O80-O84|Parto
O85-O92|Complicaciones del puerperio
O94-O99|Otras afecciones obstétricas`,
  XVI: `P00-P04|Feto y recién nacido afectados por factores maternos
P05-P08|Duración de la gestación y crecimiento fetal
P10-P15|Traumatismo del nacimiento
P20-P29|Trastornos respiratorios y cardiovasculares del periodo perinatal
P35-P39|Infecciones del periodo perinatal
P50-P61|Trastornos hemorrágicos y hematológicos del feto y del recién nacido
P70-P74|Trastornos endocrinos y metabólicos transitorios
P75-P78|Trastornos del sistema digestivo del feto y del recién nacido
P80-P83|Afecciones del tegumento y de la regulación de la temperatura
P90-P96|Otros trastornos del periodo perinatal`,
  XVII: `Q00-Q07|Malformaciones del sistema nervioso
Q10-Q18|Malformaciones del ojo, del oído, de la cara y del cuello
Q20-Q28|Malformaciones del sistema circulatorio
Q30-Q34|Malformaciones del sistema respiratorio
Q35-Q37|Fisura del paladar y labio leporino
Q38-Q45|Otras malformaciones del sistema digestivo
Q50-Q56|Malformaciones de los órganos genitales
Q60-Q64|Malformaciones del sistema urinario
Q65-Q79|Malformaciones del sistema osteomuscular
Q80-Q89|Otras malformaciones congénitas
Q90-Q99|Anomalías cromosómicas`,
  XVIII: `R00-R09|Síntomas de los sistemas circulatorio y respiratorio
R10-R19|Síntomas del sistema digestivo y el abdomen
R20-R23|Síntomas de la piel y el tejido subcutáneo
R25-R29|Síntomas de los sistemas nervioso y osteomuscular
R30-R39|Síntomas del sistema urinario
R40-R46|Síntomas del conocimiento, la percepción, las emociones y la conducta
R47-R49|Síntomas del habla y de la voz
R50-R69|Síntomas y signos generales
R70-R79|Hallazgos anormales en sangre sin diagnóstico
R80-R82|Hallazgos anormales en orina sin diagnóstico
R83-R89|Hallazgos anormales en otros líquidos, sustancias y tejidos
R90-R94|Hallazgos anormales en imágenes y pruebas funcionales
R95-R99|Causas mal definidas y desconocidas de mortalidad`,
  XIX: `S00-S09|Traumatismos de la cabeza
S10-S19|Traumatismos del cuello
S20-S29|Traumatismos del tórax
S30-S39|Traumatismos del abdomen, región lumbosacra, columna lumbar y pelvis
S40-S49|Traumatismos del hombro y del brazo
S50-S59|Traumatismos del codo y del antebrazo
S60-S69|Traumatismos de la muñeca y de la mano
S70-S79|Traumatismos de la cadera y del muslo
S80-S89|Traumatismos de la rodilla y de la pierna
S90-S99|Traumatismos del tobillo y del pie
T00-T07|Traumatismos de múltiples regiones del cuerpo
T08-T14|Traumatismos de parte no especificada del tronco, miembro o región
T15-T19|Cuerpo extraño que penetra por orificio natural
T20-T32|Quemaduras y corrosiones
T33-T35|Congelamiento
T36-T50|Envenenamiento por drogas, medicamentos y sustancias biológicas
T51-T65|Efectos tóxicos de sustancias de procedencia no medicinal
T66-T78|Otros efectos y los no especificados de causas externas
T79-T79|Complicaciones precoces de traumatismos
T80-T88|Complicaciones de la atención médica y quirúrgica
T90-T98|Secuelas de traumatismos, envenenamientos y otras causas externas`,
  XX: `V01-X59|Accidentes
X60-X84|Lesiones autoinfligidas intencionalmente
X85-Y09|Agresiones
Y10-Y34|Eventos de intención no determinada
Y35-Y36|Intervención legal y operaciones de guerra
Y40-Y84|Complicaciones de la atención médica y quirúrgica
Y85-Y89|Secuelas de causas externas
Y90-Y98|Factores suplementarios`,
  XXI: `Z00-Z13|Exámenes e investigaciones
Z20-Z29|Riesgos para la salud por enfermedades transmisibles
Z30-Z39|Salud reproductiva
Z40-Z54|Procedimientos específicos y cuidados de salud
Z55-Z65|Riesgos por circunstancias socioeconómicas y psicosociales
Z70-Z76|Contacto con los servicios de salud por otras circunstancias
Z80-Z99|Historia familiar y personal, y afecciones que influyen en la salud`,
  XXII: `U00-U49|Asignación provisoria de nuevas enfermedades de etiología incierta
U80-U89|Resistencia a antimicrobianos y antineoplásicos`,
};

// Grupos de cada capítulo. Un grupo de un solo código se nombra con ese código (F99, C50).
export const BLOQUES = Object.fromEntries([
  ['V', BLOQUES_F],
  ...Object.entries(OTROS_BLOQUES).map(([cap, texto]) => [cap, texto.split('\n').map(l => {
    const [rangoTexto, nombre] = l.split('|');
    const [desde, hasta] = rangoTexto.split('-');
    return rango([desde === hasta ? desde : rangoTexto, desde, hasta, nombre]);
  })]),
]);
export const bloquesDe = capitulo => BLOQUES[capitulo] ?? [];

// Categorías de 3 caracteres para los selectores: [código, nombre].
// Capítulo V: el catálogo completo. Otros capítulos: los códigos presentes en el archivo.
export function categoriasDe(capitulo, bloque, codigosDelArchivo = []) {
  const cap = CAPITULOS.find(c => c.id === capitulo);
  const r = bloquesDe(capitulo).find(b => b.id === bloque) ?? cap;
  if (!r) return [];
  const dentro = c => c >= r.desde && c <= r.hasta;
  if (capitulo === 'V') return Object.entries(CATEGORIAS_F).filter(([c]) => dentro(c));
  return [...new Set(codigosDelArchivo)].filter(c => /^[A-Z]\d{2}$/.test(c) && dentro(c)).sort()
    .map(c => [c, bloquesDe(capitulo).find(b => c >= b.desde && c <= b.hasta)?.nombre ?? cap.nombre]);
}

// Filtro que pide el estudio.
// El periodo (años de fecha_ingreso) lo elige el operador; el estudio pide 2023-2025.
export const PERIODO_MINIMO = 1980;
export const anioActual = () => new Date().getFullYear();
export const PERIODO_ESTUDIO = Object.freeze({ desde: 2023, hasta: 2025 });

// Rango de edad (años cumplidos a la fecha de la atención) que pide el comité.
// Mínimo 18: los datos de niñas, niños y adolescentes son categoría especial (art. 25 LOPDP)
// y los grupos de edad del dataset empiezan en 18. edadHasta null = sin límite superior.
export const EDAD_MINIMA = 18, EDAD_MAXIMA = 105;
export const EDAD_ESTUDIO = Object.freeze({ edadDesde: EDAD_MINIMA, edadHasta: null });
export const FILTRO_ESTUDIO = Object.freeze({ capitulo: 'V', bloque: '', categoria: '', ...PERIODO_ESTUDIO, ...EDAD_ESTUDIO });

export const rangoEdad = f => ({
  desde: Number(f.edadDesde ?? EDAD_MINIMA),
  hasta: f.edadHasta === null || f.edadHasta === undefined || f.edadHasta === '' ? null : Number(f.edadHasta),
});
export const etiquetaEdad = f => {
  const { desde, hasta } = rangoEdad(f);
  return hasta === null ? `${desde} años o más` : desde === hasta ? `${desde} años` : `${desde} a ${hasta} años`;
};
export function validarEdad(f) {
  const { desde, hasta } = rangoEdad(f);
  if (!Number.isInteger(desde) || (hasta !== null && !Number.isInteger(hasta))) return 'La edad debe ser un número entero de años.';
  if (desde < EDAD_MINIMA) return `La edad mínima es ${EDAD_MINIMA} años: no se entregan datos de menores de edad.`;
  if (desde > EDAD_MAXIMA || (hasta !== null && hasta > EDAD_MAXIMA)) return `La edad debe estar entre ${EDAD_MINIMA} y ${EDAD_MAXIMA} años (o sin límite superior).`;
  if (hasta !== null && desde > hasta) return 'La edad inicial no puede ser mayor que la edad final.';
  return '';
}
export const enRangoEdad = (edad, f) => {
  const { desde, hasta } = rangoEdad(f);
  const e = Number(edad);
  return e >= desde && (hasta === null || e <= hasta);
};

// Los filtros sin periodo usan el del estudio.
export const periodo = f => ({ desde: Number(f.desde ?? PERIODO_ESTUDIO.desde), hasta: Number(f.hasta ?? PERIODO_ESTUDIO.hasta) });
export const etiquetaPeriodo = f => {
  const { desde, hasta } = periodo(f);
  return desde === hasta ? String(desde) : `${desde}-${hasta}`;
};
export function validarPeriodo(f, actual = anioActual()) {
  const { desde, hasta } = periodo(f);
  if (!Number.isInteger(desde) || !Number.isInteger(hasta)) return 'El periodo debe tener un año de inicio y uno de fin.';
  if (desde < PERIODO_MINIMO || hasta > actual) return `El periodo debe estar entre ${PERIODO_MINIMO} y ${actual}.`;
  if (desde > hasta) return 'El año de inicio no puede ser mayor que el año de fin.';
  return '';
}
// fecha_ingreso en formato AAAA-MM-DD.
export const enPeriodo = (fecha, f) => {
  const { desde, hasta } = periodo(f);
  return fecha >= `${desde}-01-01` && fecha <= `${hasta}-12-31`;
};

const esEdadDelEstudio = f => { const e = rangoEdad(f); return e.desde === EDAD_MINIMA && e.hasta === null; };
const esPeriodoDelEstudio = f => {
  const p = periodo(f);
  return p.desde === PERIODO_ESTUDIO.desde && p.hasta === PERIODO_ESTUDIO.hasta;
};
const esDiagnosticoDelEstudio = f => f.capitulo === 'V' && !f.bloque && !f.categoria;
export const esDelEstudio = f => esDiagnosticoDelEstudio(f) && esPeriodoDelEstudio(f) && esEdadDelEstudio(f);

export function coincide(codigo, filtro) {
  // Regla exacta del diccionario para el estudio: el código empieza con «F».
  if (esDiagnosticoDelEstudio(filtro)) return codigo.startsWith('F');
  const c = codigo.slice(0, 3);
  if (!/^[A-Z]\d{2}$/.test(c)) return false;
  const r = filtro.categoria ? { desde: filtro.categoria, hasta: filtro.categoria }
    : bloquesDe(filtro.capitulo).find(b => b.id === filtro.bloque) ?? CAPITULOS.find(x => x.id === filtro.capitulo);
  return !!r && c >= r.desde && c <= r.hasta;
}

export function etiquetaFiltro(f) {
  if (f.categoria) return `categoría ${f.categoria}`;
  if (f.bloque) return `grupo ${f.bloque}`;
  const c = CAPITULOS.find(x => x.id === f.capitulo);
  return `capítulo ${c.id} (${c.desde}-${c.hasta})`;
}

export function nombreCIE10(codigo) {
  const c = codigo.slice(0, 3);
  return CATEGORIAS_F[c] ?? CAPITULOS.find(x => c >= x.desde && c <= x.hasta)?.nombre ?? 'Código no catalogado';
}
