import os
import json
import re
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from typing import List, Dict, Any

class AIProcessor:
    def __init__(self):
        self.api_key = os.getenv("OPENROUTER_API_KEY")
        self.model = os.getenv("OPENROUTER_MODEL", "google/gemini-2.0-flash-001")
        self.llm = ChatOpenAI(
            model=self.model,
            openai_api_key=self.api_key,
            openai_api_base="https://openrouter.ai/api/v1",
            temperature=0.1
        )

    async def extract_text_from_pdf(self, pdf_bytes: bytes) -> str:
        import fitz
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        text = ""
        for page in doc:
            text += page.get_text()
        return text

    async def parse_trd_document(self, text: str) -> Dict:
        prompt = f"""
        Interpreta el siguiente texto extraído de una Tabla de Retención Documental (TRD)
        y estructúralo en un JSON válido con Dependencias, Series y Subseries.

        TEXTO:
        {text[:15000]}

        Responde SOLO el JSON.
        """
        response = await self.llm.ainvoke(prompt)
        return json.loads(response.content)

    async def rag_query(
        self,
        query: str,
        context_docs: List[Dict],
        entity_id: str,
        history: List[Dict] = None,
    ) -> str:
        """
        NotebookLM-style RAG query with synthesis, citations and conversation history.
        context_docs: list of {"content": str, "source": str, "chunk": int|str}
        history:      list of {"role": "user"|"assistant", "content": str}
        """
        if not context_docs:
            return (
                "No hay documentos cargados para esta entidad. "
                "Un administrador debe subir documentos antes de poder realizar consultas."
            )

        # Build numbered context sections with source labels
        context_parts = []
        for i, doc in enumerate(context_docs, 1):
            source = doc.get("source", "Documento")
            chunk  = doc.get("chunk", "")
            label  = f"[{i}] {source}" + (f" — sección {chunk}" if chunk != "" else "")
            context_parts.append(f"{label}\n{doc['content'].strip()}")

        context_block = "\n\n" + ("─" * 60 + "\n\n").join(context_parts)

        system_prompt = f"""Eres Documencio, el asistente de documentacion inteligente de OSE IA.
Tu funcion es responder cualquier pregunta de los usuarios basandote UNICAMENTE en los documentos indexados que se te proporcionan.
Eres preciso, claro y siempre indicas la fuente exacta de la informacion.

PRINCIPIOS DE RESPUESTA:
1. PRECISION — Afirma solo lo que esta explicitamente en los documentos. Nunca inventes ni supongas.
2. CITACION — Menciona la fuente usando el formato [Fuente: nombre_archivo]. Si la info viene de varios documentos, cita cada uno.
3. SINTESIS — Si la respuesta esta distribuida en varias secciones o documentos, combinalas de forma coherente y organizada.
4. TRANSPARENCIA — Si la informacion NO esta en ningun documento disponible, responde claramente: "No encontre informacion sobre esto en los documentos disponibles."
5. ESTRUCTURA — Para respuestas largas usa listas con viñetas o numeracion. Para respuestas cortas, un parrafo directo.
6. CONTEXTO CONVERSACIONAL — Usa el historial de la conversacion para responder preguntas de seguimiento sin pedir que el usuario repita informacion.
7. EXHAUSTIVIDAD — Si hay informacion relevante en multiples secciones del mismo documento, incluye todo lo pertinente.

DOCUMENTOS DISPONIBLES ({len(context_docs)} secciones relevantes de {len(set(d.get('source','') for d in context_docs))} documento(s)):
{context_block}
"""

        messages: list = [SystemMessage(content=system_prompt)]

        # Inject conversation history (last 8 turns = 4 exchanges)
        if history:
            for msg in history[-8:]:
                role = msg.get("role", "user")
                content = msg.get("content", "")
                if role == "user":
                    messages.append(HumanMessage(content=content))
                else:
                    messages.append(AIMessage(content=content))

        messages.append(HumanMessage(content=query))

        response = await self.llm.ainvoke(messages)
        return response.content

ai = AIProcessor()
