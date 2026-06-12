"""
TRD Import Agent — dedicated extraction using GPT-4o-mini via OpenRouter.
Produces flat trd_records actions consumed by executeAgentActions in the frontend.
"""
import os
import re
import json
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage

# ──────────────────────────────────────────────────────────────────────────────
# System prompt
# ──────────────────────────────────────────────────────────────────────────────
TRD_SYSTEM_PROMPT = """Eres un archivista experto en Tablas de Retención Documental (TRD) colombianas según la Ley 594 de 2000 y el Acuerdo 04 de 2013 del AGN.

Tu tarea es extraer TODOS los registros de valoración documental del fragmento de TRD que te envíen.

FORMATO DE SALIDA OBLIGATORIO (solo JSON, sin markdown ni texto adicional):
{
  "actions": [
    {
      "type": "CREATE",
      "entity": "trd_records",
      "payload": {
        "dependenciaNombre": "Nombre de la oficina productora",
        "dependenciaCodigo": "1",
        "serieNombre": "Nombre de la serie documental",
        "subserieNombre": "",
        "codigo": "1.29",
        "retencionGestion": 1,
        "retencionCentral": 4,
        "disposicion": "CT",
        "procedimiento": "Descripción del procedimiento archivístico",
        "tipoDocumental": "Tipo de soporte"
      }
    }
  ]
}

REGLAS CRÍTICAS:
1. "disposicion" SOLO acepta: "CT", "E", "S", "MT". Detecta la X o tilde en la columna correspondiente.
2. "retencionGestion" (AG) y "retencionCentral" (AC) son enteros en años. "Permanente"/"P" → 0.
3. "subserieNombre" = "" si la fila es una serie sin subserie.
4. Si no hay registros TRD en el fragmento → {"actions": []}
5. NO inventes datos. Solo extrae lo explícito.

DISTINCIÓN CLAVE (muy importante):
- "Entidad Productora" = nombre de la ORGANIZACIÓN (ej: "DANE", "Alcaldía de Palermo") → NO usar como dependenciaNombre.
- "Oficina productora" = la DEPENDENCIA que produce los documentos → usar su valor como dependenciaNombre.
- Si el fragmento indica "=== DEPENDENCIA ACTIVA: X ===" usa X como dependenciaNombre en todos los registros.

REGLA SOBRE DEPENDENCIAS:
Copia el nombre de la dependencia activa en el campo "dependenciaNombre" de CADA registro del fragmento, aunque el nombre solo aparezca una vez al inicio del bloque.

EJEMPLO — fragmento con dependencia y varias series:
  === DEPENDENCIA ACTIVA: Despacho del Director ===
  1.29  DISCURSOS                    1   4   CT
  1.43  INFORMES                     2   2   E
  1.72  REQUERIMIENTOS EXTERNOS      2   3   E

Salida esperada:
{"actions":[
  {"type":"CREATE","entity":"trd_records","payload":{"dependenciaNombre":"Despacho del Director","dependenciaCodigo":"1","serieNombre":"DISCURSOS","subserieNombre":"","codigo":"1.29","retencionGestion":1,"retencionCentral":4,"disposicion":"CT","procedimiento":"","tipoDocumental":""}},
  {"type":"CREATE","entity":"trd_records","payload":{"dependenciaNombre":"Despacho del Director","dependenciaCodigo":"1","serieNombre":"INFORMES","subserieNombre":"","codigo":"1.43","retencionGestion":2,"retencionCentral":2,"disposicion":"E","procedimiento":"","tipoDocumental":""}},
  {"type":"CREATE","entity":"trd_records","payload":{"dependenciaNombre":"Despacho del Director","dependenciaCodigo":"1","serieNombre":"REQUERIMIENTOS EXTERNOS","subserieNombre":"","codigo":"1.72","retencionGestion":2,"retencionCentral":3,"disposicion":"E","procedimiento":"","tipoDocumental":""}}
]}"""


# ──────────────────────────────────────────────────────────────────────────────
# Keywords used for dependency detection and chunking
# ──────────────────────────────────────────────────────────────────────────────
_OFFICE_KEYWORDS = (
    "DESPACHO", "SECRETARÍA", "SECRETARIA", "DIRECCIÓN", "DIRECCION",
    "COORDINACIÓN", "COORDINACION", "GERENCIA", "SUBGERENCIA",
    "SUBDIRECCIÓN", "SUBDIRECCION", "DIVISIÓN", "DIVISION",
    "ÁREA", "AREA", "JEFATURA", "ASESORÍA", "ASESORIA",
    "OFICINA", "UNIDAD", "DEPENDENCIA", "SECCIÓN", "SECCION",
)

