# Estandarizador de CSV con IA local

Estado: **primera versión implementada** (ver sección 15). Complementa [PLAN.md](PLAN.md).

## 1. Decisiones del equipo
| Tema | Decisión |
|---|---|
| IA | Modelo propio y pequeño, en JavaScript, dentro de la aplicación; sin internet |
| Control | La IA propone; la persona confirma |
| Alcance | Nombres de columnas y formatos de valores |
| Datos faltantes | Derivar; si es esencial y no se puede, bloquear |
| Columnas extra | No pasan a la salida |

## 2. Qué se promete y qué no
**Entra:** un archivo de texto delimitado (`,` `;` tabulador o `|`), con encabezado, una fila por atención.

**No entra en esta versión:** Excel, JSON, volcados SQL, varias tablas que haya que unir, archivos sin encabezado ni columnas con varios datos mezclados.

No es posible garantizar «cualquier base». La promesa es: **o se estandariza correctamente con confirmación, o el sistema se detiene y explica por qué.**

## 2.1 Mínimo de datos para ingresar: 8
Se exige el **dato**, no el nombre de la columna. La IA reconoce cómo se llama en cada origen. El mínimo es para este estudio.

| # | Dato mínimo | Para qué | Alternativa aceptada |
|---|---|---|---|
| 1 | Identificador estable de la persona | Unir atenciones y contar k por persona | Cédula, historia clínica u otro código que no cambie entre atenciones del archivo |
| 2 | Edad en la fecha de atención | Cohorte y grupo de edad | Fecha de nacimiento (se calcula) |
| 3 | Sexo | Pregunta del estudio y k | — |
| 4 | Ubicación | Región | Provincia, o región ya escrita |
| 5 | Fecha de atención o ingreso | Periodo y año-mes | — |
| 6 | Tipo de atención | Salida pedida por el investigador | — |
| 7 | Diagnóstico CIE-10 (código) | Cohorte y objeto del estudio | — |
| 8 | Días de estancia | Salida pedida | Fecha de egreso (se calcula) |

- Pueden llegar como 8 columnas o más. No se exigen nombres, apellidos, teléfono ni correo: **mientras menos identificadores lleguen, mejor**.
- El mínimo se comprueba **por valores**: una columna presente pero vacía o inválida no cumple. Si hay filas incompletas, se informa la cantidad y se bloquea.
- Si falta un dato, no se continúa y se dice cuál falta y qué alternativa sirve.
- Con historia clínica como identificador: si una persona tiene varias (por ejemplo, una por establecimiento), se contará varias veces e inflará k. La persona operadora debe confirmar que es única.
- El `id_atencion` no cuenta: se genera.
- Estas alternativas requieren cambiar el motor, que hoy exige las 28 columnas.

## 2.2 Archivos de distintos orígenes
La IA no depende de saber de dónde viene el archivo: usa nombres y contenido.

| Diferencia entre orígenes | Tratamiento |
|---|---|
| Nombres distintos o sin significado | Modelo (nombre y contenido) más confirmación. Columnas parecidas, como fecha de ingreso y egreso sin nombre claro, se preguntan |
| Separador, codificación, formatos | Lectura flexible y normalización |
| Más columnas | Se eliminan |
| Menos columnas | Se comprueba el mínimo de 8 |
| Origen ya revisado | **[Propuesta]** Guardar la «receta» (asignaciones y equivalencias, sin datos de personas) en un archivo, para reutilizarla. Se vuelve a validar y confirmar |

**Un archivo ya consolidado de varios orígenes** puede mezclar formatos entre filas: «M» puede significar mujer en unas y masculino en otras, o 03/04 ser dos fechas distintas. Si se detecta mezcla y ninguna columna indica el origen de cada fila, se bloquea. No toda mezcla se puede detectar: **cada origen debe cargarse por separado**.

Cada ejecución procesa **un archivo**. Unir varios queda fuera: exige saber que el identificador de persona significa lo mismo en todos, y k tendría que medirse sobre el conjunto unido. Anonimizarlos por separado y juntarlos después requiere volver a evaluar el riesgo, y la misma persona tendría códigos distintos.

