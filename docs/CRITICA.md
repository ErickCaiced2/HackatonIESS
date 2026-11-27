# Auditoría Crítica de la Solución vs. Documentos Oficiales del Hackatón IESS 2026

> **Enfoque:** Crítica técnica, funcional, de seguridad y de competencia sin adornos, contrastando el código actual (motor `src/motor/*`, IA `src/ia/*` y frontend en `framework`) contra los **8 documentos oficiales** en `documentos/` y las **10 láminas de diseño conceptual de TASS**.

---

## 1. Lo que SÍ está sólido (para no tocar ni romper)

Antes de señalar los defectos, hay que reconocer qué parte del código actual ya responde con precisión al reto:

1. **Motor matemático de anonimización (`src/motor/motor.js`):** Implementa exactamente las reglas de la hoja *Configuración de referencia* y *Medición* de `05_Diccionario_de_datos.xlsx`: cohorte (`F*`, `edad >= 18`, `2023-2025`), código aleatorio sin correspondencia (`id_paciente_estudio`), edad tomada de la primera atención, 24 provincias a 4 regiones, `anio_mes`, supresión iterativa para $k \ge 5$, detección de identificadores en texto libre (cédula, teléfono, correo, `HC-`), cálculo de consulta del estudio (región × sexo) y alerta de grupos homogéneos.
2. **IA explicable y auditable (`src/ia/estandarizar.js`):** Cumple bien la regla 7.4 de las *Bases* y la recomendación 5 de la *Guía* (*«documenta limitaciones y dónde interviene el criterio humano»*). Usa regresión logística softmax explicable, nunca envía datos a APIs externas, bloquea encabezados con datos reales y obliga confirmación humana en columnas dudosas o formatos ambiguos.
3. **44 pruebas automatizadas pasando (`tests/`):** Dan respaldo directo al criterio **Evidencia (5 pts)** y **Seguridad / datos (20 pts)** de la rúbrica oficial del Demo Day.

---

## 2. Críticas Severas (Puntos que pueden costar puntos o descalificación)

### Crítica 1: El PTA se genera con textos «borrador» fijos (Incumple `07_Plantilla_PTA.pdf`)
- **Qué piden los documentos:** `07_Plantilla_PTA.pdf` exige llenar 6 secciones reales: *(1) Datos generales (nombre del equipo, herramienta, configuración)*, *(2) Minimización*, *(3) Clasificación y técnicas*, *(4) Riesgo antes/después + grupos homogéneos + supuestos sobre quién podría reidentificar*, *(5) Riesgo residual, medidas mitigadoras y frecuencia de reevaluación anual (Proyecto de norma SPDP 2026)*, y *(6) Resumen en lenguaje claro para el titular*.
- **Qué hace hoy el código:** En `paso-publicar.tsx` (heredado directo de `Prototipo`), el PTA se genera pasando `BORRADOR_RIESGO` y `BORRADOR_TITULAR` preescritos y **nunca permite editar** el nombre del equipo, los supuestos de atacante ni el texto para el titular. Además, **TI ni siquiera puede previsualizar ni descargar el PTA antes de publicarlo** al doctor.
- **Impacto en jurado:** El jurado pide el PTA como entregable central. Si ven texto genérico de borrador o sin nombre del equipo/estudio editable, pierden puntos en *Funcionalidad* y *Seguridad/datos*.

### Crítica 2: El flujo de 3 roles es demasiado largo para una demo de 3 minutos
- **Qué dicen los documentos:** Según `agenda-estudiantes-docentes-enlace...pdf` (pág. 6), en el Demo Day tienen **5 min de pitch + 3 min exactos de demostración + 3 min de preguntas**. Además, `03_Conceptos_y_metricas.pdf` dice que el jurado entrega un **Dataset testigo** en vivo.
- **Qué hace hoy el código:** Para mostrar un caso completo de principio a fin, hoy debes:
  1. Entrar como `ce/ce`, subir un PDF, llenar destinatario y filtro, enviar.
  2. Cerrar sesión y entrar como `ti/ti`.
  3. Abrir la petición, tomarla, subir el CSV testigo, confirmar IA, extraer cohorte.
  4. Ejecutar **Referencia** (para comparar contra la tarjeta del jurado) y luego ejecutar **Propia**.
  5. Publicar, cerrar sesión.
  6. Entrar como Doctor (`1720-2015-123456`), teclear `doc` en el teclado virtual, firmar acuerdo y recién ahí descargar el CSV/ZIP.
