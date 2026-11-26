# Reto 2 · Tus datos, tus derechos: especificación y plan

Primero especificar, después programar. **Si una verificación falla, se corrige el prototipo, no la especificación.**
Fuentes: diccionario v3, solicitud del investigador, conceptos y métricas, plantilla PTA y guía del reto.
Las marcas **[Propuesta]** son decisiones nuestras. Las marcas **[Confirmar]** son dudas para la mentoría.

## 1. Objetivo y alcance

Entregar a un investigador una cohorte de salud mental anonimizada, con evidencia medible del riesgo de reidentificación y de la utilidad que se conserva.

- **Actores:** operador del IESS (usa el prototipo), investigador (recibe las salidas), titular (persona protegida), jurado (verifica).
- **Dentro:** cargar, extraer, clasificar, anonimizar, medir y exportar.
- **Fuera:** aprobación del estudio, seudonimización, reidentificación y datos reales.

### Condiciones de elegibilidad
1. Las partes 1 (antes) y 2 (configuración de referencia) de la tarjeta del jurado coinciden.
2. La configuración propia logra k ≥ 5 por persona.
3. Hay cero identificadores directos.

## 2. Reglas del equipo
- Solo datos sintéticos del reto. Los datos no salen del evento.
- A una IA solo se le dan el diccionario, la solicitud y muestras de hasta 100 filas.
- **Ningún CSV se sube al repositorio** (base, testigo ni salidas). La salida se entrega en la carpeta oficial.
- Se declaran los asistentes de IA y las librerías. Cada integrante debe poder explicar el código y las métricas.
- Nunca se afirma «riesgo cero». Un hash de la cédula no es anonimizar.

## 3. Comportamiento del sistema

### 3.1 Flujo
`1 Cargar → 2 Cohorte → 3 Clasificar → 4 Medir ANTES → 5 Configurar → 6 Anonimizar → 7 Medir DESPUÉS → 8 Exportar`

Anonimizar y medir se repiten hasta cumplir las metas.

| Paso | El operador | El sistema | Si algo falla |
|---|---|---|---|
| Cargar | Elige un CSV | Lee UTF-8; trata cédula y teléfono como texto; valida columnas; muestra filas y personas | Indica la columna que falta o la fila inválida y no continúa |
| Cohorte | Pulsa «Extraer» | Filtra y muestra personas, atenciones y excluidos | Cohorte vacía: avisa y no continúa |
| Clasificar | Revisa la tabla | Muestra rol, categoría especial, si se pide y técnica de las 28 columnas | Columna sin clasificar: bloquea |
| Medir antes | Observa | Calcula los indicadores sobre la cohorte original | — |
| Configurar | Elige «Referencia» o «Propia» | Referencia: solo lectura. Propia: parámetros editables | Parámetro inválido: lo explica |
| Anonimizar | Pulsa «Anonimizar» | Parte siempre de la cohorte original, nunca de una salida anterior | Provincia sin región: detiene y la nombra |
| Medir después | Observa | Compara antes y después con cumple / no cumple | — |
| Exportar | Pulsa «Descargar» | Genera CSV, configuración y PTA | Si k < 5, hay identificadores o la salida está vacía: bloquea |

### 3.2 Estados
`SIN_DATOS → CARGADO → COHORTE_LISTA → CLASIFICADO → MEDIDO_ANTES → ANONIMIZADO → APTO | NO_APTO`

- Solo `APTO` permite exportar.
- Cambiar un parámetro invalida el resultado y vuelve a `MEDIDO_ANTES`.
- Cargar otro archivo borra todo y vuelve a `CARGADO`.