_TABLE_MARKERS = {
    "PROCEDIMIENTO", "CÓDIGO", "SERIE", "SUBSERIE",
    "DISPOSICIÓN", "RETENCION", "RETENCIÓN", "SOPORTE", "FORMATO",
}


def _is_office_line(line: str) -> bool:
    """True if the line looks like an office/dependency section header (not a form field label)."""
    stripped = line.strip()
    upper = stripped.upper()
    if len(stripped) < 4 or len(stripped) > 120:
        return False
    # Exclude form field labels — they end with ':' or contain ': value' (e.g. "Oficina productora:", "Código: GID-030")
    if stripped.endswith(':') or re.search(r':\s', stripped):
        return False
    if any(upper.startswith(kw) for kw in _OFFICE_KEYWORDS):
        return True
    # "100 DESPACHO DEL ALCALDE" — numeric code then office keyword
    m = re.match(r'^[\d\.]+\s+(.+)$', stripped)
    if m and any(m.group(1).upper().startswith(kw) for kw in _OFFICE_KEYWORDS):
        return True
    return False


def _extract_header_dep(text: str) -> str:
    """
    Extracts the office/dependency name from the TRD header.
    Handles:
    - "Oficina productora: DESPACHO DEL DIRECTOR" (same line)
    - "Oficina productora:\\n[blank lines]\\nDESPACHO DEL DIRECTOR" (detached, DANE format)
    - Standalone all-caps office line next to table markers (DANE column-layout quirk)
    Returns empty string if nothing found.
    """
    lines = text.splitlines()

    # Strategy 1: "Oficina productora: VALUE" on the same line
    for line in lines:
        m = re.match(r'(?i)oficina\s+productora\s*:\s*(.+)', line.strip())
        if m:
            val = m.group(1).strip()
            if len(val) > 3:
                return val

    # Strategy 2: "Oficina productora:" then first meaningful non-empty next line
    for i, line in enumerate(lines):
        if re.search(r'(?i)oficina\s+productora', line):
            for j in range(i + 1, min(i + 8, len(lines))):
                val = lines[j].strip()
                if val and len(val) > 3:
                    # Skip lines that look like codes, page numbers, or other headers
                    if re.search(r'(?i)c.digo|hoja|\d+\s+de\s+\d+|entidad|productora', val):
                        continue
                    return val

    # Strategy 3: All-caps office line that appears near table structural markers
    # (DANE PDFs put the office name inside the table header area, which OCR may
    # place AFTER the data rows — detect it by proximity to table keywords)
    for i, line in enumerate(lines):
        stripped = line.strip()
        if not _is_office_line(stripped):
            continue
        # Check surrounding ±5 lines for table markers
        context = " ".join(lines[max(0, i - 5): i + 6]).upper()
        if any(m in context for m in _TABLE_MARKERS):
            return stripped

    return ""


