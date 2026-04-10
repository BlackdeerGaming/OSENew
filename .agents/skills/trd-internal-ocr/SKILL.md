---
name: trd-internal-ocr
description: OCR interno y parser visual mediante LLM avanzado para documentos TRD. Se activa automáticamente cuando un PDF subido no tiene capa de texto (ej. escaneos o imágenes) dentro del flujo de importación de la plataforma oficial de la OSE IA.
---

# TRD Internal OCR Skill

Este skill define el comportamiento y la lógica interna para extraer texto estructurado a partir de documentos no seleccionables y escaneados de Tablas de Retención Documental (TRD).

## Actividad de Activación Automática

El skill se orquesta **exclusivamente dentro del backend** (ej. FastAPI `analyze-trd` route). A diferencia de otros skills que Orianna usa interactivamente desde el chat, este actúa como un **proceso en background (pipeline invisible)** durante la ingesta:
1. Inspecciona el PDF.
2. Si los caracteres extraíbles (`< 50`) delerr_chars, asume documento escaneado.
3. Invoca la capacidad Visual Multimodal del LLM usando la matriz base64 de la imagen.

## Lógica del Agente Visión

El agente extraerá visualmente la siguiente estructura:
- Identidad de la Entidad Productora.
- Matrices estructuradas (`Series`, `Subseries`, `Retención`, `Disposición`).

```prompt
"Estás operando como un motor OCR Archivístico avanzado de la OSE. Aquí tienes la imagen real de la TRD escaneada. Identifica filas y columnas, repara errores ópticos y devuelve el JSON estructurado."
```

## Beneficios
- Tolerancia a PDFs dañados y fotocopias.
- Transparente para el usuario final.
- Cumple con la directiva central de la plataforma sin requerir plugins OCR externos como Tesseract.