- **Crítica dura:** Hacer todo eso en **180 segundos** frente al jurado bajo presión es una trampa mortal. Si el teclado virtual o el PDF los retrasa 40 segundos, **no alcanzan a mostrar las métricas del dataset testigo ni la descarga**.
- **Qué falta:** Un **modo demo o precarga de petición testigo aprobada** (o que TI pueda probar el dataset testigo rápidamente y ver la tabla para el jurado al instante sin 6 cambios de sesión).

### Crítica 3: No existe el «extra» del Padrón Auxiliar (Ataque de vinculación)
- **Qué dicen los documentos:** `03_Conceptos_y_metricas.pdf` (pág. 3) define explícitamente el **Padrón auxiliar**: *«Registro sintético para el extra de probar si el dataset podría vincularse con otra fuente»*.
- **Qué hace hoy el código:** **Cero.** No hay ninguna pantalla ni función que permita cargar un segundo CSV (padrón auxiliar) para simular un ataque de reidentificación/vinculación (*linkage attack*) sobre el dataset anonimizado y medir cuántos registros se enlazan.
- **Crítica:** En una competencia de 4 equipos por reto donde todos van a cumplir $k \ge 5$, implementar la prueba real contra un padrón auxiliar es uno de los diferenciadores más fuertes en *Innovación (15 pts)* y *Seguridad/datos (20 pts)*.

### Crítica 4: El nombre del archivo de salida no cumple el estándar oficial
- **Qué dice `05_Diccionario_de_datos.xlsx` (hoja *Formato de entrega*):**
  > `Nombre: R2_EquipoNN_salida.csv · UTF-8 · separado por comas · con encabezado`
- **Qué genera hoy el código:** Genera `R2-2026-MM-DD-..._salida.csv`. Si entregan el archivo crudo al Drive institucional sin renombrarlo o sin parametrizar el código de equipo, incumplen la convención de entrega.

### Crítica 5: «Seguridad» y «No repudio» son simulados — peligro si se venden como reales
- **Qué hace hoy el código:**
  - Las credenciales (`ti/ti`, `ce/ce`, `doc`, `iess`) están en código cliente (`src/motor/usuarios.js`) visibles en el bundle JS.
  - Los «logs inmutables (no repudio)» viven en `localStorage` y los PDFs/entregables en `IndexedDB`. Cualquier persona abre DevTools y los borra o altera en 2 segundos.
  - El teclado virtual bloquea el teclado físico en el `<input readOnly>`, pero no protege contra inspección de memoria ni evita contraseñas débiles (`doc`).
- **Crítica dura:** Un jurado técnico de ciberseguridad del IESS (DNSIPD) **te va a destruir en preguntas** si afirmas que «los logs tienen no repudio real» o «el teclado virtual garantiza seguridad bancaria». Hay que decir frontalmente que en el prototipo **simula el comportamiento funcional y de UX**, y presentar en la arquitectura de continuidad cómo se despliega en producción (backend institucional, firma electrónica/PKI, almacenamiento WORM/append-only con encadenamiento criptográfico hash-chain, IAM/OIDC del IESS).

### Crítica 6: Desalineación entre el código y lo que prometen las imágenes de TASS
*(Detallado a fondo en `docs/TASS.md`, pero aquí va la crítica directa)*:
1. **Clasificación clínica de paciente (Neonatal, Pediátrico, Adulto, Geriátrico, Obstétrico):** Está dibujada en sus diagramas, **no existe en ninguna línea del código**. Hoy el código filtra rígidamente `edad >= 18`. Si muestran ese diagrama en las diapositivas y el jurado pregunta *«¿dónde está lo Neonatal u Obstétrico en tu demo?»*, quedan en contradicción.
2. **Bucle de re-segmentación geográfica automática:** El diagrama muestra que si `k < 5`, el sistema vuelve atrás y *cambia la segmentación de ubicación*. El código **no hace eso**: simplemente suprime filas de personas con `k < 5`.
3. **Exportación a PDF/Excel:** El diagrama promete *«Generación de PDF/Excel con los datos»*. El código exporta **CSV, JSON, HTML y ZIP**, no `.pdf` ni `.xlsx`.
4. **Aprobación institucional post-PTA y Reevaluación periódica:** Los diagramas (y el Proyecto de norma SPDP 2026) contemplan una aprobación final antes de la entrega y reevaluación anual del riesgo residual. El código no tiene ese estado intermedio ni alertas de vencimiento/reevaluación anual.
5. **Dependencia de red en desarrollo (`bases-concurso`, punto 9.4):** Las bases obligan a poder demostrar el prototipo **sin conexión a internet**. Next.js en modo producción (`npm run build && npm run start`) autohospeda las fuentes y funciona 100 % offline, pero **no deben confiar en `npm run dev` sin probar antes desconectados del Wi-Fi**.

