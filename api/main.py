import os
import re
import base64
from dotenv import load_dotenv

#  CRITICAL: Load env vars FIRST before any other imports that read os.getenv 
load_dotenv()

from fastapi import FastAPI, File, UploadFile, HTTPException, APIRouter, BackgroundTasks, Depends, Request, Form
from fastapi.middleware.cors import CORSMiddleware
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
from langchain_community.vectorstores import SupabaseVectorStore
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough
from langchain_core.messages import HumanMessage, SystemMessage
from supabase import create_client, Client
import json
import uuid
from datetime import datetime, timedelta, timezone
#  Configuracin 

OPENROUTER_API_KEY  = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_MODEL    = os.getenv("OPENROUTER_MODEL", "google/gemini-2.0-flash-001")
SUPABASE_URL        = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
IMAGE_MIN_SIZE      = 8000  # bytes
RESEND_API_KEY      = os.getenv("RESEND_API_KEY")

#  Inicializar Servicios compartidos (Supabase, LLM, Embeddings)
from .db import supabase_client, llm, embeddings

#  FastAPI App 

app = FastAPI(title="RAG PDF Backend - OSE Copilot + Supabase")

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
    ("system", """Eres OSE Copilot, el asistente experto de la Biblioteca RAG de OSE IA.

REGLAS DE RESPUESTA:
1. Responde ÃƒÅ¡NICAMENTE basÃƒÂ¡ndote en el CONTEXTO DEL DOCUMENTO proporcionado abajo.
2. Si el contexto no tiene la respuesta o no hay documentos relevantes, responde obligatoriamente:
   "Lo siento, no encontrÃƒÂ© informaciÃƒÂ³n cargada en mi biblioteca que me permita responder esa pregunta de forma precisa."
3. NO inventes datos ni asumas informaciÃƒÂ³n que no estÃƒÂ© escrita en el contexto.
4. Responde con un tono profesional y servicial.

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

class ActivityLogCreate(BaseModel):
    message: str
    user_name: str
    # Opcional: mensajes personalizados, etc.

class InvitationRespond(BaseModel):
    action: str # 'accept' o 'reject'

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

async def index_document_rag(doc_id: str, content: bytes, filename: str, entidad: str, file_url: str):
    """
    Background Task: Extrae texto, realiza chunking y envía vectores a Supabase PgVector.
    Se ejecuta de forma asíncrona y captura todas las excepciones para no romper el proceso principal.
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
            print("RAG BACKGROUND: No se extrajo texto útil para vectorizar.")
            return
            
        print(f"RAG BACKGROUND: Texto extraído correctamente. Troceando...")
        text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
        docs = text_splitter.create_documents([cleaned_text])
        
        # Añadir metadata vital para la Búsqueda Vectorial por Entidad
        for i, doc in enumerate(docs):
            doc.metadata = {
                "source": filename,
                "chunk": i,
                "entidad_id": entidad or "",
                "file_url": file_url or "",
                "type": "rag_chunk"
            }
            
        print(f"RAG BACKGROUND: Insertando {len(docs)} chunks en PgVector...")
        vector_store = SupabaseVectorStore(
            embedding=embeddings,
            client=supabase_client,
            table_name="rag_documents",
            query_name="match_rag_documents"
        )
        # Se ejecuta en un hilo separado para no bloquear el Event Loop de FastAPI
        await asyncio.to_thread(vector_store.add_documents, docs)
        
        print(f"RAG BACKGROUND: ✨ Éxito indexando {filename} de manera asíncrona.")
    except Exception as e:
        print(f"RAG BACKGROUND ERROR: ⚠️ Falló la indexación silenciosamente -> {e}")

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

    system_prompt = f"""Eres Orianna (Agente OSE), una asistente experta y ultra-precisa en la gestin de Tablas de Retencin Documental (TRD) bajo la Ley 594 de 2000 (Colombia).

TU MISIN:
Debes interpretar la intencin del usuario para realizar:
1. CONSULTAS ESTRUCTURALES: Responder preguntas sobre dependencias, series y subseries existentes.
2. OPERACIONES CRUD: Crear, editar o eliminar elementos de la estructura organizativa y documental.

CONOCIMIENTO ACTUAL (Contexto):
- Entidades: {json.dumps(ents, ensure_ascii=False)}
- Dependencias (Oficinas): {json.dumps(deps, ensure_ascii=False)}
- Series: {json.dumps(series, ensure_ascii=False)}
- Subseries: {json.dumps(subs, ensure_ascii=False)}
- TRDs: {json.dumps(trds, ensure_ascii=False)}

REGLAS DE ORO DE ORIANNA:
1. PRESERVACIN DE NOMBRES: Los nombres de dependencias o series pueden ser largos (ej: "Seccin de Archivo y Gestin Ambiental"). DEBES identificar el nombre EXACTO y completo. No lo resumas.
2. VALIDACIN OBLIGATORIA (CRTICO):
   - PARA SERIES: Antes de crear (CREATE), DEBES tener el nombre de la dependencia y el cdigo de la serie. Si falta, detn la accin y pregunta: "Para qu dependencia es la serie y qu cdigo tendr?"
   - PARA SUBSERIES: Antes de crear (CREATE), DEBES tener el nombre de la dependencia, el nombre de la serie y el cdigo de la subserie. Si falta, detn la accin y pregunta: "Para qu dependencia, cul serie y qu cdigo tendr la subserie?"
   - NO ASUMAS DATOS: Si falta informacin obligatoria, devuelve "actions": [] e "intent": "QUERY" con el mensaje de solicitud de datos.
3. DETECCIN DE INTENCIN: 
   - Si el usuario pregunta "Qu series tiene..." o "Cules son...", devuelve un mensaje claro con la lista obtenida del contexto.
   - Si el usuario ordena "Crea...", "Edita...", genera el objeto 'actions' correspondiente siempre que los datos estn completos.
4. JERARQUA AUTOMTICA: Si te piden crear una estructura jerrquica (ej: "3 dependencias con 3 hijas"), genera mltiples acciones CREATE con IDs temporales (t1, t2...) para enlazar padres e hijos.
5. MODO CONSULTA (QUERY): Si el usuario solo pregunta informacin o si faltan datos para una accin, devuelve "actions": [] y la respuesta en "message".

FORMATO DE PAYLOADS:
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
    """Recupera el historial de chat privado para un usuario y asistente especfico."""
    if not supabase_client: raise HTTPException(status_code=503)
    user_id = user.get("user_id")
    if not user_id: raise HTTPException(status_code=401, detail="No user ID found in token")
    
    try:
        res = supabase_client.table("chat_history").select("messages").eq("user_id", user_id).eq("assistant", assistant).execute()
        if res.data:
            return {"messages": res.data[0].get("messages", [])}
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
                        "from": "onboarding@resend.dev",
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

@router.post("/request-reset")
async def request_reset(request: PasswordResetRequest):
    """Genera un token de reseteo y envÃƒÂ­a el correo"""
    if not supabase_client: raise HTTPException(500, "Base de datos desconectada")
    
    target_email = request.email.strip().lower()
    
    # 1. Verificar si el usuario existe
    user_res = supabase_client.table("profiles").select("id, nombre").eq("email", target_email).execute()
    if not user_res.data:
        # Por seguridad no revelamos si existe o no, pero retornamos ÃƒÂ©xito simulado si no existe
        return {"status": "ok", "message": "Si el correo estÃƒÂ¡ registrado, recibirÃƒÂ¡s un enlace de recuperaciÃƒÂ³n."}
    
    user = user_res.data[0]
    token = str(uuid.uuid4())
    expiry = int((datetime.now(timezone.utc) + timedelta(hours=1)).timestamp())
    
    # 2. Guardar token en DB
    supabase_client.table("profiles").update({
        "reset_token": token,
        "reset_token_expiry": expiry
    }).eq("id", user["id"]).execute()
    
    # 3. Enviar correo
    if RESEND_API_KEY:
        reset_link = f"https://ose-new.vercel.app/?reset_token={token}"
        html_content = f"""
        <html>
        <body style="font-family: Arial, sans-serif; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                <h2 style="color: #00bfa5;">RecuperaciÃƒÂ³n de ContraseÃƒÂ±a</h2>
                <p>Hola {user['nombre']},</p>
                <p>Has solicitado restablecer tu contraseÃƒÂ±a en OSE IA. Haz clic en el siguiente botÃƒÂ³n para continuar:</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="{reset_link}" style="background-color: #00bfa5; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Restablecer ContraseÃƒÂ±a</a>
                </div>
                <p style="font-size: 12px; color: #777;">Si no solicitaste este cambio, puedes ignorar este correo. El enlace caducarÃƒÂ¡ en 1 hora.</p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                <p style="font-size: 10px; color: #aaa; text-align: center;">OSE IA Ã¢â‚¬Â¢ GestiÃƒÂ³n Documental Inteligente</p>
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
                        "from": "OSE IA <onboarding@resend.dev>",
                        "to": [target_email],
                        "subject": "Recuperar contrasena - OSE IA",
                        "html": html_content
                    }
                )
                print(f"DEBUG Email Reset status: {res.status_code}")
        except Exception as e:
            print(f"Error enviando correo de reset: {e}")

    return {"status": "ok", "message": "Si el correo estÃƒÂ¡ registrado, recibirÃƒÂ¡s un enlace de recuperaciÃƒÂ³n."}

