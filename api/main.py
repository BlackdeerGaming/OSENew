import os
import re
import base64
from dotenv import load_dotenv

#  CRITICAL: Load env vars FIRST before any other imports that read os.getenv 
load_dotenv()

from fastapi import FastAPI, File, UploadFile, HTTPException, APIRouter, BackgroundTasks, Depends, Request, Form
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum
from .permissions import get_current_user, require_super_admin, require_entity_admin
JWT_SECRET = os.environ.get("JWT_SECRET", "ose-ia-secret-key-2024-standard")
JWT_ALGORITHM = "HS256"

# RBAC CONFIGURATION
SUPERADMIN_EMAILS = [email.strip().lower() for email in os.environ.get("SUPERADMIN_EMAILS", "superadmin@ose.com,ivandchaves@gmail.com").split(",") if email.strip()]
DEFAULT_ROLE = "usuario"
ADMIN_ROLE = "administrador"
SUPERADMIN_ROLE = "superadmin"

# ConfiguraciÃƒÂ³n Pinecone
import jwt
from pydantic import BaseModel
import uvicorn
import fitz  # PyMuPDF
import time
import httpx
import asyncio
from datetime import datetime, timedelta, timezone

# LangChain imports
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter

from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough
from langchain_core.messages import HumanMessage, SystemMessage

import json
import uuid
from datetime import datetime, timedelta, timezone
#  Configuracin 

#  Inicializar Servicios compartidos (AWS DynamoDB, LLM, Embeddings)
from .db import db, llm, embeddings
from .aws.ai_processor import ai
from .aws.cognito_auth import cognito
from .aws.s3_storage import s3_client

#  FastAPI App 

