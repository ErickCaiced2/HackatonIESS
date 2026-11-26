# Pantallas y trazabilidad

Complementa [PLAN.md](PLAN.md) (secciones 3.1 a 3.8). Todo lo de este documento es **[Propuesta]**. Las cifras de los bocetos son los valores oficiales esperados, aún no reproducidos.

## 1. Estructura común
```
┌──────────────────────────────────────────────────────────────┐
│ Prototipo R2 · Ejecución: — · Configuración: — · SIN DATOS   │
│ 1 Cargar › 2 Configurar › 3 Resultados › 4 Trazabilidad › 5 Entregar │
├──────────────────────────────────────────────────────────────┤
│ contenido                                                    │
│                                        [Atrás]   [Siguiente] │
└──────────────────────────────────────────────────────────────┘
```
- Un paso se habilita solo cuando se cumple el anterior; si está bloqueado, dice por qué.
- Nunca se muestran filas originales ni valores de identificadores o texto libre.
- El estado se indica con texto e icono, no solo con color. Todo funciona con teclado.

## 2. Pantalla 1: Cargar y extraer
```
[Elegir CSV]  Archivo: ______
✓ Estructura válida · 28 columnas      Filas: __   Personas: __
Aviso: «id_hc» se trata como historia_clinica

[Extraer cohorte]
Filas de entrada __
  − diagnóstico fuera del capítulo F        __
  − menor de 18 en la fecha de atención     __
  − fuera de 2023-2025                      __
Cohorte: 910 personas · 1016 atenciones
```
- Los motivos se aplican en ese orden; cada fila excluida cuenta una sola vez y la suma cuadra.
- **Errores:** columna faltante, codificación, fecha o edad inválida, cédula vacía, cohorte vacía. Se informa columna, motivo y cantidad, sin mostrar el valor.

## 3. Pantalla 2: Clasificar y configurar
```
Configuración: (•) Referencia   ( ) Propia

Columna      Clasificación        Art. 25  ¿Pedida?     Técnica           Parámetro
cedula       Identificador dir.   —        Solo unir    Código aleatorio  sin tabla
edad         Cuasiidentificador   b) <18   Sí           Generalizar       4 rangos
provincia    Cuasiidentificador   —        Sí           Jerarquía         región
observacion  Texto libre          c)       No           Suprimir          —
(28 filas · filtros: todas / salen / se eliminan)

Parámetros: k [5]  edad [rangos]  ubicación [región]  fecha [mes]
            l [—]  tope de estancia [—]
                                            [Medir antes y anonimizar]
```
- **Referencia:** todo en solo lectura.
- **Propia:** parte de la referencia con l = 2 y tope 30. Cada cambio muestra «difiere de la referencia».
- No se permite k < 5, ni hacer salir un identificador directo o el texto libre.
- Cambiar algo marca resultados, informe y PTA como **desactualizados** y desactiva las descargas.

## 4. Pantalla 3: Resultados (la que lee el jurado)
```
✓ APTO · k ≥ 5 y 0 identificadores · Configuración de REFERENCIA

Indicador                           Antes                       Después
Personas                            910                         903
Atenciones                          1016                        1009
k mínimo (meta ≥ 5)                 1  No cumple                6  Cumple
Personas únicas (meta 0 %)          100,0 %                     0,0 %
Identificadores (meta 0)            6 columnas + 18 en texto    0 + 0
Personas conservadas                100 %                       99,2 %
Cambio consulta: máx. / prom.       —                           100,0 % / 32,1 %

Consulta del estudio (región × sexo): antes · después · diferencia
⚠ Grupos homogéneos: 1  [ver detalle]
Controles: excluidos por menor de 18 __ · grupo 80+ __ personas ·
           suprimidos por k __ · suprimidos por diversidad __ · celdas de texto con identificador __
Comparación: Referencia vs. Propia (personas, k, utilidad, homogéneos)
```
- La tabla principal cabe sin desplazamiento en la pantalla de la demo.
- «Controles» ayuda a explicar los casos trampa sin mostrar a ninguna persona.
- El detalle de grupos pequeños y homogéneos es solo para el operador; no va al investigador.
- **APTO** significa que cumple los controles medidos, no que el riesgo sea cero. La pantalla lo dice.
- En referencia, un grupo homogéneo alerta pero no bloquea. En propia con l ≥ 2, no debe quedar ninguno.
- **NO APTO:** dice qué meta falló y enlaza al parámetro o a la transformación.
- «Comparación» aparece cuando ambas se ejecutaron sobre el mismo archivo.

## 5. Pantalla 4: Trazabilidad
Responde: **¿qué entró, qué se le hizo, en qué orden, qué salió y qué efecto tuvo?**

