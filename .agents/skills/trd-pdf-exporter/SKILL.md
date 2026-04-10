---
name: trd-pdf-exporter
description: Skill especializado para la generación de Reportes Oficiales TRD en formato PDF de alta fidelidad (DANE). Implementa el patrón de 'Portal de Impresión' para asegurar exportaciones vectoriales impecables sin artefactos de UI.
---

# TRD PDF Exporter (Estándar DANE Píxel-Perfect)

Este skill proporciona las reglas de oro y la arquitectura técnica necesaria para generar PDFs de Tablas de Retención Documental (TRD) que cumplan exactamente con el formato visual del DANE en Colombia.

## Principios de Diseño de Alta Fidelidad

1. **Bordes Negros Puros**: Las líneas divisorias deben ser de color Negro Puro (#000000) y tener un grosor de `1.5px` en los contornos principales y cabeceras para asegurar nitidez absoluta en la exportación PDF.
2. **Jerarquía Archivística Visual**:
    - **Series y Subseries**: Deben presentarse en **NEGRITA Y MAYÚSCULAS** para facilitar la lectura rápida del fondo documental.
    - **Tipos Documentales**: Deben ir en cursiva o fuente más pequeña, manteniendo la indentación.
3. **Métrica del Procedimiento**: Al ser la columna con más carga de información, debe ocupar al menos el **37-40%** del ancho de la hoja para evitar desbordamientos verticales excesivos.
4. **Continuidad Lineal**: La tabla debe estructurarse de modo que las líneas verticales de las subcolumnas (Código, Soporte, Retención, Disposición) sean perfectamente continuas, eliminando cualquier espacio en blanco entre celdas.
5. **Simetría Institucional**: Las firmas deben estar centradas bajo sus respectivas líneas y el pie de página debe incluir la leyenda de generación electrónica tras una línea de cierre.

## Proporciones del Formato TRD (DANE-Ready)

- **Código (D/S/SUB)**: 10%
- **Serie/Subserie/Tipos**: 25%
- **Soporte (SF/SE)**: 8%
- **Retención (AG/AC)**: 8%
- **Disposición Final (CT/M/S/E)**: 12%
- **Procedimiento**: 37%

## Implementación Técnica: El Portal de Previsualización

Para asegurar que el usuario esté satisfecho antes de la descarga, se implementa una **Mesa de Revisión**:
- Un estado `isPrinting` que muestra una página limpia con el reporte.
- Una barra de herramientas superior (`print:hidden`) con botones de "Volver" y "Descargar".
- El disparo de `window.print()` es manual por parte del usuario.

## Cuándo usar este Skill
- Cuando el usuario solicite que el reporte se parezca más al "formato oficial".
- Cuando se detecten líneas grises o borrosas en el PDF.
- Cuando la legibilidad del campo "Procedimiento" sea baja.