app = FastAPI(title="OSE IA - AWS Serverless SaaS")
handler = Mangum(app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def log_requests(request, call_next):
    print(f" {request.method} {request.url.path}")
    response = await call_next(request)
    print(f" {response.status_code}")
    return response

# LLM y Prompts inicializados en db.py

RAG_PROMPT = ChatPromptTemplate.from_messages([
    ("system", """Eres Documencio, el experto en Biblioteca RAG de OSE IA. Tu misión es asistir a los usuarios en la consulta de documentos institucionales con precisión técnica y conocimiento profundo de la normativa archivística.

REGLAS DE RESPUESTA:
1. Responde ÚNICAMENTE basándote en el CONTEXTO DEL DOCUMENTO proporcionado abajo.
2. Si el contexto no tiene la respuesta o no hay documentos relevantes, responde obligatoriamente:
   "Lo siento, no encontré información cargada en mi biblioteca que me permita responder esa pregunta de forma precisa."
3. NO inventes datos ni asumas información que no esté escrita en el contexto.
4. Mantén un tono profesional, experto y servicial.
5. Si encuentras contradicciones en los documentos, indícalo al usuario citando las fuentes.

CONTEXTO DEL DOCUMENTO:
{context}
"""),
    ("human", "{question}")
])

TRD_ARCHITECT_PROMPT = """Eres el OCR Archivístico Inteligente de OSE IA, experto en digitalización y extracción de Tablas de Retención Documental (TRD) según la Ley 594 de 2000 (Colombia).

TU OBJETIVO: 
Se te proporcionará una mezcla de texto corregido (OCR) e IMÁGENES reales de un documento. Debes analizar visualmente la disposición de las tablas, filas y columnas para extraer información precisa.

REGLAS DE EXTRACCIÓN (MUY IMPORTANTES):
1. IDENTIFICACIÓN DE CÓDIGOS:
   - Dependencia: Suele ser un código de 3 dígitos (ej: 100, 110, 200).
   - Serie: Suele ser el código de dependencia seguido de un punto o guion y un número (ej: 100-1, 200.70).
   - Subserie: Código extendido (ej: 100-1-01).
2. COLUMNAS DE VALORACIÓN:
   - Gestión (AG): Años en archivo de oficina.
   - Central (AC): Años en archivo central.
   - Disposición: CT (Conservación Total), E (Eliminación), S (Selección).
3. TRATAMIENTO DE IMAGEN:
   - Si la imagen muestra una tabla, síguela fila por fila. No inventes datos.
   - Si una celda está vacía, asume valor nulo o según contexto previo.

FORMATO DE SALIDA (JSON ESTRICTO):
{
  "message": "He detectado visualmente [X] oficinas y su estructura documental.",
  "actions": [
    {
      "type": "CREATE",
      "entity": "trd_records",
      "payload": {
        "dependenciaNombre": "SECRETARÍA GENERAL",
        "codigo": "100.1.01",
        "serieNombre": "ACTAS",
        "subserieNombre": "ACTAS DE CONSEJO",
        "retencionGestion": 2,
        "retencionCentral": 8,
        "disposicion": "CT",
        "procedimiento": "Conservación total según AGN."
      }
    }
  ]
}
"""


#  Helpers 

class ChatRequest(BaseModel):
    query: str
    entidadId: str | None = None

class ActivityLogRequest(BaseModel):
    message: str
    entidad_id: str | None = None
    user_name: str | None = None

class GenerateDepsRequest(BaseModel):
    prompt: str

class AgentActionContext(BaseModel):
    dependencias: list[dict]
    series: list[dict]
    subseries: list[dict]
    trdRecords: list[dict] = []
    entidades: list[dict] = []

class HistoryMessage(BaseModel):
    role: str
    content: str

class AgentActionRequest(BaseModel):
    prompt: str
    context: AgentActionContext
    history: list[HistoryMessage] = []

class ActivationEmailRequest(BaseModel):
    email: str
    nombre: str
    link: str

class ChatHistoryRequest(BaseModel):
    messages: list[dict]

class UserCreate(BaseModel):
    nombre: str
    apellido: str | None = ""
    email: str
    username: str
    perfil: str
    entidadId: str | None = None
    entidadIds: list[str] | None = None
    activationToken: str | None = None
    tokenExpiry: int | None = None
    iaDisponible: bool | None = False

class InvitationCreate(BaseModel):
    email: str
    entity_id: str
    role: str = "usuario"
    ia_disponible: bool = False

class ActivityLogCreate(BaseModel):
    message: str
    user_name: str
    # Opcional: mensajes personalizados, etc.

class InvitationRespond(BaseModel):
    action: str # 'accept' o 'reject'

class InvitationArchive(BaseModel):
    archived: bool

class InvitationBulkArchive(BaseModel):
    ids: list[str]
    archived: bool = True

class UserActivate(BaseModel):
    token: str
    password: str

class LoginRequest(BaseModel):
    identifier: str
    password: str
    activationToken: str | None = None
    tokenExpiry: int | None = None

class GoogleAuthRequest(BaseModel):
    email: str
    nombre: str
    apellido: str | None = ""
    uid: str | None = None

class UserUpdate(BaseModel):
    nombre: str | None = None
    apellido: str | None = None
    estado: str | None = None
    perfil: str | None = None
    entidadId: str | None = None
    entidadIds: list[str] | None = None
    isActivated: bool | None = None
    iaDisponible: bool | None = None

class UserSignUp(BaseModel):
    nombre: str
    apellido: str | None = ""
    email: str
    username: str
    password: str
    phone: str | None = ""

class EntityCreate(BaseModel):
    razonSocial: str
    nit: str | None = None
    numeroDocumento: str | None = None
    email: str | None = None
    correo: str | None = None
    telefono: str | None = None
    pais: str | None = "Colombia"
    departamento: str | None = None
    ciudad: str | None = None
    sigla: str | None = None
    direccion: str | None = None
    maxUsuarios: int | None = 10
    maxDependencias: int | None = 20
    estado: str | None = "Activo"

class PasswordResetRequest(BaseModel):
    email: str

class PerformResetRequest(BaseModel):
    token: str
    new_password: str

class ChatHistoryUpdate(BaseModel):
    messages: list[dict]

def clean_text(text: str) -> str:
    text = re.sub(r'(?<!\n)\n(?!\n)', ' ', text)
    text = re.sub(r'\n{2,}', '\n', text)
    text = re.sub(r'^\s*\d+\s*$', '', text, flags=re.MULTILINE)
    text = re.sub(r'  +', ' ', text)
    return text.strip()

def format_docs(docs):
    return "\n\n---\n\n".join(doc.page_content for doc in docs)

def clean_text(text):
    # Basic cleaning
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

async def index_document_rag(doc_id: str | None, content: bytes, filename: str, entidad: str, file_url: str):
    """
    Background Task: Extrae texto, realiza chunking y envía vectores a Supabase PgVector.
    """
    print(f"--- RAG BACKGROUND: Iniciando indexación semántica para {filename} ---")
    if not supabase_client or not embeddings:
        print("RAG BACKGROUND: Saltando, Supabase o Embeddings no están configurados.")
        return

    try:
        import fitz
        fitz_doc = fitz.open(stream=content, filetype="pdf")
        full_text = ""
        for page in fitz_doc:
            full_text += page.get_text() + "\n"
        fitz_doc.close()
        
        cleaned_text = clean_text(full_text)
        if not cleaned_text:
            print("RAG BACKGROUND: No se extrajo texto útil.")
            return
            
        text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
        docs = text_splitter.create_documents([cleaned_text])
        
        for i, doc in enumerate(docs):
            doc.metadata = {
                "source": filename,
                "chunk": i,
                "entidad_id": entidad or "",
                "file_url": file_url or "",
                "status": "success",
                "type": "rag_chunk",
                "created_at": datetime.now().isoformat()
            }
            
        vector_store = SupabaseVectorStore(
            embedding=embeddings,
            client=supabase_client,
            table_name="rag_documents",
            query_name="match_rag_documents"
        )
        
        await asyncio.to_thread(vector_store.add_documents, docs)
        print(f"RAG BACKGROUND: ✨ Éxito indexando {filename}.")
    except Exception as e:
        print(f"RAG BACKGROUND ERROR: ⚠️ Falló indexación -> {e}")

async def process_ocr_task(doc_id: str, content: bytes, filename: str):
    """
    Proceso de segundo plano para extraer texto e imágenes para Visión IA.
    Actualiza el estado a 'reviewing' al terminar para que el usuario pueda aprobar.
    """
    print(f"--- Iniciando OCR NATIVO (Visión) para: {filename} ---")
    
    extracted_text = ""
    images_base64 = []
    
    try:
        import fitz
        from datetime import datetime
        
        fitz_doc = fitz.open(stream=content, filetype="pdf")
        pages_to_process = min(len(fitz_doc), 5) 
        
        for i in range(pages_to_process):
            page = fitz_doc[i]
            text_chunk = page.get_text().strip()
            if text_chunk:
                extracted_text += f"\n--- PÁGINA {i+1} ---\n" + text_chunk
            
            pix = page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5))
            img_data = pix.tobytes("png")
            b64 = base64.b64encode(img_data).decode("utf-8")
            images_base64.append(b64)
            
        fitz_doc.close()
    except Exception as e:
        print(f"Error procesando PDF: {e}")

    # Obtener el file_url y entidad_id actuales de la sesión
    file_url = None
    entidad_id = None
    try:
        row = supabase_client.table("rag_documents").select("metadata").eq("id", doc_id).execute()
        if row.data:
            file_url = row.data[0]["metadata"].get("file_url")
            entidad_id = row.data[0]["metadata"].get("entidad_id")
    except: pass

    try:
        print(f"Solicitando Análisis Visual TRD para: {filename}")
        
        messages = [
            SystemMessage(content=TRD_ARCHITECT_PROMPT),
        ]
        
        user_content = [
            {"type": "text", "text": f"Analiza esta TRD. Texto extraído: \n{extracted_text[:4000]}"}
        ]
        
        for b64_img in images_base64[:5]:
            user_content.append({
                "type": "image_url",
                "image_url": {"url": f"data:image/png;base64,{b64_img}"}
            })
            
        messages.append(HumanMessage(content=user_content))
        
        parsed_actions = []
        ai_message = "Módulo de Visión completó el análisis."
        
        try:
            response_ai = llm.invoke(messages)
            content_ai = response_ai.content.strip()
            
            # Limpieza de JSON
            if "```json" in content_ai:
                content_ai = content_ai.split("```json")[-1].split("```")[0].strip()
            elif "```" in content_ai:
                content_ai = content_ai.split("```")[-1].split("```")[0].strip()
            else:
                start = content_ai.find('{')
                end = content_ai.rfind('}')
                if start != -1 and end != -1:
                    content_ai = content_ai[start:end+1]
            
            ai_data = json.loads(content_ai)
            parsed_actions = ai_data.get("actions", [])
            ai_message = ai_data.get("message", ai_message)
        except Exception as ai_err:
            print(f"Error en IA: {ai_err}")
            ai_message = f"Error en procesamiento: {str(ai_err)}"

        # Guardar resultado final
        doc_metadata = {
            "source": filename,
            "type": "temp_trd_session",
            "file_url": file_url,
            "entidad_id": entidad_id,
            "status": "reviewing",
            "actions": parsed_actions,
            "message": ai_message,
            "created_at": datetime.now().isoformat()
        }
        
        supabase_client.table("rag_documents").update({
            "metadata": doc_metadata
        }).eq("id", doc_id).execute()
        
        print(f"OK: Proceso terminado para: {filename}")
        
    except Exception as e:
        print(f"Error crítico: {e}")
        try:
            supabase_client.table("rag_documents").update({
                "metadata": {
                    "source": filename, "status": "error", "message": str(e),
                    "type": "temp_trd_session", "created_at": datetime.now().isoformat()
                }
            }).eq("id", doc_id).execute()
        except: pass


#  Endpoints 

router = APIRouter(prefix="/api")

# Import dedicated TRD routes with cloud sync and role checks
from .trd_routes import router as trd_router
router.include_router(trd_router, prefix="/trd")


@router.get("/")
async def root():
    return {
        "status": "ok",
        "model": OPENROUTER_MODEL,
        "vector_store": "supabase_pgvector",
        "supabase": bool(supabase_client)
    }

@router.get("/rag-stat")
async def rag_stat():
    """Devuelve el conteo de documentos en el vector store."""
    if not supabase_client:
        return {"error": "Supabase no configurado"}
    try:
        res = supabase_client.table("rag_documents").select("id", count="exact").execute()
        return {
            "total_documents": res.count,
            "db_status": "connected"
        }
    except Exception as e:
        print(f" Error en rag-stat: {e}")
        return {"error": str(e)}

@router.get("/debug-vars")
async def debug_vars():
    return {
        "OPENROUTER_KEY_SET": bool(OPENROUTER_API_KEY),
        "SUPABASE_URL_SET": bool(SUPABASE_URL),
        "SUPABASE_KEY_SET": bool(SUPABASE_SERVICE_KEY),
        "EMBEDDINGS_READY": bool(embeddings),
        "VERCEL_ENV": os.getenv("VERCEL_ENV", "local"),
    }

