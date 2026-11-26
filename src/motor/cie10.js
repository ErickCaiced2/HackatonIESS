// Catálogo CIE-10: los 22 capítulos y, del capítulo V (salud mental), grupos y categorías
// de 3 caracteres. No incluye subcategorías (F32.1) ni categorías de otros capítulos.
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

// Filtro que pide el estudio.
export const FILTRO_ESTUDIO = Object.freeze({ capitulo: 'V', bloque: '', categoria: '' });
export const esDelEstudio = f => f.capitulo === 'V' && !f.bloque && !f.categoria;

export function coincide(codigo, filtro) {
  // Regla exacta del diccionario para el estudio: el código empieza con «F».
  if (esDelEstudio(filtro)) return codigo.startsWith('F');
  const c = codigo.slice(0, 3);
  if (!/^[A-Z]\d{2}$/.test(c)) return false;
  const r = filtro.categoria ? { desde: filtro.categoria, hasta: filtro.categoria }
    : BLOQUES_F.find(b => b.id === filtro.bloque) ?? CAPITULOS.find(x => x.id === filtro.capitulo);
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