### 3.3 Configuración de referencia (regla exacta del diccionario)
1. **Cohorte:** diagnóstico que empieza con `F`, edad ≥ 18 y fecha_ingreso de 2023-01-01 a 2025-12-31.
2. **Código:** cédula → `id_paciente_estudio` aleatorio por persona (ej. P00001), sin guardar la correspondencia.
3. **Grupo de edad:** 18-39, 40-59, 60-79, 80+, según la edad de la **primera atención en la cohorte**; igual en todas sus filas.
4. **Región:** provincia → Costa, Sierra, Amazonía o Insular, con las 24 provincias de la hoja Regiones.
5. **Fecha:** fecha_ingreso → `anio_mes` (AAAA-MM).
6. **Columnas de salida:** `id_paciente_estudio, grupo_edad, sexo, region, anio_mes, tipo_atencion, diagnostico_cie10, dias_estancia`.
7. **Supresión:** calcular k con grupo_edad, sexo y region; eliminar todas las filas de las personas con k < 5.

**[Propuesta]** Tras suprimir, recalcular k y repetir hasta que nadie tenga k < 5. Una persona con atenciones en varias regiones podría cambiar otros grupos al eliminarse. **[Confirmar]** que el jurado espera lo mismo.

**[Propuesta]** Si dos atenciones comparten la primera fecha, usar el menor id_atencion.

El código aleatorio usa un generador criptográfico, no depende de la cédula ni del orden de las filas, y la tabla temporal se descarta al terminar.

### 3.4 Medición (regla exacta del diccionario)
| Indicador | Cálculo |
|---|---|
| Persona | Antes: cédula. Después: id_paciente_estudio |
| Cuasiidentificadores | Los presentes de: fecha_nacimiento, edad, grupo_edad, sexo, etnia, provincia, region, canton, establecimiento_id |
| k por persona | Personas distintas con su misma combinación; si tiene varias, la **menor** |
| k mínimo | Menor k por persona |
| Personas únicas | % de personas con k = 1 |
| Identificadores | Columnas presentes (historia_clinica, cedula, nombres, apellidos, telefono, correo) **+** celdas de texto con cédula, teléfono, correo o historia clínica |
| Personas conservadas | Personas de salida ÷ personas de la cohorte |
| Consulta del estudio | Personas distintas por región y sexo; diferencia relativa por celda; celda desaparecida = 100 %; máximo y promedio de las celdas |
| Grupo homogéneo | k ≥ 5 y todas con el mismo diagnóstico (3 primeros caracteres CIE-10) |

- En «antes», la región de la consulta se obtiene de la provincia.
- **[Propuesta]** Patrones de texto: 10 dígitos (cédula o teléfono), correo y `HC-` con 7 dígitos. No contar dos veces una celda.
- Redondear solo al mostrar, a un decimal.

### 3.5 Configuración propia [Propuesta]
La referencia, más:
- **l-diversidad (l ≥ 2)** sobre los 3 primeros caracteres del diagnóstico: suprimir los grupos homogéneos y volver a medir.
- **Agrupar estancias extremas:** `dias_estancia` ≥ 30 → `30+`.

En práctica hay un grupo homogéneo informado: 40-59 · H · Insular, 6 personas, todas F10. Si es el único y la supresión no genera otro, quedarían 897 de 910 (98,6 %). **Es una estimación; hay que ejecutarla.** Además, desaparecería otra parte de la celda Insular · H, así que se debe mostrar el costo en utilidad.

Alternativa más suave: generalizar el diagnóstico de ese grupo a `F`. Conserva personas, pero reduce el detalle del atributo estudiado y **no** crea diversidad con la regla de 3 caracteres.

Parámetros editables: k, ancho de edad, nivel geográfico, fecha (mes o año), l y tope de estancia. En la propia, el sistema nunca permite exportar con k < 5.

### 3.6 Transformación de las 28 variables (referencia)

> **Diferencia en los insumos:** el encabezado del CSV de práctica dice `id_hc`; el diccionario y la regla de medición dicen `historia_clinica`.
> **[Propuesta]** Tratar ambos nombres como la misma variable: identificador directo. Si no se reconoce `id_hc`, el conteo inicial puede dar 5 columnas en vez de 6 y la columna no se detectaría como identificador. **[Confirmar]** qué nombre traerá el testigo.

