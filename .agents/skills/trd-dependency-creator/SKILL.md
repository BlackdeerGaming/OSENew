---
name: trd-dependency-creator
description: Specialized skill for creating and managing dependencies within the TRD (Tablas de Retención Documental) system. Use this skill whenever the user asks to create, define, or add a new "dependencia" or administrative unit. It enforces business rules for automatic sigla (abbreviation) generation and unique code assignment.
---

# TRD Dependency Creator

This skill helps the agent create dependencies with the correct structure and following specific business rules for naming and identification.

## Business Rules

### 1. Automatic Sigla Generation
When a dependency name is provided, the sigla MUST be generated automatically following these rules:
- **Multiple Words (2+)**: Use the first letter of each "significant" word. 
  - *Significant* means excluding common connectors: "de", "del", "la", "el", "y", "los", "las", "por", "a", "con", "en".
  - Examples: 
    - "Archivo Central" -> **AC**
    - "Grupo de Gestión Documental" -> **GGD**
    - "Talento Humano" -> **TH**
- **Single Word**: Use the first two letters of the word.
  - Examples: 
    - "Tesorería" -> **TE**
    - "Jurídica" -> **JU**
- **Format**: Always in UPPERCASE.

You can use the bundled script `scripts/generate_sigla.py` to calculate this or verify your own logic.

### 2. Hierarchical Code (Código) Generation
The code is built based on the dependency's position in the organizational chart:

- **Root Dependency**: The main dependency always starts at **100**.
- **First Level Children (Daughters of 100)**:
  - The first daughter receives **200**.
  - Subsequent sisters at this level increment by **10** (**210, 220, 230...**).
- **Second Level Children (Daughters of a Level 1 dependency)**:
  - If parent is `200`, the first daughter receives **201**.
  - Subsequent sisters at this level increment by **1** (**202, 203...**).
- **Subsequent Levels**: 
  - To maintain consistency in a 3-digit system, we follow the pattern of the last available digit or expand into sub-blocks (e.g., `201.1` or `2011`) if needed. *Note: Current implementation assumes 3 digits based on examples.*

The code is assigned based on the **creation order** of children under the same parent.

You can use `scripts/generate_codigo.py` to calculate the next available code for a parent.

## Natural Language Hierarchy Recognition
The agent must correctly interpret hierarchical relationships from various natural expressions:
- **Direct dependency**: "X depende de Y", "X es hija de Y", "X cuelga de Y"
- **Membership**: "X pertenece a Y", "X forma parte de Y"
- **Subordination**: "X está subordinada a Y"

In all these cases, **Y** is the parent dependency and **X** is the daughter dependency.

## Expected Behavior
When a user asks to create one or more dependencies, the agent MUST follow these steps automatically:

1. **Information Extraction**: Read the dependency name(s) from the input.
2. **Automatic Sigla Generation**: Calculate the sigla for each dependency based on the naming rules (skipping connectors, 2 letters for single words, first letter of significant words for multiple).
3. **Parent Detection**: 
   - Detect the parent dependency if indicated in the prompt (e.g., using the hierarchy expressions above).
   - If NO parent is indicated:
     - Assign the **Principal Dependency** (Code 100) as the parent if it exists.
     - If NO dependencies exist yet, the new dependency becomes the **Principal Dependency** (Code 100).
4. **Automatic Code Calculation**: 
   - Calculate the code according to the hierarchy and the **creation order** of children under that parent.
   - Use the logic: 
     - Parent 100 -> Children: 200, 210, 220...
     - Other Parents -> Children: ParentCode+1, ParentCode+2...
5. **Relationship Persistence**: Ensure the `dependeDe` field (pointing to the parent's ID or code) is correctly populated to allow for future use in organigrams and TRD.

## Workflow for the Agent

1. **Gather Data**: If the user only provides names, perform the calculations and detections above.
2. **Verification**: Present a structured summary (table or JSON) of the calculated data (Name, Sigla, Parent, Code) to the user for confirmation.
3. **Completion**: Once confirmed, proceed to "save" or provide the final configuration.
4. **Consistency**: Always ensure that codes within the same block follow the increment rule (+10 for Level 1, +1 for Level 2+).