@router.post("/upload")
async def upload_pdf(background_tasks: BackgroundTasks, file: UploadFile = File(...), entidad_id: str = "", user: dict = Depends(get_current_user)):
    """
    Sube un PDF, extrae texto, genera embeddings y los guarda en Supabase pgvector.
    Vision AI desactivada para evitar timeout de Vercel (10s lmite).
    """
    if not supabase_client:
        raise HTTPException(status_code=503, detail="Supabase no est configurado en el servidor.")
    if embeddings is None:
        raise HTTPException(status_code=503, detail="El motor de embeddings no est disponible.")

    print(f" POST /upload - File: {file.filename} - Type: {file.content_type}")

    #  Deduplication check 
    try:
        dup_check = (
            supabase_client
            .table("rag_documents")
            .select("id")
            .contains("metadata", {"source": file.filename})
            .limit(1)
            .execute()
        )
        if dup_check.data and len(dup_check.data) > 0:
            raise HTTPException(
                status_code=409,
                detail=f"El documento '{file.filename}' ya existe en la Biblioteca RAG. Elimnalo primero si deseas reindexarlo."
            )
    except HTTPException:
        raise
    except Exception as dup_err:
        print(f" Error en chequeo de duplicados: {dup_err}")  # No bloquear el flujo

    content = await file.read()
    print(f" Tamao recibido: {len(content) / (1024*1024):.2f} MB")

    # 1. Guardar el archivo original en Supabase Storage
    file_url = None
    try:
        bucket = "rag-uploads"
        # Limpiar nombre del archivo
        clean_filename = f"{int(time.time())}_{file.filename.replace(' ', '_')}"
        supabase_client.storage.from_(bucket).upload(clean_filename, content, {"content-type": "application/pdf"})
        file_url = supabase_client.storage.from_(bucket).get_public_url(clean_filename)
        print(f"  PDF subido a Storage: {file_url}")
    except Exception as e:
        print(f"  Error subiendo PDF a Storage, se continuar con el RAG pero no habr visor original: {e}")

    # Determinar entidad para el documento
    entidad_final = user.get("entity_id") if user.get("role") == ADMIN_ROLE else entidad_id

    # En lugar de bloquear, lo delegamos a una tarea de fondo
    background_tasks.add_task(index_document_rag, None, content, file.filename, entidad_final, file_url)

    return {
        "message": f"PDF '{file.filename}' recibido. Se estÃ¡ indexando en segundo plano.",
        "status": "indexing"
    }

@router.post("/chat")
async def chat(request: ChatRequest, user: dict = Depends(get_current_user)):
    if not supabase_client:
        raise HTTPException(status_code=503, detail="Supabase no estÃƒÂ¡ configurado.")

    print(f"\n --- CONSULTA DOCUMENCIO ---")
    print(f" Query: {request.query}")
    print(f" User Role: {user.get('role')}")

    if not embeddings or not llm:
        return {"answer": "Lo siento, los servicios de IA no estÃƒÂ¡n configurados correctamente. Por favor verifica las credenciales.", "sources": []}

    try:
        # 1. Generar embedding
        query_vector = None
        try:
            query_vector = embeddings.embed_query(request.query)
        except Exception as e:
            print(f" Error en embedding: {e}")
            return {"answer": "Tuve un inconveniente tcnico al procesar el sentido de tu pregunta. Por favor intenta de nuevo.", "sources": []}

        if not query_vector:
            return {"answer": "No pude procesar tu pregunta. Intenta redactarla de forma mÃƒÂ¡s sencilla.", "sources": []}

        # 2. Determinar entidad para filtro
        # Si es superadmin, no aplicamos filtro de entidad por defecto (permite ver todo)
        # excepto si se solicita una especÃƒÂ­fica.
        rol = user.get("role")
        if rol == "superadmin":
            entidad_actual = request.entidadId if request.entidadId and request.entidadId != "e0" else None
        else:
            entidad_actual = user.get("entity_id") or request.entidadId
        
        search_filter = {"entidad_id": entidad_actual} if entidad_actual else {}
        
        # 3. BÃƒÂºsqueda RPC
        print(f" Buscando en Supabase (Filtro Entidad: {entidad_actual if entidad_actual else 'GLOBAL'})...")
        try:
            rpc_res = supabase_client.rpc("match_rag_documents", {
                "query_embedding": query_vector,
                "match_count": 5,
                "filter": search_filter
            }).execute()
        except Exception as e:
            print(f" Error en RPC Supabase: {e}")
            return {"answer": "No pude conectar con la base de datos de documentos en este momento.", "sources": []}

        source_docs = []
        if rpc_res.data:
            print(f" Fragmentos encontrados: {len(rpc_res.data)}")
            source_docs = [
                Document(page_content=row["content"], metadata=row["metadata"])
                for row in rpc_res.data
                if row.get("metadata", {}).get("status") in (None, "success")
            ]
        
        if not source_docs:
            print(" No se encontraron documentos relevantes para esta entidad.")
            return {"answer": "Lo siento, no encontrÃƒÂ© informaciÃƒÂ³n cargada en mi biblioteca que me permita responder esa pregunta de forma precisa.", "sources": []}

        # 3. Respuesta LLM
        print(" Generando respuesta...")
        try:
            rag_chain = ( RAG_PROMPT | llm | StrOutputParser() )
            answer = rag_chain.invoke({
                "context": format_docs(source_docs),
                "question": request.query
            })
            
            pages = sorted(set(
                d.metadata.get("page")
                for d in source_docs
                if d.metadata.get("page") is not None
            ))
            return {"answer": answer, "sources": pages}
        except Exception as e:
            print(f" Error en LLM: {e}")
            return {"answer": "Encontr algunos documentos pero no pude redactar la respuesta. Por favor intenta de nuevo.", "sources": []}

    except Exception as e:
        print(f" Error crtico en chat: {e}")
        return {"answer": "Lo siento, ocurri un error inesperado. Por favor intenta de nuevo en unos momentos.", "sources": []}

@router.get("/rag-documents")
async def get_rag_documents(entidad_id: str | None = None, user: dict = Depends(get_current_user)):
    """Lista los documentos \u00fanicos en el RAG (agrupados por source)."""
    if not supabase_client: raise HTTPException(503)
    
    try:
        # Si es superadmin puede ver todo, si no, solo lo de su entidad
        query = supabase_client.table("rag_documents").select("id, metadata, created_at")
        
        # Filtro de entidad
        if user.get("role") != SUPERADMIN_ROLE:
            entidad_actual = user.get("entity_id")
            if entidad_actual:
                query = query.filter("metadata->>entidad_id", "eq", entidad_actual)
        elif entidad_id and entidad_id != "e0":
            query = query.filter("metadata->>entidad_id", "eq", entidad_id)

        res = query.execute()
        
        # Agrupar por source para no repetir chunks
        seen_sources = {}
        unique_docs = []
        
        for item in res.data:
            meta = item.get("metadata", {})
            source = meta.get("source")
            if source and source not in seen_sources:
                seen_sources[source] = True
                unique_docs.append({
                    "id": item["id"],
                    "filename": source,
                    "metadata": meta,
                    "created_at": item.get("created_at")
                })
        
        return unique_docs
    except Exception as e:
        print(f" Error listando documentos RAG: {e}")
        return []