### Crítica 7: Riesgo de sobredimensionar la burocracia y perder el foco del problema (25 pts)
- **Qué dice `03_Conceptos_y_metricas.pdf` (pág. 1):**
  > *«En el IESS, el acceso a datos de salud para investigación pasa por un proceso de aprobación institucional. El reto se ubica después de esa aprobación: cómo entregar los datos protegidos.»*
- **Qué pasó en `Prototipo 3.0`:** Se invirtió una gran cantidad de complejidad en el módulo del Comité de Ética, devolución de peticiones, roles, teclado virtual y tablero de incidencias. Eso aporta **gobernanza e innovación**, pero si en el pitch de 5 minutos se dedican 3 minutos a explicar logins y devoluciones y solo 1 minuto a explicar el equilibrio **riesgo ($k, l$, grupos homogéneos) vs. utilidad (consulta región × sexo)**, el jurado del Reto 2 sentirá que resolvieron un gestor de tickets y no el corazón estadístico-legal de la anonimización.

### Crítica 8: Riesgos administrativos de las Bases del Concurso (¡No descuidar!)
- **Regla 7.3 (Ficha técnica y trazabilidad Git):** Todo código preexistente, adaptado o creado el **26 y 27 de noviembre** debe clasificarse con honestidad en la ficha técnica y verse reflejado en commits con fechas reales en el repositorio.
- **Regla 7.5 (Cero datos reales / cero CSV en el repo):** Verificar siempre con `git status` que ningún CSV de práctica, testigo ni salida se suba al repositorio (`.gitignore` ya lo bloquea, mantenerlo así).
- **Regla 11.4 (Congelamiento entre Demo Day y Gran Final):** Si pasan a la final del lunes 30, **no pueden agregar nuevas funcionalidades** respecto a lo entregado el viernes 27 a las 16h15. Lo que no esté cerrado el viernes no entra el lunes.

---

## 3. Matriz Rápida de Prioridades Antes de la Entrega

| Prioridad | Brecha detectada | Acción recomendada | Impacto en rúbrica |
|---|---|---|---|
| **P0 (Crítico)** | Alinear discurso y diagramas con el código real | O quitan Neonatal/Obstétrico/PDF-Excel de las láminas de la demo actual (dejándolos como *hoja de ruta / continuidad*), o ajustan los textos del pitch para no contradecir la demo | Problema (25) + Funcionalidad (20) |
| **P0 (Crítico)** | PTA editable + vista previa antes de publicar | Permitir a TI editar nombre de equipo, supuestos de riesgo residual y resumen al titular antes de publicar, y descargar el PTA en vista previa | Seguridad/datos (20) + Evidencia (5) |
| **P0 (Crítico)** | Velocidad para Demo Day (3 min) | Tener una petición ya aprobada lista o un flujo ágil para cargar el dataset testigo en <30 s y mostrar la tabla de control al jurado | Funcionalidad (20) + Experiencia (5) |
| **P1 (Alto)** | Prueba de vinculación con Padrón Auxiliar | Agregar una pestaña o herramienta opcional para cargar el padrón auxiliar y medir tasa de reidentificación por cruce | Innovación (15) + Seguridad/datos (20) |
| **P1 (Alto)** | Exportación offline probada | Ejecutar `npm run build && npm run start` con el Wi-Fi apagado para garantizar cumplimiento del punto 9.4 de las Bases | Viabilidad (10) |
| **P2 (Medio)** | Reevaluación periódica (SPDP 2026) | Mostrar fecha de próxima reevaluación anual (+12 meses) en el tablero de TI y en el PTA | Viabilidad (10) + Sostenibilidad (10 en Final) |