## 3. Flujo
```
Leer → Perfilar columnas → IA propone → Guardas → Persona confirma
     → Normalizar valores → Derivar → Validar → Motor actual
```
El motor de anonimización y medición no cambia. Recibe siempre los nombres canónicos.

**Regla de compatibilidad:** un archivo que ya cumple el diccionario (incluido el testigo) pasa sin ningún cambio de valores y produce las mismas métricas.

## 4. Lectura flexible
- Detectar separador respetando comillas. Si dos separadores son plausibles, preguntar.
- UTF-8; si falla, proponer Windows-1252 y mostrar que se aplicó.
- Si el encabezado parece contener datos (cédulas, correos, fechas), bloquear sin mostrarlo.

## 5. La IA: clasificador de columnas
**Tarea:** para cada columna, elegir una de 29 clases: las 28 canónicas o `desconocida`.

**Algoritmo:** regresión logística multiclase (softmax). Es aprendizaje supervisado, pequeño y explicable.

| Grupo de características | Ejemplos |
|---|---|
| Nombre | Fragmentos de 2 a 4 letras tras quitar tildes y separar `fechaNac`, `ced_pac` |
| Forma del contenido | Proporción de fechas, enteros, 10 dígitos, correos, patrón CIE-10 |
| Estadística | Valores distintos, vacíos, longitud media, rango numérico |
| Catálogos | Coincidencia con sexo, provincias, etnias, tipos de atención |

**Salida por columna:** clase propuesta, confianza, segunda opción y las tres señales que más pesaron. Nunca se muestran valores de celdas.

El perfil se calcula localmente con todas las filas. Del perfil no se guarda ningún valor.

**Asignación:** una columna de entrada por cada campo canónico. Si dos compiten, ninguna se acepta sin que la persona elija.

| Confianza (umbral inicial, se calibra) | Comportamiento |
|---|---|
| ≥ 0,85 | Propuesta preseleccionada |
| 0,50 a 0,85 | Hay que revisarla una por una |
| < 0,50 | `desconocida` hasta que la persona asigne |

Siempre hay una confirmación final.

### 5.1 Entrenamiento
- **Solo datos inventados** por un generador propio. No se usan filas de la base de práctica ni del testigo.
- Variaciones: sinónimos, abreviaturas, errores de tipeo, mayúsculas, nombres sin significado (`col_7`), otros formatos, vacíos.
- Se entrena con Node.js y se guardan los pesos en `src/ia/pesos.json`. Semilla fija para repetirlo.
- La aplicación solo predice; no aprende de los archivos cargados.

### 5.2 Evaluación
Separar por **familias de nombres**: los sinónimos de prueba no aparecen en el entrenamiento. Incluir un conjunto escrito a mano por alguien que no hizo el generador.

| Métrica | Meta propuesta |
|---|---|
| **Errores críticos:** un identificador o texto libre llega a una columna de salida | **0** |
| Aciertos en los campos esenciales | ≥ 95 % |
| Aciertos en las 29 clases | ≥ 85 % |
| Columnas desconocidas reconocidas como tales | Se informa |
| Archivo con nombres oficiales | 100 % |

Se compara contra una línea base de diccionario de sinónimos. **Si el modelo no la supera, se dice.** La precisión con datos inventados no demuestra la precisión con bases reales.

## 6. Guardas (reglas, no IA)
La confianza del modelo nunca basta para dejar salir un dato. Tampoco la confirmación de una persona salta estas reglas.

| Campo que influye en la salida | Debe cumplir en todas sus filas |
|---|---|
| sexo | Normaliza a H o M |
| provincia | Está en el catálogo |
| fecha_ingreso | Fecha válida |
| edad | Entero de 0 a 120 |
| tipo_atencion | Consulta externa, Emergencia u Hospitalización |
| diagnostico_cie10 | Forma de código CIE-10 |
| dias_estancia | Entero de 0 o más |