| Variable | Técnica | En la salida |
|---|---|---|
| cedula | Código aleatorio sin correspondencia | id_paciente_estudio |
| historia_clinica (`id_hc`), nombres, apellidos, telefono, correo | Supresión | No sale |
| edad | Generalización (primera atención) | grupo_edad |
| sexo | Conservar | sexo |
| provincia | Jerarquía provincia → región | region |
| fecha_ingreso | Generalización | anio_mes |
| tipo_atencion | Conservar | tipo_atencion |
| diagnostico_cie10 | Conservar | diagnostico_cie10 |
| dias_estancia | Conservar (en la propia: agrupar extremos) | dias_estancia |
| id_atencion, fecha_nacimiento, etnia, canton | Supresión | No sale |
| tipo_seguro, discapacidad, establecimiento_id, tipo_establecimiento, nivel_atencion | Supresión | No sale |
| fecha_egreso, servicio, diagnostico_descripcion, condicion_egreso, costo_atencion_usd | Supresión | No sale |
| observacion | Supresión del texto libre | No sale |

Orden: cohorte (por filas) → grupo de edad (por persona) → código → región y fecha → minimización → supresión por k → medición.

La cohorte se filtra primero porque usa la edad, la fecha y el diagnóstico originales.

### 3.7 Trazabilidad de las transformaciones

Cada ejecución tiene un `id_ejecucion`. El CSV, la configuración, el informe y el PTA lo comparten. El informe se construye con lo que el motor **realmente hizo**, no con un texto fijo ni copiando la configuración.

**Archivo `R2_EquipoNN_trazabilidad.json`**, con una vista legible en pantalla.

**Cabecera:** id_ejecucion, fecha y hora, versión del prototipo, tipo de configuración (referencia o propia), parámetros usados, huella SHA-256 del CSV de salida y de la configuración, y estado APTO / NO APTO.

La huella es de los archivos de salida, nunca de la cédula ni de otro dato de una persona.

**Por columna:** una entrada por cada columna de entrada (28), incluidas las conservadas y eliminadas.

| Campo | Contenido |
|---|---|
| columna_entrada | Nombre tal como llegó |
| clasificacion | Identificador directo, cuasiidentificador, atributo objetivo u otro |
| categoria_especial | Literal del art. 25 o ninguna |
| solicitada | Sí, no o solo para unir atenciones |
| tecnica | Conservar, suprimir, código aleatorio, generalizar, jerarquía o agrupar extremos |
| parametro | Por ejemplo, rangos de edad o tope de estancia |
| columna_salida | Nombre final o «no sale» |
| justificacion | Motivo de la decisión |
| valores_modificados | Conteo de celdas cuyo valor cambió; en supresión, celdas no vacías retiradas |
| distintos_antes / distintos_despues | Cantidad de valores distintos, nunca la lista |
| estado | Aplicada, no fue necesaria (0 cambios) o fallida |

`valores_modificados` se mide sobre la cohorte, antes de suprimir personas. Un fallo en cualquier columna deja la ejecución `NO_APTO`.

**Por operación sobre filas:** cohorte, supresión por k y supresión por l-diversidad. Cada una registra orden, regla, parámetro, personas y atenciones antes y después, y vuelta de la iteración.

Ejemplo de entrada (los conteos se llenan al ejecutar):
```json
{ "columna_entrada": "provincia", "clasificacion": "cuasiidentificador",
  "tecnica": "jerarquia", "parametro": "provincia->region",
  "columna_salida": "region", "estado": "aplicada" }
```

**Prohibido en el informe y en el PTA:** valores originales de una persona, ejemplos reales de celdas, texto libre, correspondencias cédula-código, listas de códigos o personas suprimidas y números de fila afectados. La trazabilidad es del proceso, no de las personas.

### 3.8 PTA generado con métricas

**Archivo `R2_EquipoNN_PTA`**, siguiendo la plantilla oficial. **[Propuesta]** HTML imprimible a PDF; **[Confirmar]** el formato aceptado.