class TRDImportAgent:
    def __init__(self):
        self.model = os.getenv("TRD_EXTRACTION_MODEL", "openai/gpt-4o-mini")
        self.api_key = os.getenv("OPENROUTER_API_KEY")
        self.llm = ChatOpenAI(
            model=self.model,
            openai_api_key=self.api_key,
            openai_api_base="https://openrouter.ai/api/v1",
            temperature=0.0,
        )

    async def extract_from_chunk(self, chunk_text: str, chunk_images: list = None) -> list:
        user_content = [
            {"type": "text", "text": f"Extrae los registros TRD del siguiente fragmento:\n\n{chunk_text}"}
        ]
        if chunk_images:
            for b64 in chunk_images[:2]:
                user_content.append({
                    "type": "image_url",
                    "image_url": {"url": f"data:image/png;base64,{b64}"}
                })
        try:
            response = await self.llm.ainvoke([
                SystemMessage(content=TRD_SYSTEM_PROMPT),
                HumanMessage(content=user_content),
            ])
            return self._parse_actions(response.content)
        except Exception as e:
            print(f"[TRDAgent] Error en fragmento: {type(e).__name__}: {e}")
            return []

    def _parse_actions(self, raw: str) -> list:
        text = raw.strip()
        if "```" in text:
            for part in text.split("```"):
                part = part.strip().lstrip("json").strip()
                if part.startswith("{"):
                    text = part
                    break
        start, end = text.find("{"), text.rfind("}")
        if start == -1 or end <= start:
            return []
        try:
            data = json.loads(text[start:end + 1])
            actions = data.get("actions", [])
            return [a for a in actions if isinstance(a, dict) and a.get("payload")]
        except json.JSONDecodeError as e:
            print(f"[TRDAgent] JSON inválido: {e}")
            return []

    def _deduplicate(self, actions: list) -> list:
        seen, unique = set(), []
        for action in actions:
            p = action.get("payload", {})
            key = (
                (p.get("dependenciaCodigo") or p.get("dependenciaNombre", "")).lower().strip(),
                p.get("codigo", "").lower().strip(),
                (p.get("subserieNombre") or "").lower().strip(),
            )
            if key not in seen:
                seen.add(key)
                unique.append(action)
        return unique

    def _inject_dep_context(self, chunk: str, dep_context: str) -> str:
        """Prepend dependency marker unless the chunk opens a new dependency section."""
        if not dep_context:
            return chunk
        first_line = chunk.strip().split("\n")[0] if chunk.strip() else ""
        if _is_office_line(first_line):
            return chunk  # chunk starts its own dependency
        return f"=== DEPENDENCIA ACTIVA: {dep_context} ===\n{chunk}"

    async def analyze(self, full_text: str, images: list, filename: str = "") -> tuple:
        # Pre-extract the office name from the document header so we have context
        # before even looking at the first chunk (handles DANE's detached layout).
        header_dep = _extract_header_dep(full_text)
        if header_dep:
            print(f"[TRDAgent] Dependencia detectada del encabezado: '{header_dep}'")

        chunks = self._split_into_chunks(full_text)
        if not chunks:
            return [], "No se encontró texto para analizar."

        print(f"[TRDAgent] '{filename}' — {len(chunks)} fragmento(s) con {self.model}")

        all_actions, errors = [], 0
        dep_context = header_dep  # seed with the pre-extracted office name

        for i, chunk in enumerate(chunks):
            chunk_images = images[:2] if i == 0 else []
            augmented = self._inject_dep_context(chunk, dep_context)
            actions = await self.extract_from_chunk(augmented, chunk_images)
            all_actions.extend(actions)
            print(f"[TRDAgent] Fragmento {i + 1}/{len(chunks)}: {len(actions)} registros")
            if not actions and i > 0:
                errors += 1

            # Update the carried dependency from this chunk's results
            for action in reversed(actions):
                dep = (action.get("payload") or {}).get("dependenciaNombre", "").strip()
                if dep:
                    dep_context = dep
                    break

        unique = self._deduplicate(all_actions)

        if not unique:
            msg = "El análisis finalizó pero no se encontraron registros TRD. Verifica que el documento sea una TRD válida con valoraciones documentales."
        else:
            deps = len(set(
                a["payload"].get("dependenciaNombre", "")
                for a in unique if a.get("payload")
            ))
            series_count = len(set(
                a["payload"].get("serieNombre", "")
                for a in unique if a.get("payload")
            ))
            msg = (
                f"Extraídos {len(unique)} registros TRD — "
                f"{deps} dependencia(s), {series_count} serie(s) "
                f"en {len(chunks)} fragmento(s)."
            )
            if errors:
                msg += f" ({errors} fragmento(s) sin datos)."

        return unique, msg

    @staticmethod
    def _split_into_chunks(text: str, max_chars: int = 12000) -> list:
        lines = text.splitlines()
        chunks, current, current_len = [], [], 0

        for line in lines:
            is_section = _is_office_line(line) and current_len > 3000
            if is_section:
                chunks.append("\n".join(current))
                current, current_len = [line], len(line)
            else:
                current.append(line)
                current_len += len(line)
                if current_len >= max_chars:
                    chunks.append("\n".join(current))
                    current, current_len = [], 0

        if current:
            chunks.append("\n".join(current))

        return [c for c in chunks if c.strip()]


trd_import_agent = TRDImportAgent()
