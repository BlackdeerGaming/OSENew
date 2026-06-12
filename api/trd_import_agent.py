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
# System prompt — used for every chunk extraction call
# ──────────────────────────────────────────────────────────────────────────────
TRD_SYSTEM_PROMPT = """Eres un archivista experto en Tablas de Retención Documental (TRD) colombianas según la Ley 594 de 2000 y el Acuerdo 04 de 2013 del Archivo General de la Nación.

Tu tarea es extraer TODOS los registros de valoración documental del fragmento de TRD que te envíen y estructurarlos en JSON.

FORMATO DE SALIDA OBLIGATORIO (solo JSON, sin markdown ni texto adicional):
{
  "actions": [
    {
      "type": "CREATE",
      "entity": "trd_records",
      "payload": {
        "dependenciaNombre": "Nombre completo de la oficina o dependencia",
        "dependenciaCodigo": "100",
        "serieNombre": "Nombre de la serie documental",
        "subserieNombre": "",
        "codigo": "100.01",
        "retencionGestion": 2,
        "retencionCentral": 8,
        "disposicion": "CT",
        "procedimiento": "Descripción del procedimiento archivístico",
        "tipoDocumental": "Tipo de soporte o clase documental"
      }
    }
  ]
}

REGLAS CRÍTICAS — incumplirlas invalida la respuesta:
1. "disposicion" SOLO acepta: "CT" (Conservación Total), "E" (Eliminación), "S" (Selección), "MT" (Medio Técnico). Si hay una X o tilde en la columna CT → "CT"; en E → "E"; en S → "S"; en MT → "MT".
2. "retencionGestion" y "retencionCentral" son números enteros (años). Si dice "2 años" → 2. Si dice "Permanente" o "P" → 0.
3. "subserieNombre" = "" (cadena vacía) cuando la fila es una serie sin subserie.
4. "codigo" es el código tal como aparece (ej: "100.01", "GG-001", "01.01.02").
5. Si el fragmento no contiene filas TRD, retorna exactamente: {"actions": []}
6. NO inventes datos. Extrae solo lo explícito en el texto.
7. Campos ausentes: string → "" | número → 0.

REGLA CLAVE SOBRE DEPENDENCIAS:
El fragmento puede indicar la dependencia activa con una línea como:
  "=== DEPENDENCIA ACTIVA: Nombre de la Dependencia ==="
  o con texto en MAYÚSCULAS al inicio de una sección (ej: "100 DESPACHO DEL ALCALDE").

DEBES copiar ese nombre en el campo "dependenciaNombre" de CADA registro del fragmento, incluso si la dependencia solo aparece una vez al inicio del bloque.
Si el fragmento incluye "DEPENDENCIA ACTIVA: X", todos los registros tienen dependenciaNombre = X.

EJEMPLO CORRECTO — un fragmento con una dependencia y varias series:
Fragmento:
  === DEPENDENCIA ACTIVA: Despacho del Alcalde ===
  100.01  Actas              2   8   X (CT)
  100.02  Contratos          5   10      X (E)

Salida esperada:
{"actions":[
  {"type":"CREATE","entity":"trd_records","payload":{"dependenciaNombre":"Despacho del Alcalde","dependenciaCodigo":"100","serieNombre":"Actas","subserieNombre":"","codigo":"100.01","retencionGestion":2,"retencionCentral":8,"disposicion":"CT","procedimiento":"","tipoDocumental":""}},
  {"type":"CREATE","entity":"trd_records","payload":{"dependenciaNombre":"Despacho del Alcalde","dependenciaCodigo":"100","serieNombre":"Contratos","subserieNombre":"","codigo":"100.02","retencionGestion":5,"retencionCentral":10,"disposicion":"E","procedimiento":"","tipoDocumental":""}}
]}"""


# ──────────────────────────────────────────────────────────────────────────────
# Markers used both for chunking and for dependency detection
# ──────────────────────────────────────────────────────────────────────────────
_TRD_SECTION_MARKERS = (
    "DEPENDENCIA", "SECCIÓN", "SECCION", "OFICINA", "DESPACHO",
    "DIVISIÓN", "DIVISION", "ÁREA", "AREA", "UNIDAD",
    "SUBGERENCIA", "GERENCIA", "DIRECCIÓN", "DIRECCION", "SUBDIRECCIÓN",
    "SECRETARÍA", "SECRETARIA", "DEPARTAMENTO", "COORDINACIÓN", "COORDINACION",
)


def _detect_dep_header(line: str) -> str | None:
    """
    Returns the dependency name if the line looks like a dependency section header,
    otherwise returns None. Strips leading codes like '100 ' before the name.
    """
    stripped = line.strip()
    upper = stripped.upper()
    if len(stripped) < 4 or len(stripped) > 120:
        return None
    if not any(upper.startswith(m) for m in _TRD_SECTION_MARKERS):
        # Also accept lines that start with a numeric code followed by a keyword
        # e.g. "100 DESPACHO DEL ALCALDE" or "1.1 SECRETARÍA DE GOBIERNO"
        match = re.match(r'^[\d\.]+\s+(.+)$', stripped)
        if match:
            rest_upper = match.group(1).upper()
            if any(rest_upper.startswith(m) for m in _TRD_SECTION_MARKERS):
                return stripped  # keep the code+name
        return None
    return stripped


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
        """
        Prepend an explicit dependency marker to a chunk if its first line
        doesn't already start a new dependency section.
        This ensures the AI always knows which dependency is active.
        """
        if not dep_context:
            return chunk
        first_line = chunk.strip().split("\n")[0] if chunk.strip() else ""
        if _detect_dep_header(first_line):
            return chunk  # chunk starts its own dependency — no injection needed
        return f"=== DEPENDENCIA ACTIVA: {dep_context} ===\n{chunk}"

    async def analyze(self, full_text: str, images: list, filename: str = "") -> tuple:
        chunks = self._split_into_chunks(full_text)
        if not chunks:
            return [], "No se encontró texto para analizar."

        print(f"[TRDAgent] '{filename}' — {len(chunks)} fragmento(s) con {self.model}")

        all_actions, errors = [], 0
        dep_context = ""  # last known dependency — carried across chunks

        for i, chunk in enumerate(chunks):
            chunk_images = images[:2] if i == 0 else []

            # Inject dependency context so the AI doesn't lose track across chunk boundaries
            augmented_chunk = self._inject_dep_context(chunk, dep_context)
            actions = await self.extract_from_chunk(augmented_chunk, chunk_images)
            all_actions.extend(actions)
            print(f"[TRDAgent] Fragmento {i + 1}/{len(chunks)}: {len(actions)} registros")
            if not actions and i > 0:
                errors += 1

            # Update carried dependency from this chunk's output
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
            is_section = bool(_detect_dep_header(line)) and current_len > 3000
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