| Sección de la plantilla | Se llena con | Origen |
|---|---|---|
| 1. Datos generales | Equipo, estudio, personas y atenciones entregadas, herramienta, configuración, fecha, id_ejecucion | Operador y ejecución |
| 2. Minimización | Cohorte y variables entregadas y eliminadas, con motivo | Trazabilidad |
| 3. Técnicas por variable | Variable, clasificación, técnica, parámetro y justificación; anexo con los conteos | Trazabilidad |
| 4. Riesgo | Antes y después: personas, atenciones, k, únicos, identificadores (columnas y texto), conservadas, consulta máx./prom., grupos homogéneos y su tratamiento, supuestos sobre el atacante | Medición y equipo |
| 5. Riesgo residual y mitigación | Riesgos, medidas, condiciones de uso y reevaluación anual como mínimo | Equipo; el sistema propone un borrador |
| 6. Resumen para el titular | Datos usados, finalidad, protección y derechos, en lenguaje claro | Equipo; el sistema propone un borrador |

- Las cifras y los textos base de las secciones 5 y 6 no se editan en pantalla; el equipo los revisa y marca. Solo escribe el supuesto sobre el atacante y el canal de derechos.
- Se indica el efecto de cada paso de supresión en personas, atenciones, k y grupos homogéneos.
- Cambiar la configuración invalida el informe y el PTA anteriores.
- El PTA nunca afirma «riesgo cero».
- **[Propuesta]** El PTA no detalla celdas con menos de 5 personas ni combina región, sexo, edad y diagnóstico de un grupo suprimido. Informa cantidades agregadas y los máximos y promedios. El detalle de la consulta y las alertas se ve solo en la pantalla del operador. **[Confirmar]** si el jurado exige ese detalle en el PTA.

## 4. Requisitos funcionales
P0 = obligatorio. P1 = suma puntos. P2 = solo si sobra tiempo.

| ID | P | El sistema debe… |
|---|---|---|
| RF-01 | P0 | Cargar cualquier CSV con la estructura de la base, incluido el testigo, y validarlo |
| RF-02 | P0 | Extraer la cohorte de la configuración de referencia |
| RF-03 | P0 | Clasificar las 28 columnas (rol, categoría del art. 25 y si se piden) desde un archivo del equipo |
| RF-04 | P0 | Eliminar las variables no solicitadas |
| RF-05 | P0 | Reemplazar la cédula por un código aleatorio por persona |
| RF-06 | P0 | Aplicar una técnica por variable (conservar y eliminar incluidas) |
| RF-07 | P0 | Ejecutar la configuración de referencia exacta |
| RF-08 | P0 | Permitir una configuración propia con parámetros editables |
| RF-09 | P0 | Medir riesgo antes y después según 3.4 |
| RF-10 | P0 | Medir personas conservadas y consulta del estudio |
| RF-11 | P0 | Mostrar la pantalla de resultados: personas, atenciones, k, únicos, identificadores, conservadas y cambio máximo / promedio |
| RF-12 | P0 | Exportar `R2_EquipoNN_salida.csv` (UTF-8, comas, encabezado) y la configuración en JSON |
| RF-13 | P0 | Bloquear la exportación si no cumple las condiciones |
| RF-14 | P1 | Alertar grupos homogéneos y permitir tratarlos |
| RF-15 | P1 (prioridad del equipo) | Generar el PTA según 3.8, con las decisiones y métricas medidas |
| RF-18 | P0 del equipo | Registrar cada transformación según 3.7 y exportar el informe |
| RF-16 | P1 | Probar vinculación con el padrón auxiliar. **[Confirmar]** no está entre los archivos recibidos |
| RF-17 | P2 | Registrar la ejecución (fecha, configuración, métricas), sin datos personales |