### Pestaña A: Recorrido (filas y personas)
| # | Operación | Regla | Personas antes → después | Atenciones antes → después |
|---|---|---|---|---|
| 1 | Cohorte | F, ≥ 18, 2023-2025 | total → 910 | total → 1016 |
| 2 | Transformar columnas | Ver pestaña B | 910 → 910 | 1016 → 1016 |
| 3 | Supresión por k | k < 5 | 910 → 903 | 1016 → 1009 |
| 4 | Diversidad (solo propia) | l < 2 | según ejecución | según ejecución |

Cada paso de supresión muestra además k y grupos homogéneos antes y después. Si repite, hay una fila por vuelta.

### Pestaña B: Por columna
```
Filtrar: [técnica ▼] [clasificación ▼] [estado ▼]   Buscar: ____
Entrada     → Técnica      → Salida     Cambiados  Distintos a→d  Estado
provincia   → Jerarquía    → region        __         __ → __     ✓ Aplicada
observacion → Supresión    → no sale       __         __ → 0      ✓ Aplicada
```
Al abrir una fila: clasificación, categoría especial, si se pidió, parámetro, justificación y orden. No hay ejemplos de valores reales.

### Pestaña C: Verificaciones
| ID | Comprobación | Bloquea |
|---|---|---|
| V-01 | Las 28 columnas tienen registro | Sí |
| V-02 | Las columnas de salida del informe son las del CSV | Sí |
| V-03 | Ninguna transformación falló | Sí |
| V-04 | Personas y atenciones cuadran entre pasos consecutivos y con el CSV | Sí |
| V-05 | k mínimo ≥ 5 en la salida | Sí |
| V-06 | Identificadores directos y en texto = 0 | Sí |
| V-07 | La salida no está vacía | Sí |
| V-08 | Si l ≥ 2, no quedan grupos homogéneos | Sí |

Las verificaciones miden el **resultado**; no basta con que el registro diga «aplicada».

### Cadena de cada cifra
`indicador → operación o columna → regla y parámetro → id_ejecucion → archivo`

Ejemplo: «903 personas» → paso 3, supresión por k → k ≥ 5 → ejecución actual → informe y PTA.

### Estados y ciclo del informe
| Situación | Informe |
|---|---|
| Ejecución APTA | Vigente y descargable |
| NO APTA o fallida | Se ve en pantalla como diagnóstico; no forma parte de una entrega |
| Cambió la configuración | Desactualizado; no se descarga |
| Nueva ejecución | Nuevo id_ejecucion; no se mezcla con la anterior |
| Se cierra o carga otro archivo | Se borra de memoria lo no descargado |

## 6. Pantalla 5: PTA y entrega
```
Equipo [NN]
PTA   1 Datos ✓ · 2 Minimización ✓ · 3 Técnicas ✓ · 4 Riesgo ✓
      5 Riesgo residual ☐ revisado · 6 Resumen titular ☐ revisado
      [Vista previa]
Paquete (ejecución __)
  R2_EquipoNN_salida.csv · configuración · trazabilidad · PTA
  [Descargar paquete]
Condiciones de uso: solo este estudio · sin reidentificar ni cruzar · publicar agregados
```
- La descarga exige: APTO, V-01 a V-08 correctas, número de equipo y secciones 5 y 6 revisadas.
- Los textos de las secciones 5 y 6 son de solo lectura. Las cifras no se editan.
- El supuesto sobre el atacante y el canal de derechos sí se escriben; cambiarlos desmarca la revisión de su sección.
- Para el entregable se usa la configuración **propia**; la referencia sirve para la verificación del jurado. La pantalla muestra cuál se está exportando.
- La trazabilidad es para el equipo, el IESS y el jurado. **[Confirmar]** si también se entrega al investigador; sus conteos podrían revelar detalles.

## 7. Demo del dataset testigo
Cargar → extraer → referencia → resultados → propia → resultados → trazabilidad → PTA.
En la demo, «revisado» del PTA no debe frenar la lectura de resultados: solo condiciona la descarga.

## 8. Criterios de aceptación de las pantallas
- **CA-P1:** las exclusiones de cohorte suman exactamente filas de entrada menos cohorte.
- **CA-P2:** al cambiar un parámetro, las descargas se desactivan de inmediato.
- **CA-P3:** un fallo simulado en cualquier verificación V-01 a V-08 impide descargar y dice cuál falló.
- **CA-P4:** desde cada indicador de «Después» se llega a la operación que lo explica.
- **CA-P5:** el flujo completo se hace solo con teclado.

## 9. Prioridad de construcción
1. Cargar y cohorte.
2. Resultados.
3. Configurar (referencia primero).
4. Trazabilidad: pestañas A y C, luego B.
5. PTA y entrega.
6. Filtros, enlaces desde indicadores y comparación.

El registro de trazabilidad se construye **dentro del motor desde el principio**, aunque su pantalla venga después.
