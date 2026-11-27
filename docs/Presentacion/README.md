# SEAD-IESS · Hackatón IESS 2026

Abre **index.html** en Chrome, Edge o Firefox de escritorio. El archivo incluye el logotipo original, la tipografía Archivo, los diagramas SVG, GSAP 3.13.0 y el código de la presentación. Puedes copiar solo el HTML a otro equipo y proyectarlo sin instalar software ni conectarte a internet.

## Exposición

Ocho diapositivas en formato 16:9. El recorrido dura 13 minutos y deja dos minutos para preguntas. El índice y las notas muestran el tiempo de cada diapositiva.

| Acción | Control |
| --- | --- |
| Avanzar o retroceder | Flechas, Av Pág / Re Pág o botones inferiores |
| Ir a una diapositiva | Teclas 1 a 8 o segmentos de progreso |
| Ir al inicio o al cierre | Inicio / Fin |
| Abrir el índice | I |
| Consultar las notas | N |
| Entrar o salir de pantalla completa | F |
| Cerrar un panel | Esc |
| Recorrer y activar controles | Tab, Mayús + Tab, Intro o Espacio |

Las notas se abren en la misma pantalla del navegador. Si se proyecta esa ventana, el público también verá el panel.

## Demostración del flujo

En la diapositiva 4, la **Vista general** recorre minimización, supresión, código aleatorio, generalización, verificación y salida. **Decisiones** muestra el retorno para ajustar los datos y la ruta de bloqueo. Puedes cambiar de vista sin reiniciar. **Ejecutar**, **Pausar**, **Avanzar** y **Reiniciar** controlan la secuencia. Seleccionar un paso abre un detalle breve.

- **Proceso satisfactorio.** La secuencia termina con la salida y las métricas listas para revisión.
- **Riesgo detectado.** La verificación encuentra un grupo sintético con k = 3. **Ajustar datos** repite el tratamiento y la medición. **Bloquear salida** detiene el proceso.

La demo usa datos sintéticos y representa únicamente el proceso de anonimización. La revisión y entrega institucionales quedan fuera de esta secuencia.

En la diapositiva 6, una secuencia finita recorre los cinco beneficiarios desde SEAD-IESS. **Pausar recorrido** detiene la señal y el cambio de texto. **Siguiente actor** anima una sola conexión. Seleccionar un actor muestra su beneficio inmediatamente. **Repetir recorrido** inicia la secuencia de nuevo. Con movimiento reducido, los beneficios siguen siendo accesibles y la secuencia espera una acción del expositor.

## Fuentes

La marca sigue el logotipo original **SEAD-IESS**. Las métricas de la base de práctica, las 44 pruebas reportadas, el presupuesto y la hoja de ruta proceden del [resumen ejecutivo](https://canva.link/49pw0jn507s3kd5). La comparación de registros y los incidentes de la simulación son ilustrativos.

La secuencia de anonimización recoge el diagrama de riesgo y la documentación técnica del prototipo local. El piloto y las siguientes etapas se presentan como proyectados. Los riesgos legales y comerciales mencionados son posibilidades que esta propuesta busca reducir.

## Validación reproducible

La carpeta **validacion/capturas** contiene la presentación en 1920 × 1080, 1366 × 768 y 1280 × 720. El script **validacion/verificar.cjs** abre el HTML local con Playwright y Chromium. Comprueba navegación, pantalla completa, notas, interacciones, bifurcaciones, pausa y ausencia de solicitudes de red. También recorre toda la presentación con movimiento reducido.

En un entorno con Node.js, el paquete `playwright` y Chromium para Playwright instalados, ejecuta desde esta carpeta:

```sh
node validacion/verificar.cjs
```

Puedes indicar otro ejecutable compatible mediante `PLAYWRIGHT_CHROMIUM_EXECUTABLE` y otro directorio de capturas mediante `DECK_CAPTURAS`. La presentación se ejecuta independientemente de estas herramientas de validación.