## 5. Requisitos no funcionales
| ID | Atributo | Requisito medible | Cómo se verifica |
|---|---|---|---|
| RNF-01 | Seguridad: confidencialidad | Todo se procesa en local; 0 peticiones de red con datos | Demo sin internet y revisión de la pestaña Red |
| RNF-02 | Seguridad: minimización | La salida de referencia tiene exactamente las 8 columnas permitidas | Prueba automática del encabezado |
| RNF-03 | Seguridad: irreversibilidad | 0 tablas cédula-código guardadas o exportadas | Revisión de código y de archivos generados |
| RNF-04 | Seguridad: fuga | 0 datos personales en consola, errores, registros, almacenamiento del navegador o repositorio | Revisión y `git status` antes de cada commit |
| RNF-05 | Seguridad: entrada | El contenido del CSV nunca se ejecuta ni se interpreta como HTML; se neutralizan fórmulas en la exportación | Prueba con celdas maliciosas sintéticas |
| RNF-06 | Corrección | 100 % de los valores de control coinciden | CA-02 y CA-03 |
| RNF-07 | Reproducibilidad | Mismos datos y configuración producen las mismas métricas; solo cambian los códigos | Dos ejecuciones comparadas |
| RNF-08 | Rendimiento [Propuesta] | Procesar la base de práctica en ≤ 10 s en el equipo de la demo | Cronómetro, 3 ejecuciones |
| RNF-09 | Usabilidad [Propuesta] | Una persona nueva completa el flujo en ≤ 3 min sin ayuda | Prueba con alguien externo al código |
| RNF-10 | Accesibilidad [Propuesta] | Uso con teclado, etiquetas, contraste ≥ 4,5:1 y estado con texto, no solo color | Lista de comprobación |
| RNF-11 | Mantenibilidad | Reglas en configuración; motor separado de la interfaz | Revisión de código |

## 6. Criterios de aceptación

**CA-01 Carga.** Dado un CSV sin una columna requerida, cuando se carga, entonces se nombra la columna y no se procesa.

**CA-02 Antes.** Dada la base de práctica, cuando extraigo la cohorte y mido, entonces obtengo 910 personas, 1016 atenciones, k = 1, 100,0 % únicas y 6 columnas + 18 en texto.

**CA-03 Referencia.** Dada esa cohorte, cuando aplico la referencia, entonces obtengo 903 personas, 1009 atenciones, k = 6, 0,0 % únicas, 0 + 0 identificadores, 99,2 % conservadas y cambio máximo / promedio de 100,0 % / 32,1 %.

**CA-04 Consulta del estudio.**
| Celda | Antes | Después |
|---|---|---|
| Amazonía · H | 2 | 0 |
| Amazonía · M | 3 | 0 |
| Costa · H | 229 | 229 |
| Costa · M | 207 | 207 |
| Insular · H | 8 | 6 |
| Sierra · H | 240 | 240 |
| Sierra · M | 221 | 221 |

**CA-05 Homogéneo.** Con la referencia, alerta 40-59 · H · Insular: 6 personas, todas F10.

**CA-06 Bloqueo.** Dada una configuración que da k < 5 sin supresión, el resultado es `NO_APTO` y no se puede exportar.

**CA-07 Trazabilidad.** Dada una ejecución, el informe tiene una entrada por cada columna de entrada; las columnas de salida coinciden con el CSV (el código por persona se vincula a cedula); las operaciones sobre filas cuadran de principio a fin (referencia en práctica: la supresión pasa de 910 a 903 personas y de 1016 a 1009 atenciones).

**CA-08 PTA.** Dada una ejecución APTA, las seis secciones están completas y sus métricas e id_ejecucion coinciden con la pantalla y el informe. Al cambiar un parámetro, no se puede descargar el PTA anterior.

**CA-09 Sin fugas.** Con un CSV sintético propio que tiene valores marcadores en identificadores y texto libre, ningún marcador aparece en el informe ni en el PTA.

**No escribir en el código los valores de control.** Solo viven en las pruebas.

