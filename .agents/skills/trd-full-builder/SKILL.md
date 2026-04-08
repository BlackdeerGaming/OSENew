---
name: trd-full-builder
description: Skill to build a complete TRD structure automatically from general instructions. Orchestrates dependencies, series, subseries, and archival metadata using realistic templates and Colombian archival standards (Law 594 of 2000).
---

# TRD Full structures Builder (Orchestrator)

This skill allows the agent to generate a complete, coherent, and hierarchical TRD for a given entity type (e.g., "Alcaldía", "Empresa") with minimal user input.

## Core Capabilities

1. **Intelligent Simulation**: Use templates from `scripts/templates.py` to generate realistic structures.
2. **Meta-Orchestration**: Automatically coordinate the logic of:
   - `trd-dependency-creator` (Hierarchy, Siglas, Codes starting at 100).
   - `trd-series-creator` (Series naming, Sequential codes `DepCode-01`).
   - `trd-subseries-creator` (Subseries naming, Sequential codes `SerieCode-01`, TRD metadata).
3. **Archival Realism**: Follow Law 594 of 2000 patterns.
4. **Default Entity Assignment**: If multiple entities exist in the system, ALWAYS use the FIRST one from the `entidades` context as the default `entidadId` for all created dependencies, series, and records, unless explicitly told otherwise.

## expected_logic_steps
El agente debe seguir estos pasos internamente para garantizar el 100% de realismo:

1. **Paso 1: Estructura base**: Crear dependencias lógicas (Archivo Central, Secretaría, Talento Humano, Jurídica, Financiera) con siglas y códigos jerárquicos automáticos.
2. **Paso 2: Series**: Generar series típicas por dependencia (Historias laborales, Nómina, Procesos judiciales).
3. **Paso 3: Subseries**: Dividir series en subseries específicas (Historias laborales activas vs retirados).
4. **Paso 4: Tipos documentales**: Proponer tipos documentales realistas (Hoja de vida, Contratos, Demandas).
5. **Paso 5: Tiempos de retención**: Asignar tiempos basados en prácticas archivísticas (Gestión: 1-5 años, Central: 5-80 años).
6. **Paso 7: Comportamiento**: Generar la versión completa automáticamente sin pedir dato por dato al usuario.
7. **Paso 8: Interacción**: Tras generar, decir: *"Ya te generé una TRD base. ¿Quieres que la ajustemos a un sector específico o a tu entidad real?"*
8. **Paso 9: Realismo (Ley 594 de 2000)**: Asegurar consistencia legal y nombres creíbles.

## Workflow Execution

1. **Phase 1: Structure Proposal (Draft)**
   - Identify Sector (Alcaldía, Empresa, etc.).
   - Calculate codes using the hierarchical logic (100 -> 200 -> 200-01 -> 200-01-01).
   - Assign **Final Disposition** (Paso 6): CT (Conservación Total), S (Selección), E (Eliminación), D (Digitalización).
   - Define **Acto Administrativo**: Simulation of a legal act for adoption.
2. **Phase 2: Confirmation & Feedback**
   - Present a unified table/JSON.
   - Say the exact phrase from Paso 8.
   - WAIT for approval ("Aprobar todo").
3. **Phase 3: Deep Execution**
   - Save to database in order: Dependencies -> Series -> Subseries -> TRD Valuation.

## Rules for Realism (Colombia)
- **Despacho / Secretaría General**: Always has Actas, Resoluciones, Acuerdos.
- **Talento Humano**: Always has Historias Laborales (long retention).
- **Archivo Central**: Always exists as the main repository (Code 100).
- **Codes**: Strict hierarchy `100` -> `200` -> `200-01` -> `200-01-01`.

## Default "Acto Administrativo" Template
If simulating, use: *"Resolución Interna No. 001 del 15 de Enero de 2024, por la cual se aprueban las Tablas de Retención Documental para la vigencia actual."*
