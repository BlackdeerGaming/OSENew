---
name: trd-series-creator
description: Specialized skill for creating "Series Documentales" within the TRD system. It enforces mandatory validation of the series name and the producing dependency, ensuring consistent archival hierarchy.
---

# TRD Series Documentales Creator

This skill helps the agent create documentary series with the correct association and validation rules.

## Mandatory Data Validation

Before creating any series, the agent MUST ensure that the following data is provided:

1. **Nombre de la serie** (Full name, e.g., "Actas de Comité").
2. **Dependencia Productora** (The administrative unit that creates the series).

### Missing Information Logic
If any of these fields are missing, the agent MUST pause and request them explicitly:
- *"Para crear la serie necesito que me indiques la dependencia productora."*
- *"Para crear la serie necesito que me indiques el nombre de la serie."*

The agent MUST NOT proceed with the creation until both fields are available.

## Dependency Association

Each series MUST be associated with an existing dependency.

1. **Verify Existence**: Check if the mentioned dependency exists in the system or the current context.
2. **Missing Dependency**: If the dependency DOES NOT exist:
   - Inform the user: *"No encuentro la dependencia [Nombre]. ¿Deseas crearla primero?"*
   - **DO NOT** trigger the dependency creation automatically. Just suggest it and wait for user confirmation or manual input.

## Generación automática del código de la serie

El código de la serie debe construirse automáticamente siguiendo esta estructura:
**[Código de la dependencia]-[Número consecutivo de la serie]**

### Reglas obligatorias:
1. **Código de la dependencia**: Se toma directamente de la dependencia productora asociada.
2. **Número consecutivo**:
   - Debe ser consecutivo dentro de esa dependencia específica.
   - **Debe iniciar en 01**.
   - **Debe tener formato de dos dígitos** (01, 02, 03, etc.).
3. **Independencia por dependencia**:
   - La numeración de series es independiente por cada dependencia.
   - Cada dependencia inicia su propia numeración desde **01**.
   - No se mezclan numeraciones entre dependencias distintas.

Utiliza el script `scripts/generate_serie_codigo.py` para calcular el siguiente código disponible respetando estas reglas.

### Ejemplos de funcionamiento:
- **Dependencia: Archivo Central (Código 100)**:
  - Primera serie → **100-01**
  - Segunda serie → **100-02**
- **Dependencia: Gestión Administrativa (Código 200)**:
  - Primera serie → **200-01**

## expected_behavior_sequence
Cuando el usuario solicite crear una serie, el agente DEBE seguir este orden:

1. **Nombre de la serie**: Solicitarlo explícitamente si no fue indicado.
2. **Dependencia productora**: Solicitarla explícitamente si no fue indicada.
3. **Verificación**: Verificar que la dependencia exista en el sistema. Si no existe, sugerir crearla primero.
4. **Cálculo de Código**:
   - Calcular el siguiente número consecutivo (01, 02...) dentro de esa dependencia específica.
   - Generar el código automáticamente con la estructura `[CódigoDep]-[Consecutivo]`.
5. **Creación**: Presentar los datos de la serie para confirmación y registro.
6. **Tipos Documentales**: Solicitar los tipos documentales asociados inmediatamente después de la creación/confirmación:
   - *"Ahora indícame los tipos documentales que conforman esta serie."*

---

## Workflow for the Agent

1. **Extraction & Validation**: Read name and dependency. If missing, ask: *"Para crear la serie necesito que me indiques [Dato Faltante]."*
2. **Dependency Check**: 
   - If not found: *"No encuentro la dependencia [Nombre]. ¿Deseas crearla primero?"*
3. **Calculations**: Use `scripts/generate_serie_codigo.py`.
4. **Summary**: Show Table/JSON with Name, Dependency, and Generated Code.
5. **Types Collection**: Ask for `tipoDocumental`.
6. **Completion**: Finalize the series structure.
