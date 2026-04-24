import os
import fitz # PyMuPDF
import json
from langchain_openai import ChatOpenAI
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
        {text[:15000]} # Limit to avoid context overflow
        
        Responde SOLO el JSON.
        """
        response = await self.llm.ainvoke(prompt)
        return json.loads(response.content)

    async def rag_query(self, query: str, context_docs: List[str], entity_id: str) -> str:
        context = "\n---\n".join(context_docs)
        prompt = f"""
        Actúa como Documencio, el asistente RAG de OSE IA para la entidad {entity_id}.
        Responde a la consulta basándote exclusivamente en el contexto proporcionado.
        
        CONTEXTO:
        {context}
        
        CONSULTA:
        {query}
        """
        response = await self.llm.ainvoke(prompt)
        return response.content

ai = AIProcessor()