- Una columna con correos, cédulas, teléfonos o historias clínicas no puede asignarse a un campo de salida.
- Lo desconocido se elimina. La salida sigue siendo una **lista cerrada** de columnas.
- Un valor que no se puede normalizar **no se adivina ni se borra en silencio**: se informa la cantidad y se bloquea.

## 7. Normalización de valores (reglas)
| Campo | Se acepta | Cuándo preguntar o bloquear |
|---|---|---|
| Fechas | AAAA-MM-DD, DD/MM/AAAA, MM/DD/AAAA, con hora | Si ningún valor permite distinguir día de mes, preguntar. Años de 2 dígitos: preguntar |
| Sexo | Hombre, Mujer, Masculino, Femenino, H, M, F | Ver la regla de abajo. Códigos 1/2: preguntar |
| Provincia | Sin tildes, mayúsculas, errores leves con un único candidato | Correcciones aproximadas: confirmar. Ambiguo: bloquear |
| CIE-10 | `f321`, `F32 1` → `F32.1` | Solo descripción o varios códigos: bloquear |
| Tipo de atención | Equivalencias conocidas (ej. «urgencias») | Valor nuevo: la persona lo asigna |
| Cédula / id de persona | Texto | 9 dígitos: proponer reponer el cero inicial |

### La letra «M» es ambigua
En el diccionario del reto **M es mujer**. En otras bases M es masculino.

| Valores en la columna | Interpretación propuesta |
|---|---|
| H y M | H = hombre, M = mujer |
| M y F | M = masculino → H; F → M |
| Solo M, o H, M y F mezclados | Preguntar. No continuar sin respuesta |

Siempre se muestra la equivalencia para confirmar. Un error aquí invierte los resultados del estudio sin dar ningún fallo visible.

## 8. Campos esenciales y derivaciones
| Campo canónico | Si falta |
|---|---|
| cedula | Aceptar otro identificador estable de persona que confirme el operador. Sin él, bloquear |
| fecha_ingreso, diagnostico_cie10, sexo, tipo_atencion | Bloquear |
| edad | Derivar de fecha_nacimiento y fecha_ingreso (años cumplidos) |
| provincia | **[Propuesta]** Aceptar región si ya viene; requiere ampliar el motor. Sin ambas, bloquear |
| dias_estancia | Derivar de fecha_egreso − fecha_ingreso; si no, bloquear |
| id_atencion | Generar por orden de fila; declarar que afecta el desempate de la primera atención |
| Las demás | Quedan ausentes. No se inventan |

- Un identificador de persona nunca se genera a partir del número de fila: k contaría atenciones como personas.
- Si edad y fecha de nacimiento se contradicen, informar cuántas filas y preguntar cuál usar.
- Las columnas ausentes no entran en la k de «antes». La pantalla indica **con cuántos cuasiidentificadores se midió**, porque ese valor no es comparable entre bases.
- Una columna nueva que no está entre las 28 se elimina, aunque pueda ser identificadora.

## 9. Cambios en el sistema
```
src/ia/        perfil.js, modelo.js, guardas.js, normalizar.js, estandarizar.js, pesos.json
entrenamiento/ generar.js, entrenar.js, evaluar.js
tests/         estandarizar.test.js
```
- `motor.leer` hoy exige exactamente las 28 columnas. Se separa en: estandarizar → validar canónico.
- Nuevo paso en el panel «1. Datos»: **Revisar columnas**, con resumen primero (listas, por revisar, esenciales faltantes) y detalle desplegable.
- Cada decisión permite deshacer.

## 10. Trazabilidad
Por columna: nombre original, campo asignado, confianza, señales, quién decidió (modelo confirmado o corregido por la persona), regla de normalización, celdas cambiadas y derivaciones. Por ejecución: versión y huella de los pesos.

Sin valores de celdas. Los nombres originales de columnas desconocidas **no van al PTA**, porque un nombre puede contener información personal.

