"""
TRD Import Agent — dedicated extraction using GPT-4o-mini via OpenRouter.
Produces flat trd_records actions consumed by executeAgentActions in the frontend.
"""
import os
import json
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage

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
1. "disposicion" SOLO acepta: "CT" (Conservación Total), "E" (Eliminación), "S" (Selección), "MT" (Medio Técnico/Microfilmación). Si el texto dice "CT" o "Conservación total" → "CT"; "E" o "Eliminación" → "E"; "S" o "Selección" → "S"; "MT" → "MT".
2. "retencionGestion" y "retencionCentral" son números enteros (años). Si el texto dice "2 años" → 2. Si dice "Permanente" → 0.
3. "subserieNombre" = "" (cadena vacía) cuando la fila corresponde a una serie sin subseries.
4. "codigo" es el código completo tal como aparece en el documento (ej: "100.01", "GG-001", "01.01.02").
5. Si el fragmento no contiene filas de valoración TRD, retorna exactamente: {"actions": []}
6. NO inventar ni suponer datos. Extraer únicamente lo explícito en el texto.
7. Campos no presentes: string → "" | número → 0.

CÓMO IDENTIFICAR LA JERARQUÍA:
- Las DEPENDENCIAS suelen aparecer como encabezados en MAYÚSCULAS o con código de 2-3 dígitos (ej: "100 GERENCIA GENERAL", "SUBGERENCIA ADMINISTRATIVA").
- Las SERIES tienen un código compuesto (ej: "100.01") y representan agrupaciones temáticas de documentos.
- Las SUBSERIES están anidadas bajo la serie, con código más específico (ej: "100.01.01") o sin código explícito pero indentadas.
- Las columnas AG y AC son los tiempos de retención en años (Archivo de Gestión / Archivo Central).
- Las casillas de DISPOSICIÓN FINAL (CT, E, S, MT) suelen aparecer como marcas X o tilde en columnas separadas.

REPITE DEPENDENCIASOMBRE en cada registro que pertenezca a esa dependencia, aunque el nombre solo aparezca una vez en el encabezado del bloque."""


_TRD_SECTION_MARKERS = (
    "DEPENDENCIA", "SECCIÓN", "SECCION", "OFICINA", "DESPACHO",
    "DIVISIÓN", "DIVISION", "ÁREA", "AREA", "UNIDAD",
    "SUBGERENCIA", "GERENCIA", "DIRECCIÓN", "DIRECCION", "SUBDIRECCIÓN",
    "SUBDIRECCIÓN", "SECRETARÍA", "SECRETARIA", "DEPARTAMENTO"
)


class TRDImportAgent:
    def __init__(self):
        self.model = os.getenv("TRD_EXTRACTION_MODEL", "openai/gpt-4o-mini")
        self.api_key = os.getenv("OPENROUTER_API_KEY")
        self.llm = ChatOpenAI(
            model=self.model,
            openai_api_key=self.api_key,
            openai_api_base="https://openrouter.ai/api/v1",
            temperature=0.0,
            max_tokens=4000,
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

    async def analyze(self, full_text: str, images: list, filename: str = "") -> tuple:
        chunks = self._split_into_chunks(full_text)
        if not chunks:
            return [], "No se encontró texto para analizar."

        print(f"[TRDAgent] '{filename}' — {len(chunks)} fragmento(s) con {self.model}")

        all_actions, errors = [], 0

        for i, chunk in enumerate(chunks):
            chunk_images = images[:2] if i == 0 else []
            actions = await self.extract_from_chunk(chunk, chunk_images)
            all_actions.extend(actions)
            print(f"[TRDAgent] Fragmento {i + 1}/{len(chunks)}: {len(actions)} registros")
            if not actions and i > 0:
                errors += 1

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
            upper = line.strip().upper()
            is_section = (
                any(upper.startswith(m) for m in _TRD_SECTION_MARKERS)
                and len(line.strip()) < 120
            )
            if is_section and current_len > 3000:
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