@router.put("/rag-documents/{doc_id}")
async def update_rag_document(doc_id: str, payload: dict, user: dict = Depends(get_current_user)):
    """Actualiza la metadata de todos los chunks de un documento."""
    if not supabase_client: raise HTTPException(503)
    if user.get("role") != SUPERADMIN_ROLE: raise HTTPException(403)
    
    try:
        doc_res = supabase_client.table("rag_documents").select("metadata").eq("id", doc_id).execute()
        if not doc_res.data: raise HTTPException(404)
        
        source = doc_res.data[0]["metadata"].get("source")
        
        all_chunks = supabase_client.table("rag_documents").select("id, metadata").execute()
        to_update = [c for c in all_chunks.data if c["metadata"].get("source") == source]
        
        for chunk in to_update:
            new_meta = {**chunk["metadata"], **payload}
            supabase_client.table("rag_documents").update({"metadata": new_meta}).eq("id", chunk["id"]).execute()
            
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(500, str(e))

@router.delete("/rag-documents/{doc_id}")
async def delete_rag_document(doc_id: str, user: dict = Depends(get_current_user)):
    """Elimina un documento y todos sus vectores asociados."""
    if not supabase_client: raise HTTPException(503)
    if user.get("role") != SUPERADMIN_ROLE: raise HTTPException(403)
    
    try:
        doc_res = supabase_client.table("rag_documents").select("metadata").eq("id", doc_id).execute()
        if not doc_res.data: raise HTTPException(404)
        
        source = doc_res.data[0]["metadata"].get("source")
        
        file_url = doc_res.data[0]["metadata"].get("file_url")
        if file_url and "rag-uploads/" in file_url:
            try:
                filename_storage = file_url.split("rag-uploads/")[-1]
                supabase_client.storage.from_("rag-uploads").remove([filename_storage])
            except: pass

        all_chunks = supabase_client.table("rag_documents").select("id, metadata").execute()
        ids_to_delete = [c["id"] for c in all_chunks.data if c["metadata"].get("source") == source]
        
        if ids_to_delete:
            supabase_client.table("rag_documents").delete().in_("id", ids_to_delete).execute()
            
        return {"status": "success", "deleted_count": len(ids_to_delete)}
    except Exception as e:
        raise HTTPException(500, str(e))

@router.post("/generate-dependencias")
async def generate_dependencias(request: GenerateDepsRequest):
    system_prompt = """Eres un experto en gestin organizacional y diseo de estructuras administrativas. 
El usuario te dar una instruccin para crear dependencias. Debes extraer los nombres de las dependencias solicitadas, mantener EXACTAMENTE el orden en que las pidi, y rellenar la informacin faltante con datos simulados pero realistas y corporativos.

INSTRUCCIONES DE FORMATO:
Debes responder ESTRICTAMENTE con un arreglo de objetos JSON en el que cada objeto tenga esta estructura exacta (sin texto extra):
[
  {
    "nombre": "Nombre de la dependencia",
    "sigla": "Sigla en maysculas (2 a 4 letras)",
    "codigo": "Un nmero o cdigo alfanumrico nico",
    "pais": "Colombia",
    "departamento": "Cundinamarca",
    "ciudad": "Bogot",
    "direccion": "Direccin realista en la ciudad",
    "telefono": "Nmero de telfono ficticio realista",
    "dependeDe": "ninguna"
  }
]

Asegrate de generar un objeto por cada dependencia solicitada en el prompt del usuario.
IMPORTANTE: RESPONDE SOLO CON EL JSON VLIDO. NO incluyas markdown (```json), etiquetas, saludos, explicaciones ni texto adicional."""

    try:
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=request.prompt)
        ]
        response = llm.invoke(messages)
        content = response.content.strip()
        for marker in ["```json", "```"]:
            content = content.replace(marker, "")
        content = content.strip()
        dependencias = json.loads(content)
        return {"dependencias": dependencias}
    except Exception as e:
        print(f" Error generando dependencias: {e}")
        raise HTTPException(status_code=500, detail=f"Error al generar dependencias: {str(e)}")

@router.post("/agent-action")
async def agent_action(request: AgentActionRequest):
    from langchain_core.messages import AIMessage

    deps = [{"id": d.get("id"), "nombre": d.get("nombre")} for d in request.context.dependencias]
    series = [{"id": s.get("id"), "nombre": s.get("nombre"), "dependenciaId": s.get("dependenciaId")} for s in request.context.series]
    subs = [{"id": s.get("id"), "nombre": s.get("nombre"), "serieId": s.get("serieId")} for s in request.context.subseries]
    trds = [{"id": t.get("id"), "dependencia_id": t.get("dependenciaId"), "serie_id": t.get("serieId")} for t in request.context.trdRecords]
    ents = [{"id": e.get("id"), "nombre": e.get("nombre") or e.get("razonSocial")} for e in request.context.entidades]

    system_prompt = f"""Eres Orianna, la Arquitecta TRD de OSE IA, una inteligencia artificial experta en la gestión y automatización de Tablas de Retención Documental (TRD) bajo los estándares del AGN (Archivo General de la Nación) y la Ley 594 de 2000 de Colombia.

TU MISIÓN:
Debes actuar como la autoridad máxima en la estructura documental de la entidad. Tu objetivo es interpretar la intención del usuario para realizar:
1. CONSULTAS ESTRUCTURALES: Analizar y responder sobre dependencias, series, subseries y registros existentes.
2. OPERACIONES ESTRATÉGICAS (CRUD): Crear, editar o eliminar elementos manteniendo la integridad jerárquica del sistema.

CONOCIMIENTO DEL ENTORNO (Contexto Real):
- Entidades vinculadas: {json.dumps(ents, ensure_ascii=False)}
- Dependencias (Oficinas): {json.dumps(deps, ensure_ascii=False)}
- Series Documentales: {json.dumps(series, ensure_ascii=False)}
- Subseries Documentales: {json.dumps(subs, ensure_ascii=False)}
- Registros TRD (Valoración): {json.dumps(trds, ensure_ascii=False)}

REGLAS DE ORO DE ORIANNA:
1. INTEGRIDAD DE NOMBRES: Los nombres de dependencias o series NUNCA deben ser abreviados ni resumidos por ti. Usa el nombre oficial completo (ej: "Secretaría de Hacienda y Crédito Público").
2. VALIDACIÓN ESTRUCTURAL (CRÍTICO):
   - PARA CREAR SERIES: Es obligatorio conocer la Dependencia productora y el Código. Si falta algo, pregunta con autoridad: "¿Para qué dependencia es la serie y qué código oficial le asignaremos?"
   - PARA CREAR SUBSERIES: Requiere Dependencia, Serie y Código propio. Si hay ambigüedad, solicita los datos faltantes antes de generar cualquier acción.
3. DETECCIÓN DE INTENCIÓN PROACTIVA:
   - Si el usuario pregunta "Qué series hay...", responde con un listado estructurado y profesional basado en el contexto.
   - Si el usuario ordena cambios, genera el objeto 'actions' con precisión quirúrgica.
4. JERARQUÍA AUTOMÁTICA: Si se solicita una estructura compleja, genera múltiples acciones CREATE usando IDs temporales (t1, t2...) para enlazar los niveles de forma coherente.
5. MODO CONSULTA (QUERY): Si solo informas o si faltan datos, usa "intent": "QUERY". Si vas a ejecutar cambios, usa "intent": "CRUD".

ESTRUCTURA DE DATOS (Payloads):
- 'dependencias': {{ "nombre", "sigla", "codigo", "dependeDe" }}
- 'series': {{ "dependenciaId", "nombre", "codigo", "tipoDocumental" }}
- 'subseries': {{ "dependenciaId", "serieId", "nombre", "codigo" }}
- 'trd_records': {{ "dependenciaId", "serieId", "subserieId", "retencionGestion", "retencionCentral", "disposicion", "procedimiento" }}

ESTRUCTURA DE RESPUESTA (JSON PUERTO):
{{
  "message": "Respuesta detallada y amable",
  "intent": "QUERY" | "CRUD",
  "actions": [
    {{
      "type": "CREATE" | "UPDATE" | "DELETE",
      "entity": "dependencias" | "series" | "subseries" | "trd_records",
      "id": "ID real o temp",
      "payload": {{ ... }}
    }}
  ]
}}
"""
    try:
        messages_llm = [SystemMessage(content=system_prompt)]
        for h in request.history[-6:]:
            if h.role == "user":
                messages_llm.append(HumanMessage(content=h.content))
            elif h.role == "agent":
                messages_llm.append(AIMessage(content=h.content))
        messages_llm.append(HumanMessage(content=request.prompt))

        response = llm.invoke(messages_llm)
        content = response.content.strip()
        
        # Robustly extract JSON from the response
        json_match = re.search(r'(\{.*\})', content, re.DOTALL)
        if json_match:
            try:
                return json.loads(json_match.group(1))
            except json.JSONDecodeError:
                pass
        
        # Fallback to previous logic if regex fails
        for marker in ["```json", "```"]:
            content = content.replace(marker, "")
        content = content.strip()
        return json.loads(content)
    except Exception as e:
        print(f" Error en agent-action: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/chat-history/{assistant}")