### Casos trampa (probar con un CSV sintético pequeño propio)
| Caso | Resultado esperado |
|---|---|
| Menor de 18 con diagnóstico F | Fuera de la cohorte |
| Persona que cumple 18 entre dos atenciones | Solo entra la atención con 18 o más |
| Persona de 104 años | Grupo 80+ |
| Persona sola en Galápagos | Suprimida con todas sus filas |
| Cédula en texto libre | Se cuenta antes; no aparece después |
| Grupo homogéneo | Alerta |
| Una persona con varias atenciones | Cuenta como 1 persona |
| Persona con dos provincias | Se toma su k más pequeño |
| Cédula o teléfono con cero inicial | Se conserva como texto al leer |
| Fechas límite 2023-01-01 y 2025-12-31 | Incluidas |

## 7. Diseño técnico [Propuesta]
**Aplicación web estática (HTML, CSS y JavaScript) sin servidor.** Se abre en el navegador, funciona sin internet y los datos no salen de la máquina. Node.js ya está instalado en este equipo para las pruebas. Si el equipo domina mucho más Python, usen eso: pesa más que todo lo anterior. En este equipo faltan pandas y Streamlit.

```
HackatonIESS/
├─ index.html
├─ src/motor/   csv, cohorte, anonimizar, medir, pta  (sin interfaz)
├─ src/ui/      pantallas
├─ config/      clasificacion.json, referencia.json, propia.json, regiones.json
├─ tests/       pruebas y CSV trampa en código, sin datos del reto
├─ docs/        PLAN.md, decisiones.md, riesgos.md
├─ .gitignore
└─ README.md    cómo ejecutar, librerías y uso de IA
```

Contrato del motor, a fijar antes de repartir el trabajo:
- `leer(texto) → filas`
- `extraerCohorte(filas, config) → cohorte`
- `anonimizar(cohorte, config) → salida`
- `medir(dataset, cohorte) → { personas, atenciones, kMin, pctUnicas, identColumnas, identTexto, pctConservadas, consulta, homogeneos }`

### Pantallas
Cinco: Cargar, Configurar, Resultados, Trazabilidad y Entregar. El detalle está en [PANTALLAS.md](PANTALLAS.md).

## 8. Riesgos
| Riesgo | Mitigación |
|---|---|
| Datos subidos a GitHub | `.gitignore` y `git status` antes de cada commit |
| Base completa entregada a una IA | Pruebas con datos inventados; las de la base se corren en local |
| El testigo rompe el prototipo | Casos trampa; no asumir tamaños ni valores |
| No coinciden los valores de control | Probar por etapas: cohorte, antes, transformación, supresión, utilidad |
| Reidentificación por anio_mes, tipo, diagnóstico o estancia | Declararlo: la k del reto no incluye esas columnas |
| Un diagnóstico se infiere en el grupo | Alerta y l-diversidad; no cubre toda la inferencia |
| Fallo en la demo | Ejecución local, copia en un segundo equipo y capturas |

**Riesgo residual para el PTA:** alguien que conozca la fecha de atención, el tipo o la estancia podría acotar una persona aunque k ≥ 5. Medidas: uso exclusivo, acceso restringido, no cruzar fuentes, no reidentificar, publicar solo agregados y reevaluar al menos cada año.

## 9. Cronograma

### Jueves 26
| Hora | Trabajo | Listo cuando |
|---|---|---|
| Hasta 12h00 | Acordar este plan y el contrato; estructura, `.gitignore`, primer commit; JSON de clasificación | Todos saben su parte |
| 12h00-13h00 | Mentoría | Dudas resueltas y anotadas |
| 14h00-16h00 | Carga, cohorte, medición antes y pantalla básica | CA-02 pasa |
| 16h00-16h50 | Corregir y ensayar el avance | Se muestran cohorte y k = 1 |
| 16h50-17h45 | Checkpoint | Observaciones anotadas; commit |

**Meta extra:** dejar el núcleo de la referencia avanzado hoy.

