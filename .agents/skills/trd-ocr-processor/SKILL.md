---
name: trd-ocr-processor
description: Process and structure archival data from OCR/text extractions of TRD (Tablas de Retención Documental) documents. Use this skill when the user provides text or files containing TRD tables, document lists, or organizational structures that need to be imported into the system's database. It handles hierarchical mapping between Dependencies, Series, Subseries, and Valuations.
---

# TRD OCR Processor

This skill enables the agent to interpret raw, sometimes messy, text from archival documents and convert it into a structured set of operations for the OSE IA database.

## Processing Workflow

### 1. Analysis of Raw Text
When provided with OCR text, you must scan for key architectural markers:
- **Dependency Markers**: Headers like "OFICINA", "DEPTO", "UNIDAD", "SUBDIRECCIÓN", often accompanied by a 3-digit code.
- **Series Markers**: Entries usually following a dependency, with codes like "100-1" or "100.20".
- **Subseries Markers**: Hierarchical children of series, often with codes like "100-1-01" or "100.20.1".
- **Valuation Data**: Look for columns or fields related to:
  - **Retención (Gestion/Central)**: Numbers (years).
  - **Disposición**: CT (Conservación Total), E (Eliminación), S (Selección), D (Digitalización).
  - **Soporte**: Papel, Electrónico.
  - **Valores**: Administrativo, Legal, Técnico, Histórico.

### 2. Cleaning and Normalization
- **Clean noise**: Fix common OCR errors (e.g., "0" instead of "O", "1" instead of "I", missing dashes).
- **Normalize Codes**: Ensure codes follow a consistent pattern (e.g., `DEP-SER-SUBS`).
- **Handle Multi-line entries**: Merge text that was split across pages or columns during extraction.

### 3. Structural Mapping (JSON Actions)
Generate a list of `CREATE` or `UPDATE` actions following the system's internal schema.

#### Schema Rules:
- **Dependencias**:
  - `nombre`, `sigla`, `codigo`.
- **Series**:
  - `dependenciaId` (Reference the parent dependency).
  - `nombre`, `codigo`, `tipoDocumental`.
- **Subseries**:
  - `serieId` (Reference parent), `dependenciaId`.
  - `nombre`, `codigo`, `tipoDocumental`.
- **TRD Records (Valoración)**:
  - Link to `dependenciaId`, `serieId`, and `subserieId` (if exists).
  - `retencionGestion`, `retencionCentral`.
  - `disposicion`: CT, E, S, D.
  - `actoAdmo`, `procedimiento`.

## Guidelines for Fault Tolerance

- **Ambiguity**: If a serie doesn't clearly belong to a dependency, mark it as `isDoubtful: true` in metadata and try to infer from context.
- **Duplicates**: Check the provided context for existing IDs to avoid re-creating records.
- **Validation**: Ensure that every Series has an associated Dependency. If missing, flag for user review.

## Example Output Format

```json
{
  "message": "He analizado el documento y detectado la siguiente estructura TRD...",
  "actions": [
    {
      "type": "CREATE",
      "entity": "dependencias",
      "id": "temp_dep_1",
      "payload": { "nombre": "SECRETARÍA GENERAL", "codigo": "100", "sigla": "SG" }
    },
    {
      "type": "CREATE",
      "entity": "series",
      "id": "temp_ser_1",
      "payload": { "dependenciaId": "temp_dep_1", "nombre": "ACTAS", "codigo": "100-01", "tipoDocumental": "Actas de comité, Actas de junta" }
    },
    {
      "type": "CREATE",
      "entity": "trd_records",
      "payload": {
        "dependenciaId": "temp_dep_1",
        "serieId": "temp_ser_1",
        "retencionGestion": 2,
        "retencionCentral": 8,
        "disposicion": "CT",
        "procedimiento": "Se conserva el acta original en el archivo central..."
      }
    }
  ],
  "reviewNeeded": [
    { "reason": "Código impreciso", "entity": "Serie ACTAS", "originalText": "AC-TAS 1OO-O1" }
  ]
}
```