@router.post("/perform-reset")
async def perform_reset(request: PerformResetRequest):
    """Valida el token y actualiza la contraseÃƒÂ±a"""
    if not supabase_client: raise HTTPException(500, "Base de datos desconectada")
    
    # 1. Buscar usuario por token
    now = int(datetime.now(timezone.utc).timestamp())
    res = supabase_client.table("profiles").select("*").eq("reset_token", request.token).execute()
    
    if not res.data:
        raise HTTPException(400, "El enlace de recuperaciÃƒÂ³n no es vÃƒÂ¡lido.")
    
    user = res.data[0]
    
    # 2. Verificar expiraciÃƒÂ³n
    if user.get("reset_token_expiry") and user["reset_token_expiry"] < now:
        raise HTTPException(400, "El enlace de recuperaciÃƒÂ³n ha expirado.")
        
    # 3. Actualizar contraseÃƒÂ±a y limpiar token
    supabase_client.table("profiles").update({
        "password": request.new_password,
        "reset_token": None,
        "reset_token_expiry": None
    }).eq("id", user["id"]).execute()
    
    return {"status": "success", "message": "Tu contraseÃƒÂ±a ha sido actualizada correctamente."}

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
            "is_activated": True,
            "estado": "Activo",
            "activation_token": None,
            "token_expiry": None
        }).eq("id", user_data["id"]).execute()
        
        return {"status": "success", "message": "Cuenta activada correctamente."}
    except Exception as e:
        print(f" Error activando usuario: {e}")
        raise HTTPException(500, f"Error interno: {str(e)}")