### Viernes 27
Las horas son una propuesta; ajustar al programa oficial del día 2.

| Hasta | Hito |
|---|---|
| 10h00 | CA-03, CA-04 y CA-05 pasan |
| 11h00 | Configuración propia, bloqueo y casos trampa |
| 12h00 | PTA, accesibilidad y **congelar funciones** |
| 13h00 | CSV, configuración, PTA, presentación y README listos |
| 13h30-14h00 | Subir y verificar la carpeta. Lo que no esté antes del límite no cuenta |

## 10. Equipo (4 personas)
| Rol | Responsable de | Requisitos |
|---|---|---|
| A: Datos | Carga, cohorte, código, transformaciones | RF-01, 02, 04-07 |
| B: Métricas y pruebas | Medición, homogéneos, casos trampa | RF-09, 10, 14 |
| C: Interfaz | Pantallas, parámetros, bloqueo, exportación, accesibilidad | RF-08, 11-13 |
| D: Cumplimiento y producto | Clasificación, riesgos, PTA, presentación, usabilidad | RF-03, 15 |

RF-18 es compartido: A registra las transformaciones, B comprueba los conteos y D revisa justificaciones y PTA. C muestra y exporta.

**Listo** significa: criterio probado, sin datos en el commit, revisado por otra persona y explicable.

## 11. Jurado y demo
| Criterio | Peso | Evidencia nuestra |
|---|---|---|
| Utilidad para el ciudadano | 25 | Protección del titular y resumen en lenguaje claro |
| Innovación y funcionamiento | 20 | Testigo en vivo, l-diversidad, PTA automático |
| Facilidad de uso y accesibilidad | 15 | Flujo guiado de 5 pantallas y prueba de usabilidad |
| Privacidad (DevPrivOps) | 15 | Minimización, k, riesgo residual |
| Seguridad (DevSecOps) | 10 | Proceso local, RNF-01 a 05 y pruebas |
| Gestión de riesgos (DevRiskOps) | 10 | Matriz, bloqueo y alertas |
| Viabilidad y continuidad | 5 | Reglas configurables y proceso repetible |

**Demo: 8 min (al menos 4 de demo) + 3 min de preguntas.**
| Min | Contenido |
|---|---|
| 0-1 | Problema y titular |
| 1-6 | Testigo: antes → referencia → configuración propia → casos trampa |
| 6-7 | Utilidad y riesgo residual |
| 7-8 | PTA, viabilidad y cierre |

## 12. Dudas para la mentoría
1. Tras la supresión, ¿k se recalcula hasta estabilizar?
2. ¿Cómo se cuentan las celdas de texto con identificadores? ¿Incluyen formatos con espacios o guiones?
3. En la consulta, ¿una persona con dos regiones cuenta en ambas?
4. ¿La exportación de referencia se permite si el testigo queda sin personas?
5. ¿Dónde están la plantilla de presentación y el padrón auxiliar?
6. ¿La configuración propia puede agrupar `dias_estancia` como texto (`30+`)?
7. ¿Se permite que la IA ayude con código que luego el equipo ejecute en local sobre la base completa?

## 13. Trazabilidad
| Base | Requisitos | Evidencia |
|---|---|---|
| Solicitud: cohorte | RF-02 | CA-02 |
| Minimización (LOPDP art. 10) | RF-04, RNF-02 | Encabezado |
| Categorías especiales (art. 25) | RF-03 | Tabla de clasificación |
| Investigación con datos de salud (arts. 31-32) | RF-05 a 07, 09 | CA-03 |
| Seguridad y confidencialidad (art. 10) | RNF-01, 03-05 | Pruebas de seguridad |
| Diccionario: k ≥ 5, 0 identificadores | RF-09, 13 | CA-03, CA-06 |
| Diccionario: grupo homogéneo | RF-14 | CA-05 |
| PTA (proyecto de norma SPDP) | RF-15 | PTA generado |

Verificar los artículos en el texto de la ley antes de exponer.