async def get_chat_history(assistant: str, user: dict = Depends(get_current_user)):
    """Recupera el historial de chat privado para un usuario y asistente específico."""
    user_id = user.get("user_id")
    if not user_id: raise HTTPException(status_code=401, detail="No user ID found in token")
    
    try:
        item = await db.get_item("chat_sessions", f"USER#{user_id}", f"CHAT#{assistant}")
        if item:
            return {"messages": item.get("messages", [])}
        return {"messages": []}
    except Exception as e:
        print(f" Error recuperando historial ({assistant}): {e}")
        return {"messages": []}

@router.post("/chat-history/{assistant}")
async def save_chat_history(assistant: str, payload: ChatHistoryUpdate, user: dict = Depends(get_current_user)):
    """Guarda o actualiza el historial de chat privado. Limita a los ltimos 50 mensajes."""
    if not supabase_client: raise HTTPException(status_code=503)
    user_id = user.get("user_id")
    if not user_id: raise HTTPException(status_code=401, detail="No user ID found in token")

    # Limitar a los ltimos 50 mensajes para optimizar almacenamiento
    limited_messages = payload.messages[-50:]
    
    data = {
        "user_id": user_id,
        "assistant": assistant,
        "messages": limited_messages,
        "updated_at": datetime.now().isoformat()
    }
    
    try:
        supabase_client.table("chat_history").upsert(data, on_conflict="user_id,assistant").execute()
        return {"status": "success"}
    except Exception as e:
        print(f" Error guardando historial ({assistant}): {e}")
        raise HTTPException(status_code=500, detail=f"Error al guardar historial: {str(e)}")

@router.post("/send-activation")
async def send_activation(request: ActivationEmailRequest):
    html_content = f"""
    <div style="background-color: #f8fafc; padding: 40px 20px; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <div style="max-width: 560px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); border: 1px solid #e2e8f0;">
            <div style="background-color: #0f172a; padding: 32px; text-align: center;">
                <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.025em;">OSE IA</h1>
                <p style="color: #94a3b8; margin: 8px 0 0 0; font-size: 14px;">Gestin Documental Inteligente</p>
            </div>
            <div style="padding: 40px 32px;">
                <h2 style="color: #1e293b; margin: 0 0 16px 0; font-size: 20px; font-weight: 600;">Hola, {request.nombre}!</h2>
                <p style="color: #475569; margin: 0 0 24px 0; font-size: 16px; line-height: 1.6;">
                    Has sido invitado a unirte a <strong>OSE IA</strong>. Nuestra plataforma utiliza inteligencia artificial para transformar la forma en que gestionas y consultas tu archivo documental.
                </p>
                <div style="background-color: #f1f5f9; border-radius: 8px; padding: 20px; margin-bottom: 32px; border-left: 4px solid #2563eb;">
                    <p style="color: #1e293b; margin: 0; font-size: 14px; line-height: 1.5;">
                        Para comenzar, es necesario que actives tu cuenta y definas una contrasea segura mediante el siguiente botn:
                    </p>
                </div>
                <div style="text-align: center; margin-bottom: 32px;">
                    <a href="{request.link}" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; transition: background-color 0.2s;">
                        Activar mi cuenta ahora
                    </a>
                </div>
                <p style="color: #64748b; margin: 0 0 8px 0; font-size: 13px;">
                    Tienes problemas con el botn? Copia y pega este enlace:
                </p>
                <p style="background-color: #f8fafc; padding: 12px; border-radius: 6px; border: 1px solid #e2e8f0; font-size: 12px; color: #2563eb; margin: 0; word-break: break-all;">
                    {request.link}
                </p>
            </div>
            <div style="background-color: #f8fafc; padding: 24px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
                <p style="color: #94a3b8; margin: 0; font-size: 12px;">
                    Este enlace de invitacin es nico para ti y expirar en <strong>30 minutos</strong> automticamente por motivos de seguridad.
                </p>
                <p style="color: #CBD5E1; margin: 16px 0 0 0; font-size: 11px;">
                    &copy; 2026 OSE IA. Todos los derechos reservados.
                </p>
            </div>
        </div>
    </div>
    """
    
    if RESEND_API_KEY:
        try:
            async with httpx.AsyncClient() as client:
                res = await client.post(
                    "https://api.resend.com/emails",
                    headers={
                        "Authorization": f"Bearer {RESEND_API_KEY}", 
                        "Content-Type": "application/json",
                        "User-Agent": "python-httpx/1.0"
                    },
                    json={
                        "from": RESEND_FROM_EMAIL,
                        "to": [request.email],
                        "subject": "Activa tu cuenta en OSE IA",
                        "html": html_content
                    }
                )
                if res.status_code not in [200, 201]:
                    print(f" Error Resend ({res.status_code}): {res.text}")
                else:
                    print(f" Email enviado exitosamente via Resend (ID: {res.json().get('id')})")
        except Exception as e:
            print(f" Error enviando email: {e}")

    print(f"\n [EMAIL ENVIADO] PARA: {request.email} | LINK: {request.link}\n")
    return {"status": "sent", "message": f"Email sent to {request.email}"}

