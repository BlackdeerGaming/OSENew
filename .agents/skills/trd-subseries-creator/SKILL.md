---
name: trd-subseries-creator
description: Specialized skill for creating "Subseries Documentales" within the TRD system. It enforces hierarchical coding and mandatory collection of archival retention, disposition, and valuation data.
---

# TRD Subseries Documentales Creator

This skill helps the agent create documentary subseries with the correct association, naming, and TRD metadata.

## Mandatory Data Validation

Before creating any subseries, the agent MUST ensure that the following data is provided:

1. **Nombre de la subserie** (Full name, e.g., "Licitaciones Públicas").
2. **Serie a la que pertenece** (The parent documentary series).
3. **Entidad** (The parent organization). If missing, always use the FIRST entity from the `entidades` context as the default.

### Missing Information Logic
If any of these fields are missing, the agent MUST pause and request them explicitly:
- *"Para crear la subserie necesito que me indiques a qué serie pertenece."*
- *"Para crear la subserie necesito que me indiques el nombre de la subserie."*

## Automatic Code Generation

The code for a subseries follows the pattern: `[SerieCode]-[Sequence]` (e.g., `100-01-01`).

### Rule Set:
1. **Base**: The code starts with the full code of the parent series.
2. **Numbering**:
   - MUST start at **01**.
   - MUST increment by one (01, 02, 03...).
   - **Independencia por serie**: Each series manages its own subseries sequence. Numbering does not mix between different series.

Use the script `scripts/generate_subserie_codigo.py` to calculate the next available code.

## Mandatory TRD Data Collection (Post-Creation)

Immediately after the subseries is created/confirmed, the agent MUST ask for the following metadata required for the TRD:

*"Ahora indícame los tipos documentales, los años en archivo de gestión, los años en archivo central, la disposición final, el procedimiento y si es una serie de DDHH/DIH."*

### Field Mapping:
- **Tipos documentales**: List of documents.
- **Años en archivo de gestión**: Numeric value.
- **Años en archivo central**: Numeric value.
- **Disposición final**: CT (Conservación Total), S (Selección), E (Eliminación), D (Digitalización).
  - *Guidance*: If the user is unsure, suggest these options.
- **Procedimiento**: Detailed archival procedure.
- **Serie de DDHH/DIH**: Yes/No.

## How to Act (Workflow)

1. **Extraction & Validation**: Read name and parent serie. If missing, ask.
2. **Code Calculation**: Generate the code automatically using the parent serie's code as prefix.
3. **Creation Summary**: Present a table/JSON with:
   - Nombre de la Subserie
   - Serie Asociada (Nombre y Código)
   - Código de la Subserie Generado
4. **Archival Info Request**: Ask for the TRD parameters (Retention, Disposition, Procedure, DDHH).
5. **Completion**: Finalize the subseries record with all TRD data.