@router.post("/login")
async def login(req: LoginRequest):
    if not supabase_client: raise HTTPException(500, "Error de conexin a la base de datos")
    res = supabase_client.table("profiles").select("*").or_(f"email.eq.{req.identifier},username.eq.{req.identifier}").execute()
    if not res.data: raise HTTPException(401, "El usuario no existe")
    user_data = res.data[0]
    if not user_data.get("is_activated"): raise HTTPException(401, "Esta cuenta an no ha sido activada")
    if user_data.get("password") != req.password: raise HTTPException(401, "Contrasea incorrecta")
    entities_res = supabase_client.table("profile_entities").select("entity_id").eq("profile_id", user_data["id"]).execute()
    entidad_ids = [e["entity_id"] for e in entities_res.data]
    active_entity_id = str(user_data.get("entidad_id") or (entidad_ids[0] if entidad_ids else "e0"))
    
    # Obtener el rol especÃ­fico para esta entidad de la tabla de uniÃ³n
    role_res = supabase_client.table("profile_entities").select("role").eq("profile_id", user_data["id"]).eq("entity_id", active_entity_id).execute()
    entity_role = (role_res.data[0]["role"] if role_res.data else user_data["perfil"]) or "usuario"
    
    # --- LOGICA DE HERENCIA Y PRIORIDAD ---
    # Si el perfil global es administrador o superadmin, debe prevalecer sobre el rol de la entidad si este es menor.
    perfil_global = str(user_data.get("perfil", "usuario")).lower()
    active_role = entity_role
    
    if perfil_global in ("superadmin", "administrador") and str(entity_role).lower() == "usuario":
        active_role = perfil_global

    payload = {
        "user_id": str(user_data["id"]),
        "role": active_role,
        "entity_id": active_entity_id
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return {
        "id": user_data["id"],
        "nombre": user_data["nombre"],
        "email": user_data["email"],
        "role": user_data["perfil"],
        "entidadId": user_data.get("entidad_id"),
        "entidadIds": entidad_ids,
        "token": token
    }

@router.post("/auth/google")
async def google_auth(req: GoogleAuthRequest):
    if not supabase_client: raise HTTPException(500, "Error de conexin a la base de datos")
    
    # 1. Buscar si el usuario ya existe por email
    res = supabase_client.table("profiles").select("*").eq("email", req.email).execute()
    
    user_data = None
    is_new = False
    
    if res.data:
        # 1.1 El usuario ya existe, conservamos sus datos y su ROL ORIGINAL
        user_data = res.data[0]
        print(f" Usuario Google encontrado: {req.email} (Rol actual: {user_data['perfil']})")
        
        # Opcional: Si el email estÃƒÂ¡ en la whitelist y por alguna razÃƒÂ³n NO era superadmin, lo promovemos
        if req.email.lower() in SUPERADMIN_EMAILS and user_data["perfil"] != SUPERADMIN_ROLE:
            print(f" Promoviendo usuario existente a SuperAdmin via Whitelist: {req.email}")
            update_res = supabase_client.table("profiles").update({"perfil": SUPERADMIN_ROLE}).eq("id", user_data["id"]).execute()
            if update_res.data:
                user_data = update_res.data[0]
    else:
        # 2. El usuario no existe, lo creamos
        print(f" Creando nuevo usuario via Google: {req.email}")
        is_new = True
        
        # 2.1 Determinar rol inicial (Whitelist vs Default)
        initial_role = DEFAULT_ROLE
        if req.email.lower() in SUPERADMIN_EMAILS:
            print(f" Asignando rol SuperAdmin via Whitelist a nuevo usuario: {req.email}")
            initial_role = SUPERADMIN_ROLE
            
        # Generar un username unico basado en el email
        username = req.email.split('@')[0]
        unique_check = supabase_client.table("profiles").select("id").eq("username", username).execute()
        if unique_check.data:
            username = f"{username}_{int(time.time())}"
            
        new_user_payload = {
            "nombre": req.nombre,
            "apellido": req.apellido or "",
            "email": req.email,
            "username": username,
            "perfil": initial_role,
            "estado": "Activo",
            "is_activated": True,
            "entidad_id": "e0",
            "created_at": datetime.now().isoformat()
        }
        
        create_res = supabase_client.table("profiles").insert(new_user_payload).execute()
        if not create_res.data:
            raise HTTPException(500, "Error al crear el perfil de usuario")
        user_data = create_res.data[0]
        
        # Crear relacion con entidad por defecto tambiÃƒÂ©n en profile_entities
        supabase_client.table("profile_entities").insert({
            "profile_id": user_data["id"],
            "entity_id": "e0"
        }).execute()

    # 3. Obtener entidades asociadas
    entities_res = supabase_client.table("profile_entities").select("entity_id").eq("profile_id", user_data["id"]).execute()
    entidad_ids = [e["entity_id"] for e in entities_res.data]
    
    # 4. Generar el JWT del sistema
    # IMPORTANTE: Mapear el rol de la DB al rol que entiende el frontend si es necesario
    # Aunque el sistema parece usar los strings de la DB directamente en el token
    payload = {
        "user_id": str(user_data["id"]),
        "role": user_data["perfil"],
        "entity_id": str(user_data.get("entidad_id") or (entidad_ids[0] if entidad_ids else "e0"))
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    
    return {
        "id": user_data["id"],
        "nombre": user_data["nombre"],
        "email": user_data["email"],
        "role": user_data["perfil"],
        "entidadId": user_data.get("entidad_id") or "e0",
        "entidadIds": entidad_ids,
        "token": token,
        "isNew": is_new
    }

@router.get("/users")
async def get_users(entidad_id: str | None = None, user: dict = Depends(get_current_user)):
    if not supabase_client: return []
    query = supabase_client.table("profiles").select("*")
    role = user.get("role")
    
    if role == ADMIN_ROLE:
        # Administradores solo ven usuarios de su propia entidad
        query = query.eq("entidad_id", user.get("entity_id"))
    elif entidad_id and role == SUPERADMIN_ROLE:
        # Superadmin puede filtrar por entidad si lo desea
        query = query.eq("entidad_id", entidad_id)
    res = query.execute()
    rel_res = supabase_client.table("profile_entities").select("*").execute()
    rels = {}
    for r in rel_res.data:
        p_id = r["profile_id"]
        if p_id not in rels: rels[p_id] = []
        rels[p_id].append(r["entity_id"])
    mapped = []
    for u in res.data:
        mapped.append({
            "id": u["id"], "nombre": u["nombre"], "apellido": u["apellido"], "email": u["email"],
            "username": u["username"], "perfil": u["perfil"], "estado": u["estado"],
            "isActivated": u["is_activated"], "entidadId": u["entidad_id"],
            "entidadIds": rels.get(u["id"], []),
            "iaDisponible": u.get("ia_disponible", False)
        })
    return mapped

@router.post("/users")
async def create_user(user: UserCreate, current_user: dict = Depends(get_current_user)):
    # Validar permisos: Solo admin de la entidad o superadmin
    if current_user.get("role") != SUPERADMIN_ROLE:
        admin_check = supabase_client.table("profile_entities").select("role").eq("profile_id", current_user.get("user_id")).eq("entity_id", user.entidadId).execute()
        if not admin_check.data or admin_check.data[0]["role"] not in (ADMIN_ROLE, "admin", "superadmin"):
             raise HTTPException(403, "No tienes permisos de administrador en esta entidad")
    if not supabase_client: raise HTTPException(400, "No Supabase")
    
    # Asegurar que nuevos usuarios no se creen con roles altos por defecto via API abierta
    # Solo superadmin puede crear otros superadmins
    final_perfil = user.perfil
    if final_perfil == SUPERADMIN_ROLE and current_user.get("role") != SUPERADMIN_ROLE:
        final_perfil = DEFAULT_ROLE

    data = {
        "nombre": user.nombre, "apellido": user.apellido, "email": user.email, "username": user.username,
        "perfil": final_perfil, "entidad_id": user.entidadId, "activation_token": user.activationToken,
        "token_expiry": user.tokenExpiry, "ia_disponible": user.iaDisponible or False
    }
    res = supabase_client.table("profiles").insert(data).execute()
    new_user = res.data[0]
    if user.entidadIds:
        rels = [{"profile_id": new_user["id"], "entity_id": e_id} for e_id in user.entidadIds]
        supabase_client.table("profile_entities").insert(rels).execute()
    return new_user

@router.put("/users/{user_id}")
async def update_user(user_id: str, user: UserUpdate, current_user: dict = Depends(get_current_user)):
    if not supabase_client: raise HTTPException(400, "No Supabase")
    
    # Obtener info actual del usuario destino para validar entidad
    target_res = supabase_client.table("profiles").select("entidad_id").eq("id", user_id).execute()
    if not target_res.data:
        raise HTTPException(404, "Usuario no encontrado")
    target_entity_id = target_res.data[0].get("entidad_id")
    
    # Validar permisos
    if current_user.get("role") != SUPERADMIN_ROLE and user_id != current_user.get("user_id"):
        # Admin solo puede editar usuarios de entidades donde sea administrador
        admin_check = supabase_client.table("profile_entities").select("role").eq("profile_id", current_user.get("user_id")).eq("entity_id", target_entity_id).execute()
        if not admin_check.data or admin_check.data[0]["role"] not in (ADMIN_ROLE, "admin", "superadmin"):
             raise HTTPException(403, "No autorizado para editar usuarios de esta entidad o perfil insuficiente")

    data = {}
    if user.nombre is not None: data["nombre"] = user.nombre
    if user.apellido is not None: data["apellido"] = user.apellido
    if user.estado is not None: data["estado"] = user.estado
    
    # SEGURIDAD: Superadmin asigna cualquier rol. Admin de entidad puede cambiar roles EXCEPTO a superadmin.
    if user.perfil is not None:
        if current_user.get("role") == SUPERADMIN_ROLE:
            data["perfil"] = user.perfil
        elif current_user.get("role") == ADMIN_ROLE and user_id != current_user.get("user_id"):
            if user.perfil != SUPERADMIN_ROLE:
                data["perfil"] = user.perfil
            else:
                data["perfil"] = DEFAULT_ROLE
        elif user_id == current_user.get("user_id") and user.perfil != current_user.get("role"):
            print(f" Intento de auto-cambio de rol bloqueado para usuario: {user_id}")
        else:
            print(f" Intento de cambio de rol bloqueado para usuario: {current_user.get('user_id')}")

    if user.entidadId is not None: data["entidad_id"] = user.entidadId
    if user.isActivated is not None: data["is_activated"] = user.isActivated
    if user.iaDisponible is not None: data["ia_disponible"] = user.iaDisponible
    
    res = supabase_client.table("profiles").update(data).eq("id", user_id).execute()
    
    if user.entidadIds is not None and current_user.get("role") == SUPERADMIN_ROLE:
        supabase_client.table("profile_entities").delete().eq("profile_id", user_id).execute()
        if user.entidadIds:
            rels = [{"profile_id": user_id, "entity_id": e_id} for e_id in user.entidadIds]
            supabase_client.table("profile_entities").insert(rels).execute()
            
    return res.data[0]

@router.post("/admin/promote")
async def promote_user(target_user_id: str, new_role: str, current_user: dict = Depends(get_current_user)):
    """Endpoint dedicado y protegido para el cambio de roles por un Super Admin"""
    require_super_admin(current_user)
    if not supabase_client: raise HTTPException(400, "No Supabase")
    
    if new_role not in [SUPERADMIN_ROLE, ADMIN_ROLE, DEFAULT_ROLE]:
        raise HTTPException(400, "Rol no reconocido")
        
    res = supabase_client.table("profiles").update({"perfil": new_role}).eq("id", target_user_id).execute()
    if not res.data:
        raise HTTPException(404, "Usuario no encontrado")
        
    return {"status": "success", "message": f"Rol actualizado a {new_role}", "user": res.data[0]}

@router.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user: dict = Depends(get_current_user)):
    if not supabase_client: raise HTTPException(400, "No Supabase")
    
    role = current_user.get("role")
    admin_entity_id = current_user.get("entity_id")
    
    # 1. Verificar existencia y pertenencia antes de borrar si es Admin
    user_res = supabase_client.table("profiles").select("entidad_id").eq("id", user_id).execute()
    if not user_res.data:
        raise HTTPException(404, "El usuario que intentas eliminar no existe")
    
    target_user_entity = user_res.data[0].get("entidad_id")
    
    if role != SUPERADMIN_ROLE:
        # Si no es superadmin, debe ser admin de la entidad del usuario destino
        admin_check = supabase_client.table("profile_entities").select("role").eq("profile_id", current_user.get("user_id")).eq("entity_id", target_user_entity).execute()
        if not admin_check.data or admin_check.data[0]["role"] not in (ADMIN_ROLE, "admin", "superadmin"):
             raise HTTPException(403, "No tienes permisos de administrador en la entidad del usuario destino")

    # 2. Limpiar dependencias (Claves ForÃƒÂ¡neas) de forma segura
    cleanup_tables = [
        ("profile_entities", "profile_id"),
        ("activity_logs", "user_id"),
        ("chat_history", "user_id")
    ]
    
    for table_name, column_name in cleanup_tables:
        try:
            supabase_client.table(table_name).delete().eq(column_name, user_id).execute()
        except Exception as e:
            # Ignorar si la tabla no existe o hay error de cachÃƒÂ© de esquema
            print(f"  Aviso: No se pudo limpiar {table_name}: {e}")

    try:
        # 3. Borrar el perfil principal
        res = supabase_client.table("profiles").delete().eq("id", user_id).execute()
        
        if not res.data:
             # Si llegamos aquÃƒÂ­ y no hay data, algo fallÃƒÂ³ en la query de borrado silenciosamente
             raise HTTPException(500, "No se pudo confirmar la eliminaciÃƒÂ³n del usuario")
             
    except Exception as e:
        print(f" Error eliminando perfil {user_id}: {str(e)}")
        raise HTTPException(500, f"Error de base de datos al eliminar perfil: {str(e)}")
        
    return {"status": "success", "message": "Usuario y sus relaciones eliminados correctamente"}

@router.get("/entities")
async def get_entities():
    if not supabase_client: return []
    res = supabase_client.table("entities").select("*").execute()
    mapped = []
    for e in res.data:
        mapped.append({
            "id": e["id"], "razonSocial": e["razon_social"], "nit": e["nit"],
            "email": e.get("email"), "pais": e["pais"], "estado": e["estado"]
        })
    return mapped

@router.post("/analyze-trd")
async def analyze_trd(background_tasks: BackgroundTasks, file: UploadFile = File(...), entidad_id: str = Form(""), user: dict = Depends(get_current_user)):
    if not supabase_client: raise HTTPException(503)
    content = await file.read()
    
    # Asegurar que el filename sea seguro para Storage
    safe_name = file.filename.replace(' ', '_').replace('/', '_')
    filename_clean = f"{int(datetime.now().timestamp())}_{safe_name}"
    
    supabase_client.storage.from_("trd-uploads").upload(filename_clean, content, {"content-type": "application/pdf"})
    file_url = supabase_client.storage.from_("trd-uploads").get_public_url(filename_clean)
    
    # Lógica de entidad: si es Admin usa su entidad, si es SuperAdmin usa la del form o la activa
    entidad_final = entidad_id if entidad_id and entidad_id != "null" else user.get("entity_id")
    
    res = supabase_client.table("rag_documents").insert({
        "content": f"Import Session Snapshot: {file.filename}",
        "metadata": {
            "source": file.filename, 
            "status": "processing", 
            "file_url": file_url, 
            "entidad_id": entidad_final, 
            "type": "temp_trd_session",
            "created_at": datetime.now().isoformat()
        }
    }).execute()
    
    if not res.data:
        raise HTTPException(500, detail="No se pudo crear la sesión de importación")
        
    doc_id = res.data[0]["id"]
    
    # Iniciar procesos paralelos en segundo plano
    # 1. OCR para aprobación inmediata (Prioridad Máxima del Sistema)
    background_tasks.add_task(process_ocr_task, doc_id, content, file.filename)
    
    # 2. RAG Indexing en background (Proceso Secundario y no bloqueante)
    background_tasks.add_task(index_document_rag, doc_id, content, file.filename, entidad_final, file_url)
    
    return {"id": doc_id, "status": "processing", "import_id": doc_id}


@router.get("/rag-documents")
async def get_rag_documents(entidad_id: str = None, user: dict = Depends(get_current_user)):
    if not supabase_client: return []
    
    # FILTRO ESTRICTO: solo sesiones de importación TRD (no chunks de texto RAG)
    query = supabase_client.table("rag_documents").select("id, metadata, created_at") \
        .contains("metadata", {"type": "temp_trd_session"})
    
    # Aplicar filtro por entidad
    entidad = entidad_id or (None if user.get("role") == "superadmin" else user.get("entity_id"))
    if entidad:
        query = query.contains("metadata", {"entidad_id": entidad})
    
    res = query.order("created_at", desc=True).execute()
    
    output = []
    for row in (res.data or []):
        meta = row.get("metadata") or {}
        # HIDE COMPLETED SESSIONS: Si ya fue exitosa, no la mostramos en la lista de importación activa
        if meta.get("status") == "success":
            continue
            
        output.append({
            "id": row["id"],
            "filename": meta.get("source", "Documento sin nombre"),
            "metadata": meta,
            "status": meta.get("status", "processing"),
            "created_at": row["created_at"]
        })
    
    return output

@router.delete("/rag-documents/{doc_id}")
async def delete_rag_document(doc_id: str, user: dict = Depends(get_current_user)):
    if not supabase_client: raise HTTPException(503)
    
    # Validar permisos
    res = supabase_client.table("rag_documents").select("metadata").eq("id", doc_id).execute()
    if not res.data:
        # Si no existe por ID, quizás ya se borró o es un error de ID
        return {"status": "deleted"}
        
    meta = res.data[0].get("metadata", {})
    source = meta.get("source")
    
    # Borrado en cascada por source (borra la sesión y el documento indexado)
    if source:
        supabase_client.table("rag_documents").delete().eq("metadata->>source", source).execute()
    else:
        supabase_client.table("rag_documents").delete().eq("id", doc_id).execute()
        
    return {"status": "success", "message": f"Documento {source or doc_id} eliminado correctamente."}

@router.put("/rag-documents/{doc_id}")
async def update_rag_document_status(doc_id: str, payload: dict, user: dict = Depends(get_current_user)):
    if not supabase_client: raise HTTPException(503)
    
    print(f" [RAG] Actualizando estado de documento {doc_id} a {payload.get('status')}")
    
    # Obtener metadata actual
    res = supabase_client.table("rag_documents").select("metadata").eq("id", doc_id).execute()
    if not res.data: 
        print(f" [RAG] Documento {doc_id} no encontrado en DB.")
        raise HTTPException(404, "Documento no encontrado o ID invÃ¡lido")
    
    meta = res.data[0].get("metadata") or {}
    new_status = payload.get("status", meta.get("status", "pending"))
    meta["status"] = new_status
    
    # Si se marca como Ã©xito, cambiamos el tipo de sesiÃ³n temporal a carga persistente
    if new_status == "success":
        meta["type"] = "trd_upload"
        
    try:
        supabase_client.table("rag_documents").update({"metadata": meta}).eq("id", doc_id).execute()
        return {"status": "success", "new_status": new_status}
    except Exception as e:
        print(f" [RAG] Error actualizando DB: {e}")
        raise HTTPException(500, f"Error DB: {str(e)}")


    
@router.post("/invitations")
async def create_invitation(req: InvitationCreate, current_user: dict = Depends(get_current_user)):
    """Crea una invitaciÃƒÂ³n para un usuario (existente o no) a una entidad"""
    if not supabase_client: raise HTTPException(500, "Base de datos desconectada")
    
    # 1. Validar permisos: Solo admin de la entidad o superadmin
    user_role = current_user.get("role")
    target_entity_id = str(req.entity_id or "")

    if user_role != SUPERADMIN_ROLE:
        # VerificaciÃƒÂ³n dinÃƒÂ¡mica: Ã‚Â¿Es admin de esta entidad especÃƒÂ­fica?
        admin_check = supabase_client.table("profile_entities").select("role").eq("profile_id", current_user.get("user_id")).eq("entity_id", target_entity_id).execute()
        if not admin_check.data or admin_check.data[0]["role"] not in (ADMIN_ROLE, "admin", "superadmin"):
             raise HTTPException(403, "No tienes permisos de administrador en esta entidad")

    target_email = req.email.strip().lower()

    # 2. Verificar si el usuario ya pertenece a esa entidad
    check_member = supabase_client.table("profile_entities").select("profile_id").eq("entity_id", req.entity_id).execute()
    # Necesitamos saber el ID del perfil para el mail
    check_profile = supabase_client.table("profiles").select("id").eq("email", target_email).execute()
    
    if check_profile.data:
        p_id = check_profile.data[0]["id"]
        # Si ya estÃƒÂ¡ en profile_entities para esta entidad, error
        is_member = any(r["profile_id"] == p_id for r in check_member.data)
        if is_member:
            raise HTTPException(400, "El usuario ya es miembro de esta entidad")

    # 3. Verificar si hay una invitaciÃƒÂ³n pendiente activa
    check_existing = supabase_client.table("invitations").select("*").eq("email", target_email).eq("entity_id", req.entity_id).eq("status", "pendiente").execute()
    if check_existing.data:
        # Verificar expiraciÃƒÂ³n
        inv = check_existing.data[0]
        expires_at_dt = datetime.fromisoformat(inv["expires_at"].replace('Z', '+00:00'))
        if expires_at_dt > datetime.now(timezone.utc):
             raise HTTPException(400, "Ya existe una invitaciÃƒÂ³n pendiente y activa para este correo")

    # 4. Crear la invitaciÃƒÂ³n (expira en 1 dÃƒÂ­a)
    expires_at = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
    inviter_id = current_user.get("user_id")
    
    new_inv = {
        "email": target_email,
        "entity_id": req.entity_id,
        "inviter_id": inviter_id,
        "role_invited": req.role,
        "status": "pendiente",
        "expires_at": expires_at
    }
    
    res = supabase_client.table("invitations").insert(new_inv).execute()
    if not res.data:
        raise HTTPException(500, "No se pudo crear la invitaciÃƒÂ³n")
    
    invitation = res.data[0]
    
    # Asignar IA disponible si el usuario ya existe
    if check_profile.data:
        p_id = check_profile.data[0]["id"]
        supabase_client.table("profiles").update({"ia_disponible": True}).eq("id", p_id).execute()
    
    # 5. Intentar enviar correo real vÃƒÂ­a Resend
    entity_res = supabase_client.table("entities").select("razon_social").eq("id", req.entity_id).execute()
    entity_name = entity_res.data[0]["razon_social"] if entity_res.data else "una entidad de OSE IA"
    inviter_name = current_user.get("nombre", "Un administrador")
    invitation_id = invitation["id"]
    
    # URL de la aplicaciÃƒÂ³n con contexto de invitaciÃƒÂ³n
    frontend_url = "https://ose-new.vercel.app" # Cambiar por variable de entorno si aplica
    invite_link = f"{frontend_url}/?invitation_id={invitation_id}&email={target_email}"

    if RESEND_API_KEY:
        try:
            html_content = (
                '<!DOCTYPE html>'
                '<html lang="es"><head>'
                '<meta charset="UTF-8">'
                '<meta name="viewport" content="width=device-width, initial-scale=1.0">'
                '<title>Invitacion OSE IA</title>'
                '</head>'
                '<body style="margin:0;padding:0;background-color:#f0f4f8;font-family:Arial,Helvetica,sans-serif;">'
                '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0f4f8;padding:40px 0;">'
                '<tr><td align="center">'
                '<table width="600" cellpadding="0" cellspacing="0" border="0" '
                'style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">'
                '<tr><td height="6" style="background:linear-gradient(90deg,#00bfa5,#0078d4);font-size:0;line-height:0;">&nbsp;</td></tr>'
                '<tr><td align="center" style="padding:32px 40px 12px;">'
                '<p style="margin:0;font-size:11px;font-weight:900;letter-spacing:4px;text-transform:uppercase;color:#94a3b8;">OSE IA</p>'
                '<p style="margin:4px 0 0;font-size:11px;color:#cbd5e1;">Gestion Documental Inteligente</p>'
                '</td></tr>'
                '<tr><td align="center" style="padding:16px 40px 8px;">'
                '<h1 style="margin:0;font-size:24px;font-weight:800;color:#0f172a;">Tienes una nueva invitacion</h1>'
                '</td></tr>'
                '<tr><td align="center" style="padding:8px 40px 24px;">'
                '<p style="margin:0;font-size:15px;color:#64748b;line-height:1.6;">'
            ) + (
                '<strong style="color:#0f172a;">' + inviter_name + '</strong>'
                ' te ha invitado a unirte a su equipo de trabajo en la plataforma OSE IA.'
                '</p></td></tr>'
                '<tr><td style="padding:0 40px 24px;">'
                '<table width="100%" cellpadding="0" cellspacing="0" border="0" '
                'style="background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;">'
                '<tr><td style="padding:20px 24px;">'
                '<table width="100%" cellpadding="0" cellspacing="0" border="0">'
                '<tr>'
                '<td width="50%" style="padding-bottom:14px;vertical-align:top;">'
                '<p style="margin:0;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;">Entidad</p>'
            ) + (
                '<p style="margin:4px 0 0;font-size:15px;font-weight:700;color:#0f172a;">' + entity_name + '</p>'
                '</td>'
                '<td width="50%" style="padding-bottom:14px;vertical-align:top;">'
                '<p style="margin:0;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;">Tu Rol</p>'
            ) + (
                '<p style="margin:4px 0 0;font-size:15px;font-weight:700;color:#00bfa5;">' + req.role.capitalize() + '</p>'
                '</td></tr>'
                '<tr><td colspan="2">'
                '<p style="margin:0;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;">Invitado por</p>'
            ) + (
                '<p style="margin:4px 0 0;font-size:14px;font-weight:600;color:#475569;">' + inviter_name + '</p>'
                '</td></tr></table></td></tr></table></td></tr>'
                '<tr><td align="center" style="padding:8px 40px 28px;">'
            ) + (
                '<a href="' + invite_link + '" '
                'style="display:inline-block;background-color:#00bfa5;color:#ffffff;'
                'font-size:13px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;'
                'text-decoration:none;padding:16px 40px;border-radius:10px;">'
                'Aceptar Invitacion'
                '</a>'
                '</td></tr>'
                '<tr><td align="center" style="padding:0 40px 16px;">'
                '<p style="margin:0;font-size:11px;color:#94a3b8;">Si el boton no funciona, copia este enlace:</p>'
            ) + (
                '<p style="margin:6px 0 0;font-size:11px;word-break:break-all;">'
                '<a href="' + invite_link + '" style="color:#00bfa5;">' + invite_link + '</a>'
                '</p></td></tr>'
                '<tr><td style="padding:0 40px;"><hr style="border:0;border-top:1px solid #e2e8f0;margin:0;"></td></tr>'
                '<tr><td align="center" style="padding:16px 40px;">'
                '<p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.6;">'
                '<strong>Usuarios nuevos:</strong> Si aun no tienes una cuenta, el enlace te guiara al registro. '
                'La invitacion se vinculara automaticamente al completar el registro.'
                '</p></td></tr>'
                '<tr><td align="center" style="padding:16px 40px 28px;background:#f8fafc;">'
                '<p style="margin:0;font-size:10px;color:#cbd5e1;">Esta invitacion vence en 24 horas &bull; No respondas este correo</p>'
                '<p style="margin:4px 0 0;font-size:10px;color:#cbd5e1;">&copy; 2024 OSE IA &bull; Gestion Documental Inteligente</p>'
                '</td></tr>'
                '</table></td></tr></table>'
                '</body></html>'
            )
            async with httpx.AsyncClient() as client:
                res_email = await client.post(
                    "https://api.resend.com/emails",
                    headers={"Authorization": f"Bearer {RESEND_API_KEY}", "Content-Type": "application/json"},
                    json={
                        "from": "OSE IA <onboarding@resend.dev>",
                        "to": [target_email],
                        "subject": f"Invitacion a {entity_name} - OSE IA",
                        "html": html_content
                    }
                )
                print(f"DEBUG Email Invitation status: {res_email.status_code} - {res_email.text[:200]}")
        except Exception as e:
            print(f"Error enviando mail de invitacion: {e}")
    return {"status": "success", "message": "InvitaciÃƒÂ³n enviada", "invitation": invitation}

@router.get("/invitations/my")
async def get_my_invitations(current_user: dict = Depends(get_current_user)):
    """Lista las invitaciones recibidas por el usuario logueado"""
    if not supabase_client: return []
    email = current_user.get("email", "").lower()
    if not email: return []
    res = supabase_client.table("invitations").select("*, entities(razon_social, sigla), profiles(nombre, apellido)").eq("email", email).eq("status", "pendiente").execute()
    now = datetime.now(timezone.utc)
    valid_invitations = []
    for inv in res.data:
        exp = datetime.fromisoformat(inv["expires_at"].replace('Z', '+00:00'))
        if exp > now:
            valid_invitations.append({
                "id": inv["id"],
                "entity_id": inv["entity_id"],
                "entity_name": inv.get("entities", {}).get("razon_social", "Entidad desconocida"),
                "inviter": f"{inv.get('profiles', {}).get('nombre', 'Admin')} {inv.get('profiles', {}).get('apellido', '')}",
                "created_at": inv["created_at"],
                "expires_at": inv["expires_at"]
            })
        else:
            if inv.get("status") != "vencida":
                supabase_client.table("invitations").update({"status": "vencida"}).eq("id", inv["id"]).execute()
    return valid_invitations

@router.get("/invitations/sent")
async def get_sent_invitations(entity_id: str | None = None, current_user: dict = Depends(get_current_user)):
    """Lista las invitaciones enviadas (Vista Administrador)"""
    if not supabase_client: return []
    if current_user.get("role") not in (SUPERADMIN_ROLE, ADMIN_ROLE, "admin"):
        raise HTTPException(403, "Permisos insuficientes")
    query = supabase_client.table("invitations").select("*, entities(razon_social, sigla), profiles(nombre, apellido)")
    if current_user.get("role") == SUPERADMIN_ROLE:
        if entity_id:
            query = query.eq("entity_id", entity_id)
    else:
        target_id = entity_id or current_user.get("entity_id")
        admin_check = supabase_client.table("profile_entities").select("role").eq("profile_id", current_user.get("user_id")).eq("entity_id", target_id).execute()
        if not admin_check.data or admin_check.data[0]["role"] not in (ADMIN_ROLE, "admin", "superadmin"):
            raise HTTPException(403, "No tienes permisos de administrador en esta entidad")
        query = query.eq("entity_id", target_id)
    res = query.order("created_at", desc=True).execute()
    return [{
        "id": inv["id"],
        "email": inv["email"],
        "entity_id": inv["entity_id"],
        "entity_name": inv.get("entities", {}).get("razon_social", "Entidad"),
        "role": inv.get("role_invited", "usuario"),
        "status": inv["status"],
        "created_at": inv["created_at"],
        "expires_at": inv["expires_at"],
        "inviter": f"{inv.get('profiles', {}).get('nombre', 'Admin')} {inv.get('profiles', {}).get('apellido', '')}"
    } for inv in res.data]

@router.delete("/invitations/{inv_id}")
async def cancel_invitation(inv_id: str, current_user: dict = Depends(get_current_user)):
    if not supabase_client: raise HTTPException(503)
    inv_res = supabase_client.table("invitations").select("entity_id").eq("id", inv_id).execute()
    if not inv_res.data: raise HTTPException(404, "No encontrada")
    target_entity_id = inv_res.data[0]["entity_id"]
    if current_user.get("role") != SUPERADMIN_ROLE:
        admin_check = supabase_client.table("profile_entities").select("role").eq("profile_id", current_user.get("user_id")).eq("entity_id", target_entity_id).execute()
        if not admin_check.data or admin_check.data[0]["role"] not in (ADMIN_ROLE, "admin", "superadmin"):
            raise HTTPException(403, "No tienes permisos para cancelar invitaciones de esta entidad")
    supabase_client.table("invitations").update({"status": "cancelada"}).eq("id", inv_id).execute()
    return {"status": "success", "message": "Invitacion cancelada"}

@router.post("/invitations/{inv_id}/resend")
async def resend_invitation(inv_id: str, current_user: dict = Depends(get_current_user)):
    if not supabase_client: raise HTTPException(503)
    inv_res = supabase_client.table("invitations").select("*").eq("id", inv_id).execute()
    if not inv_res.data: raise HTTPException(404, "Invitacion no encontrada")
    inv = inv_res.data[0]
    if current_user.get("role") != SUPERADMIN_ROLE:
        admin_check = supabase_client.table("profile_entities").select("role").eq("profile_id", current_user.get("user_id")).eq("entity_id", inv["entity_id"]).execute()
        if not admin_check.data or admin_check.data[0]["role"] not in (ADMIN_ROLE, "admin", "superadmin"):
            raise HTTPException(403, "No tienes permisos para reenviar invitaciones de esta entidad")
    new_expiry = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
    supabase_client.table("invitations").update({"expires_at": new_expiry, "status": "pendiente"}).eq("id", inv_id).execute()
    return {"status": "success", "message": "Invitacion reenviada correctamente"}

@router.post("/invitations/{inv_id}/respond")
async def respond_invitation(inv_id: str, resp: InvitationRespond, current_user: dict = Depends(get_current_user)):
    if not supabase_client: raise HTTPException(500)
    res = supabase_client.table("invitations").select("*").eq("id", inv_id).execute()
    if not res.data: raise HTTPException(404, "Invitacion no encontrada")
    invitation = res.data[0]
    if invitation["email"].lower() != current_user.get("email", "").lower():
        raise HTTPException(403, "Esta invitacion no es para ti")
    if invitation["status"] != "pendiente":
        raise HTTPException(400, f"Esta invitacion ya ha sido {invitation['status']}")
    if resp.action == "accept":
        try:
            supabase_client.table("profile_entities").upsert({
                "profile_id": current_user.get("user_id"),
                "entity_id": invitation["entity_id"],
                "role": invitation.get("role_invited", "usuario")
            }).execute()
            supabase_client.table("profiles").update({
                "entidad_id": invitation["entity_id"],
                "ia_disponible": True
            }).eq("id", current_user.get("user_id")).execute()
            supabase_client.table("invitations").update({"status": "aceptada"}).eq("id", inv_id).execute()
            return {"status": "success", "message": "Invitacion aceptada"}
        except Exception as e:
            raise HTTPException(500, f"Error al vincular entidad: {str(e)}")
    else:
        supabase_client.table("invitations").update({"status": "rechazada"}).eq("id", inv_id).execute()
        return {"status": "success", "message": "Invitacion rechazada."}

@router.post("/activity-logs")
async def create_activity_log(req: ActivityLogCreate, current_user: dict = Depends(get_current_user)):
    if not supabase_client: raise HTTPException(500, "Base de datos desconectada")
    res = supabase_client.table("activity_logs").insert({"user_name": req.user_name, "message": req.message}).execute()
    return res.data

@router.get("/activity-logs")
async def get_activity_logs(current_user: dict = Depends(get_current_user)):
    if not supabase_client: raise HTTPException(500, "Base de datos desconectada")
    res = supabase_client.table("activity_logs").select("*").order("created_at", desc=True).limit(50).execute()
    return res.data

@router.post("/auth/signup")
async def signup(req: UserSignUp):
    """Crea un nuevo perfil y vincula invitaciones si existen."""
    if not supabase_client: raise HTTPException(500, "Base de datos desconectada")
    email = req.email.strip().lower()
    username = req.username.strip().lower()
    existing = supabase_client.table("profiles").select("id").or_(f"email.eq.{email},username.eq.{username}").execute()
    if existing.data:
        raise HTTPException(400, "El correo electronico o nombre de usuario ya esta registrado.")
    inv_res = supabase_client.table("invitations").select("*").eq("email", email).eq("status", "pendiente").execute()
    invitation = inv_res.data[0] if inv_res.data else None
    new_profile = {
        "nombre": req.nombre,
        "apellido": req.apellido,
        "email": email,
        "username": username,
        "password": req.password,
        "perfil": "Consulta",
        "estado": "Activo" if invitation else "Inactivo",
        "is_activated": True if invitation else False,
        "entidad_id": invitation["entity_id"] if invitation else None,
        "ia_disponible": True if invitation else False
    }
    prof_insert = supabase_client.table("profiles").insert(new_profile).execute()
    if not prof_insert.data:
        raise HTTPException(500, "Error al crear el perfil.")
    user_id = prof_insert.data[0]["id"]
    user_entidades = []
    if invitation:
        role_invited = invitation.get("role_invited", "usuario")
        supabase_client.table("profile_entities").insert({
            "profile_id": user_id,
            "entity_id": invitation["entity_id"],
            "role": role_invited
        }).execute()
        supabase_client.table("invitations").update({"status": "aceptada"}).eq("id", invitation["id"]).execute()
        user_entidades.append(invitation["entity_id"])
    return {
        "id": user_id,
        "nombre": req.nombre,
        "apellido": req.apellido,
        "email": email,
        "username": username,
        "perfil": role_invited if invitation else "Consulta",
        "role": role_invited if invitation else "Consulta",
        "estado": new_profile["estado"],
        "isActivated": new_profile["is_activated"],
        "entidadId": invitation["entity_id"] if invitation else None,
        "entidadIds": user_entidades,
        "token": f"USER-{user_id}"
    }

@router.get("/health-check")
async def health_check():
    return {"status": "ok", "message": "OSE Backend + Supabase ready"}

app.include_router(router)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)