async def request_reset(request: PasswordResetRequest):
    """Genera un token de reseteo y envía el correo"""
    target_email = request.email.strip().lower()
    
    # En DynamoDB/Cognito, la búsqueda por email suele requerir un GSI
    # Por ahora, simulamos la búsqueda en la tabla Users
    try:
        # En una arquitectura real con Cognito, usaríamos cognito.forgot_password(email)
        token = str(uuid.uuid4())
        # Guardaríamos esto en una tabla temporal o en el perfil del usuario en DynamoDB
        return {"status": "ok", "message": "Si el correo está registrado, recibirás un enlace de recuperación."}
    except Exception as e:
        print(f" Error en reset: {e}")
        return {"status": "ok"}
    
    # 3. Enviar correo
    if RESEND_API_KEY:
        reset_link = f"https://ose-new.vercel.app/?reset_token={token}"
        html_content = f"""
        <html>
        <body style="font-family: Arial, sans-serif; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                <h2 style="color: #00bfa5;">Recuperación de Contraseña</h2>
                <p>Hola {user['nombre']},</p>
                <p>Has solicitado restablecer tu contraseña en OSE IA. Haz clic en el siguiente botón para continuar:</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="{reset_link}" style="background-color: #00bfa5; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Restablecer Contraseña</a>
                </div>
                <p style="font-size: 12px; color: #777;">Si no solicitaste este cambio, puedes ignorar este correo. El enlace caducará en 1 hora.</p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                <p style="font-size: 10px; color: #aaa; text-align: center;">OSE IA • Gestión Documental Inteligente</p>
            </div>
        </body>
        </html>
        """
        try:
            async with httpx.AsyncClient() as client:
                res = await client.post(
                    "https://api.resend.com/emails",
                    headers={"Authorization": f"Bearer {RESEND_API_KEY}", "Content-Type": "application/json"},
                    json={
                        "from": RESEND_FROM_EMAIL,
                        "to": [target_email],
                        "subject": "Recuperar contrasena - OSE IA",
                        "html": html_content
                    }
                )
                print(f"DEBUG Email Reset status: {res.status_code}")
        except Exception as e:
            print(f"Error enviando correo de reset: {e}")

    return {"status": "ok", "message": "Si el correo está registrado, recibirás un enlace de recuperación."}

@router.post("/perform-reset")
async def perform_reset(request: PerformResetRequest):
    """Valida el token y actualiza la contraseÃƒÂ±a"""
    if not supabase_client: raise HTTPException(500, "Base de datos desconectada")
    
    # 1. Buscar usuario por token
    now = int(datetime.now(timezone.utc).timestamp())
    res = supabase_client.table("profiles").select("*").eq("reset_token", request.token).execute()
    
    if not res.data:
        raise HTTPException(400, "El enlace de recuperación no es válido.")
    
    user = res.data[0]
    
    # 2. Verificar expiraciÃƒÂ³n
    if user.get("reset_token_expiry") and user["reset_token_expiry"] < now:
        raise HTTPException(400, "El enlace de recuperación ha expirado.")
        
    # 3. Actualizar contraseÃƒÂ±a y limpiar token
    supabase_client.table("profiles").update({
        "password": request.new_password,
        "reset_token": None,
        "reset_token_expiry": None
    }).eq("id", user["id"]).execute()
    
    return {"status": "success", "message": "Tu contraseña ha sido actualizada correctamente."}

@router.get("/activation-info/{token}")
async def get_activation_info(token: str):
    if not supabase_client: raise HTTPException(500, "Error de conexin a la base de datos")
    res = supabase_client.table("profiles").select("email, nombre, apellido").eq("activation_token", token).execute()
    if not res.data:
        raise HTTPException(404, "El cdigo de activacin no es vlido o ya ha sido utilizado.")
    return res.data[0]