## 11. Criterios de aceptación
| ID | Dado | Entonces |
|---|---|---|
| IA-01 | Un archivo con nombres oficiales | 0 valores cambiados y mismas métricas |
| IA-02 | Los casos trampa con columnas renombradas, `;` y fechas DD/MM/AAAA | Tras confirmar, mismas métricas que el original |
| IA-03 | Una columna de correos llamada `tipo` | No puede llegar a la salida |
| IA-04 | Sexo con M y F | M se convierte en H, con confirmación |
| IA-05 | Fechas todas ambiguas | Pregunta antes de continuar |
| IA-06 | Falta tipo_atencion | Bloquea y lo nombra |
| IA-07 | Falta edad pero hay nacimiento | La deriva y lo registra |
| IA-08 | Columnas extra | No aparecen en la salida |
| IA-09 | Valores marcadores | No aparecen en pantalla de revisión, informe ni PTA |

## 12. Orden de construcción
La entrega es el viernes 27 de 13h30 a 14h00.

| Fase | Contenido | Resultado utilizable |
|---|---|---|
| 1 | Separador, normalización, guardas y asignación manual con sinónimos | Ya admite otras bases con revisión |
| 2 | Generador, entrenamiento, modelo y evaluación | La IA propone y se mide contra la fase 1 |
| 3 | Pantalla de revisión pulida y trazabilidad | Demo completa |

Cada fase se prueba con IA-01 antes de continuar. **Si IA-01 falla, no se integra:** primero está coincidir con la tarjeta del jurado.

## 13. Riesgos
| Riesgo | Mitigación |
|---|---|
| El estandarizador altera el testigo y no coinciden las métricas | IA-01 y paso directo para archivos oficiales |
| Asignación equivocada con alta confianza | Guardas y confirmación |
| El operador confirma sin leer | Las dudosas se confirman una por una; sexo y fechas muestran la equivalencia |
| Modelo bueno solo con datos inventados | Conjunto manual y comparación con la línea base |
| Falta de tiempo | La fase 1 funciona sin el modelo |

## 14. Para declarar
Modelo propio entrenado con datos sintéticos generados por el equipo; sin servicios externos; asistentes de código usados en su desarrollo.

## 15. Estado de la primera versión

**Implementado:** lectura con detección de separador, modelo softmax (`src/ia/`), guardas, normalización, derivaciones, pantalla de revisión y registro en trazabilidad.

**Repetir el entrenamiento y las pruebas:** `node entrenamiento/entrenar.js` y `node --test`.

### Medición
| Conjunto | Aciertos | Necesarias |
|---|---|---|
| Nombres no vistos (sintético, 620 columnas) | 96,3 % | 100 % |
| Ruido y columnas sin nombre (sintético, 620 columnas) | 97,9 % | 94,4 % (bajo la meta de 95 %) |
| Línea base de diccionario, nombres no vistos | 6,5 % | — |
| 8 bases de `pruebas_ia/`, primera ejecución (5 archivos procesables, 70 columnas) | 65 de 70 | 42 de 44 |
| Igual, tras añadir la sugerencia de datos mínimos | 67 de 70 | 44 de 44 |

- La segunda fila de las bases de prueba **ya no es una medición independiente**: la regla se añadió al ver los fallos.
- Los 3 errores restantes son columnas de nombres tratadas como campos que se eliminan.
- El archivo oficial se resuelve por nombre, no por el modelo.
- Los datos de prueba, el generador y el modelo tienen el mismo autor. **No se ha medido con bases de terceros.**
- Las columnas sin correspondencia a veces reciben un campo equivocado con confianza alta (ej.: nombre del médico como tipo de establecimiento, 94 %). La confianza no garantiza acierto.

### Diferencias con el diseño
- El perfil usa una muestra repartida de hasta 2000 filas; las guardas revisan todas.
- Un nombre idéntico al diccionario se asigna directamente.
- No hay «receta» por origen, ni deshacer dentro de la revisión (se puede cambiar cada selector), ni comparación entre edad y fecha de nacimiento cuando vienen ambas.
- La mezcla de orígenes solo se detecta en fechas con órdenes incompatibles y en códigos de sexo contradictorios.