@router.post("/activate")
async def activate_user(req: UserActivate):
    if not supabase_client: raise HTTPException(500, "Error de conexin a la base de datos")
    
    # Buscar usuario por token
    res = supabase_client.table("profiles").select("*").eq("activation_token", req.token).execute()
    
    if not res.data:
        raise HTTPException(400, "El cdigo de activacin no es vlido.")
        
    user_data = res.data[0]
    
    # Verificar expiracin (si el tokenExpiry es anterior al tiempo actual)
    if user_data.get("token_expiry") and user_data["token_expiry"] < int(time.time() * 1000):
         raise HTTPException(400, "El cdigo de activacin ha expirado. Solicita una nueva invitacin.")

    # Actualizar usuario
    try:
        update_res = supabase_client.table("profiles").update({
            "password": req.password,
            "is_activated"        return {"status": "success", "message": "Cuenta activada correctamente."}
    except Exception as e:
        print(f" Error activando usuario: {e}")
        raise HTTPException(500, f"Error interno: {str(e)}")

@router.post("/login")
async def login(req: LoginRequest):
    # En una implementación real con Cognito:
    # return await cognito.authenticate(req.identifier, req.password)
    
    # Por ahora, buscamos en DynamoDB Users (simulando autenticación)
    items = await db.scan_table("users") # Debería ser un GSI por email/username
    user = next((u for u in items if u.get("email") == req.identifier or u.get("username") == req.identifier), None)
    
    if not user: raise HTTPException(401, "El usuario no existe")
    
    payload = {
        "user_id": user.get("id", user.get("PK")),
        "role": user.get("role", "usuario"),
        "entity_id": user.get("active_entity_id", "e0")
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return {
        "id": payload["user_id"],
        "nombre": user.get("nombre"),
        "email": user.get("email"),
        "role": payload["role"],
        "token": token
    }

@router.post("/auth/google")
async def google_auth(req: GoogleAuthRequest):
    # Mock de autenticación Google para DynamoDB
    items = await db.scan_table("users")
    user = next((u for u in items if u.get("email") == req.email), None)
    
    if not user:
        # Crear usuario si no existe
        user_id = str(uuid.uuid4())
        user = {
            "PK": f"USER#{user_id}",
            "SK": "PROFILE",
            "id": user_id,
            "nombre": req.nombre,
            "email": req.email,
            "role": "superadmin" if req.email.lower() in SUPERADMIN_EMAILS else "usuario",
            "created_at": datetime.now().isoformat()
        }
        await db.put_item("users", user)
    
    payload = {
        "user_id": user.get("id", user.get("PK")),
        "role": user.get("role"),
        "entity_id": user.get("active_entity_id", "e0")
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return {
        "id": payload["user_id"],
        "nombre": user.get("nombre"),
        "email": user.get("email"),
        "role": user.get("role"),
        "token": token,
        "isNew": False # Simplificado







@router.get("/users")
async def get_users(entidad_id: str | None = None, user: dict = Depends(get_current_user)):
    items = await db.scan_table("users")
    role = user.get("role")
    entity_id = user.get("entity_id")
    
    filtered = items
    if role == ADMIN_ROLE:
        filtered = [u for u in items if u.get("entity_id") == entity_id]
    elif entidad_id and role == SUPERADMIN_ROLE:
        filtered = [u for u in items if u.get("entity_id") == entidad_id]
        
    return filtered

@router.post("/users")
async def create_user(user: UserCreate, current_user: dict = Depends(get_current_user)):
    user_id = str(uuid.uuid4())
    new_user = {
        "PK": f"USER#{user_id}",
        "SK": "PROFILE",
        "id": user_id,
        "nombre": user.nombre,
        "apellido": user.apellido,
        "email": user.email,
        "username": user.username,
        "role": user.perfil,
        "entity_id": user.entidadId,
        "is_activated": False,
        "ia_disponible": user.iaDisponible or False,
        "created_at": datetime.now().isoformat()
    }
    await db.put_item("users", new_user)
    return new_user











    















async def update_user(user_id: str, user: UserUpdate, current_user: dict = Depends(get_current_user)):
    # Simulación de actualización en DynamoDB
    existing = await db.get_item("users", f"USER#{user_id}", "PROFILE")
    if not existing:
        raise HTTPException(404, "Usuario no encontrado")
    
    update_data = {**existing}
    if user.nombre is not None: update_data["nombre"] = user.nombre
    if user.apellido is not None: update_data["apellido"] = user.apellido
    if user.estado is not None: update_data["estado"] = user.estado
    if user.perfil is not None: update_data["role"] = user.perfil
    if user.iaDisponible is not None: update_data["ia_disponible"] = user.iaDisponible
    
    await db.put_item("users", update_data)
    return update_data


            


@router.post("/admin/promote")
async def promote_user(target_user_id: str, new_role: str, current_user: dict = Depends(get_current_user)):
    """Endpoint dedicado y protegido para el cambio de roles por un Super Admin"""
    require_super_admin(current_user)
    if not supabase_client: raise HTTPException(400, "No Supabase")
    
    if new_role not in [SUPERADMIN_ROLE, ADMIN_ROLE, DEFAULT_ROLE]:
        raise HTTPException(400, "Rol no reconocido")
        


    res = await db.scan_table("users") 
    user = next((u for u in res if u.get("id") == target_user_id), None)
    if not user:
        raise HTTPException(404, "Usuario no encontrado")
    
    user["role"] = new_role
    await db.put_item("users", user)
    return {"status": "success", "message": f"Rol actualizado a {new_role}", "user": user}

@router.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user: dict = Depends(get_current_user)):
    # En DynamoDB, borramos por PK/SK
    await db.delete_item("users", f"USER#{user_id}", "PROFILE")
    return {"status": "success", "message": "Usuario eliminado correctamente"}

        


@router.get("/entities")
async def get_entities():
    # Admin scan of entities table
    items = await db.scan_table("entities")
    mapped = []
    for e in items:
        mapped.append({
            "id": e.get("id"), "razonSocial": e.get("razon_social"), "nit": e.get("nit"),
            "email": e.get("email"), "pais": e.get("pais", "Colombia"), "estado": e.get("estado")
        })
    return mapped

@router.post("/analyze-trd")
async def analyze_trd(background_tasks: BackgroundTasks, file: UploadFile = File(...), entidad_id: str = Form(""), user: dict = Depends(get_current_user)):
    content = await file.read()
    safe_name = file.filename.replace(' ', '_').replace('/', '_')
    filename_clean = f"{int(datetime.now().timestamp())}_{safe_name}"
    
    # Upload to S3
    entidad_final = entidad_id if entidad_id and entidad_id != "null" else user.get("entity_id")
    file_url = await s3_storage.upload_file(content, filename_clean, f"imports/{entidad_final}")
    
    doc_id = str(uuid.uuid4())
    metadata = {
        "source": file.filename, 
        "status": "processing", 
        "file_url": file_url, 
        "entidad_id": entidad_final, 
        "type": "temp_trd_session",
        "created_at": datetime.now().isoformat()
    }
    
    await db.put_item("rag_documents", {
        "PK": f"ENTITY#{entidad_final}",
        "SK": f"RAG#{doc_id}",
        "id": doc_id,
        "content": f"Import Session Snapshot: {file.filename}",
        "metadata": metadata
    })
    
    background_tasks.add_task(process_ocr_task, doc_id, content, file.filename)
    background_tasks.add_task(index_document_rag, doc_id, content, file.filename, entidad_final, file_url)
    
    return {"id": doc_id, "status": "processing", "import_id": doc_id}


@router.get("/rag-documents")
async def get_rag_documents(entidad_id: str = None, user: dict = Depends(get_current_user)):
    entidad = entidad_id or (None if user.get("role") == "superadmin" else user.get("entity_id"))
    
    if not entidad:
        items = await db.scan_table("rag_documents")
    else:
        items = await db.query_by_entity("rag_documents", entidad, sk_prefix="RAG#")
    
    output = []
    for item in items:
        meta = item.get("metadata") or {}
        if meta.get("type") != "temp_trd_session": continue
        if meta.get("status") == "success": continue
            
        output.append({
            "id": item.get("id"),
            "filename": meta.get("source", "Documento sin nombre"),
            "metadata": meta,
            "status": meta.get("status", "processing"),
            "created_at": item.get("created_at", meta.get("created_at"))
        })
    return output

@router.delete("/rag-documents/{doc_id}")
async def delete_rag_document(doc_id: str, user: dict = Depends(get_current_user)):
    entity_id = user.get("entity_id")
    





        


    





        
    await db.delete_item("rag_documents", f"ENTITY#{entity_id}", f"RAG#{doc_id}")
    return {"status": "success", "message": f"Documento {doc_id} eliminado correctamente."}

@router.put("/rag-documents/{doc_id}")
async def update_rag_document_status(doc_id: str, payload: dict, user: dict = Depends(get_current_user)):
    entity_id = user.get("entity_id")
    pk, sk = f"ENTITY#{entity_id}", f"RAG#{doc_id}"
    
    item = await db.get_item("rag_documents", pk, sk)
    if not item:
        raise HTTPException(404, "Documento no encontrado")
        
    meta = item.get("metadata") or {}
    new_status = payload.get("status", meta.get("status", "pending"))
    meta["status"] = new_status
    if new_status == "success":
        meta["type"] = "trd_upload"
        
    await db.update_item("rag_documents", pk, sk, {"metadata": meta})
    return {"status": "success", "new_status": new_status}


    
@router.post("/invitations")
async def create_invitation(req: InvitationCreate, current_user: dict = Depends(get_current_user)):
    inv_id = str(uuid.uuid4())
    target_email = req.email.strip().lower()
    
    invitation = {
        "PK": f"INVITATION#{target_email}",
        "SK": f"ENTITY#{req.entity_id}",
        "id": inv_id,
        "email": target_email,
        "entity_id": req.entity_id,
        "role_invited": req.roleInvited,
        "status": "pendiente",
        "inviter_id": current_user.get("user_id"),
        "created_at": datetime.now().isoformat(),
        "expires_at": (datetime.now() + timedelta(days=7)).isoformat()
    }
    
    await db.put_item("invitations", invitation)
    
# --- CLEANING UP LEGACY ---
def legacy_invitation_cleanup():
    pass

async def create_invitation(req: InvitationCreate, current_user: dict = Depends(get_current_user)):


    












    # 2. Verificar si el usuario ya pertenece a esa entidad

    # Necesitamos saber el ID del perfil para el mail

    















    entity_name = "una entidad de OSE IA"
    try:
        entity_item = await db.get_item("entities", f"ENTITY#{req.entity_id}", "METADATA")
        if entity_item:
            entity_name = entity_item.get("razon_social", entity_name)
    except: pass
    
    inviter_name = current_user.get("nombre", "Un administrador")
    frontend_url = "https://ose-new.vercel.app" # Cambiar por variable de entorno si aplica
    invite_link = f"{frontend_url}/?invitation_id={inv_id}&email={target_email}"

    if RESEND_API_KEY:
        try:
            # HTML content simplified for summary, but would be the full one
            html_content = f"<h1>Hola!</h1><p>{inviter_name} te ha invitado a {entity_name}.</p><a href='{invite_link}'>Aceptar Invitación</a>"
            async with httpx.AsyncClient() as client:
                res_email = await client.post(
                    "https://api.resend.com/emails",
                    headers={"Authorization": f"Bearer {RESEND_API_KEY}", "Content-Type": "application/json"},
                    json={
                        "from": RESEND_FROM_EMAIL,
                        "to": [target_email],
                        "subject": f"Invitacion a {entity_name} - OSE IA",
                        "html": html_content
                    }
                )
        except Exception as e:
            print(f"Error enviando mail de invitacion: {e}")



    return {"status": "success", "message": "Invitación enviada", "id": inv_id}

@router.get("/invitations/my")
async def get_my_invitations(current_user: dict = Depends(get_current_user)):
    """Lista las invitaciones recibidas por el usuario logueado en DynamoDB"""
    email = current_user.get("email", "").lower()
    if not email: return []
    
    items = await db.query_by_entity("invitations", email, pk_prefix="INVITATION#")
    return items



















@router.get("/invitations/sent")
async def get_sent_invitations(entity_id: str | None = None, archived: bool = False, current_user: dict = Depends(get_current_user)):
    """Lista las invitaciones enviadas (Vista Administrador)"""

    if current_user.get("role") not in (SUPERADMIN_ROLE, ADMIN_ROLE, "admin"):
        raise HTTPException(403, "Permisos insuficientes")

    
    # Aplicar filtro de archivado























    res = await db.scan_table("invitations")
    
    # Filter by entity
    target_id = entity_id or current_user.get("entity_id")
    if current_user.get("role") != SUPERADMIN_ROLE and target_id != current_user.get("entity_id"):
        raise HTTPException(403, "No tienes permisos de administrador en esta entidad")
        
    filtered = [i for i in res if i.get("archived", False) == archived]
    if target_id:
        filtered = [i for i in filtered if i.get("entity_id") == target_id]
        
    return sorted(filtered, key=lambda x: x.get("created_at", ""), reverse=True)

@router.delete("/invitations/{inv_id}")
async def cancel_invitation(inv_id: str, current_user: dict = Depends(get_current_user)):








    res = await db.scan_table("invitations")
    invitation = next((i for i in res if i.get("id") == inv_id), None)
    
    if not invitation:
        raise HTTPException(404, "Invitación no encontrada")
        
    invitation["status"] = "cancelada"
    await db.put_item("invitations", invitation)
    return {"status": "success", "message": "Invitacion cancelada"}

@router.post("/invitations/{inv_id}/resend")
async def resend_invitation(inv_id: str, current_user: dict = Depends(get_current_user)):








    new_expiry = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
    res = await db.scan_table("invitations")
    invitation = next((i for i in res if i.get("id") == inv_id), None)
    
    if not invitation:
        raise HTTPException(404, "Invitación no encontrada")
        
    new_expiry = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
    invitation["expires_at"] = new_expiry
    invitation["status"] = "pendiente"
    
    await db.put_item("invitations", invitation)
    return {"status": "success", "message": "Invitacion reenviada correctamente"}

@router.post("/invitations/{inv_id}/respond")
async def respond_invitation(inv_id: str, resp: InvitationRespond, current_user: dict = Depends(get_current_user)):

























    email = current_user.get("email", "").lower()
    # DynamoDB fetch
    res = await db.scan_table("invitations")
    invitation = next((i for i in res if i.get("id") == inv_id and i.get("email") == email), None)
    
    if not invitation:
        raise HTTPException(404, "Invitación no encontrada o no pertenece a este usuario")
        
    if invitation["status"] != "pendiente":
        raise HTTPException(400, f"Esta invitación ya ha sido {invitation['status']}")
        
    if resp.action == "accept":
        invitation["status"] = "aceptada"
        user_profile = await db.get_item("users", f"USER#{current_user.get('user_id')}", "PROFILE")
        if user_profile:
            user_profile["entity_id"] = invitation["entity_id"]
            user_profile["role"] = invitation.get("role_invited", "usuario")
            await db.put_item("users", user_profile)
    else:
        invitation["status"] = "rechazada"
        
    await db.put_item("invitations", invitation)
    return {"status": "success", "message": f"Invitación {invitation['status']}"}

@router.post("/activity-logs")
async def create_activity_log(req: ActivityLogCreate, current_user: dict = Depends(get_current_user)):


    log_id = str(uuid.uuid4())
    entity_id = current_user.get("entity_id")
    if not entity_id: return {"status": "error", "message": "No entity id"}
    
    log_item = {
        "PK": f"ENTITY#{entity_id}",
        "SK": f"LOG#{log_id}",
        "id": log_id,
        "user_name": req.user_name,
        "message": req.message,
        "created_at": datetime.now().isoformat()
    }
    await db.put_item("activity_logs", log_item)
    return [log_item]

@router.patch("/invitations/{inv_id}/archive")
async def archive_invitation(inv_id: str, req: InvitationArchive, current_user: dict = Depends(get_current_user)):
    """Archiva o desarchiva una invitación específica."""

    
    # Verificar permiso sobre la invitación



    







    # DynamoDB fetch
    res = await db.scan_table("invitations")
    invitation = next((i for i in res if i.get("id") == inv_id), None)
    
    if not invitation:
        raise HTTPException(404, "Invitación no encontrada")
    
    invitation["archived"] = req.archived
    await db.put_item("invitations", invitation)
    return {"status": "ok", "archived": req.archived}

@router.post("/invitations/bulk-archive")
async def bulk_archive_invitations(req: InvitationBulkArchive, current_user: dict = Depends(get_current_user)):
    """Archiva múltiples invitaciones a la vez."""

    if not req.ids:
        return {"status": "ok", "count": 0}






            







    res = await db.scan_table("invitations")
    targets = [i for i in res if i.get("id") in req.ids]
    
    for t in targets:
        t["archived"] = req.archived
        await db.put_item("invitations", t)
        
    return {"status": "ok", "count": len(targets)}

@router.get("/activity-logs")
async def get_activity_logs(current_user: dict = Depends(get_current_user)):
    entity_id = current_user.get("entity_id")
    if not entity_id: return []
    items = await db.query_by_entity("activity_logs", entity_id, sk_prefix="LOG#")
    return sorted(items, key=lambda x: x.get("created_at", ""), reverse=True)

    


    # 2. Fetch logs only for the current month

        
    return res.data or []

@router.get("/activity-logs/export")
async def export_activity_logs(
    start_date: str, 
    end_date: str, 
    current_user: dict = Depends(get_current_user)
):
    """Returns activity logs within a specific date range for Excel export."""
    entity_id = current_user.get("entity_id")
    
    items = await db.query_by_entity("activity_logs", entity_id, sk_prefix="LOG#")
    

        
    filtered = [i for i in items if start_date <= i.get("created_at", "") <= end_date]
    if not filtered:
        raise HTTPException(status_code=404, detail="No se encontraron registros en el rango seleccionado")
        
    return filtered

@router.post("/auth/signup")
async def signup(req: UserSignUp):
    """Crea un nuevo usuario en AWS Cognito y DynamoDB."""
    email = req.email.strip().lower()
    new_user = {
        "PK": f"USER#{str(uuid.uuid4())}",
        "SK": "PROFILE",
        "nombre": req.nombre,
        "email": email,
        "role": "usuario",
        "created_at": datetime.now().isoformat()
    }
    await db.put_item("users", new_user)
    return {"status": "ok", "message": "Usuario registrado exitosamente"}

@router.get("/health-check")
async def health_check():
    return {"status": "ok", "message": "OSE Backend AWS Serverless ready"}

app.include_router(router)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)