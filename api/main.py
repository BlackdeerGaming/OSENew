import os
import re
import base64
from dotenv import load_dotenv

#  CRITICAL: Load env vars FIRST before any other imports that read os.getenv 
load_dotenv()

from fastapi import FastAPI, File, UploadFile, HTTPException, APIRouter, BackgroundTasks, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from .permissions import get_current_user, require_super_admin, require_entity_admin
JWT_SECRET = os.environ.get("JWT_SECRET", "ose-ia-secret-key-2024-standard")
JWT_ALGORITHM = "HS256"

# RBAC CONFIGURATION
SUPERADMIN_EMAILS = [email.strip().lower() for email in os.environ.get("SUPERADMIN_EMAILS", "superadmin@ose.com,ivandchaves@gmail.com").split(",") if email.strip()]
DEFAULT_ROLE = "usuario"
ADMIN_ROLE = "administrador"
SUPERADMIN_ROLE = "superadmin"

# ConfiguraciÃ³n Pinecone
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

#  Inicializar Supabase 

supabase_client: Client = None
if SUPABASE_URL and SUPABASE_SERVICE_KEY:
    try:
        supabase_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
        print(" Supabase conectado correctamente.")
    except Exception as e:
        print(f" Error conectando a Supabase: {e}")
else:
    print(" SUPABASE_URL o SUPABASE_SERVICE_KEY no configurados.")

#  Embeddings usando OpenAI-compatible (Pinecone Embeddings  OpenAI ada) 
# Usamos text-embedding-3-small de OpenAI via OpenRouter para los vectores
# Dimensin: 1536 (compatible con pgvector)
embeddings = None
if OPENROUTER_API_KEY:
    try:
        embeddings = OpenAIEmbeddings(
            model="text-embedding-3-small",
            openai_api_key=OPENROUTER_API_KEY,
            openai_api_base="https://openrouter.ai/api/v1",
        )
        print(" Embeddings (text-embedding-3-small via OpenRouter) listo.")
    except Exception as e:
        print(f" Error inicializando embeddings: {e}")

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

#  LLM 

llm = ChatOpenAI(
    model=OPENROUTER_MODEL,
    openai_api_key=OPENROUTER_API_KEY,
    openai_api_base="https://openrouter.ai/api/v1",
    temperature=0.1,
    max_tokens=4096,
    default_headers={
        "HTTP-Referer": "https://ose-ia.vercel.app",
        "X-Title": "OSE Copilot RAG"
    }
)

RAG_PROMPT = ChatPromptTemplate.from_messages([
    ("system", """Eres OSE Copilot, el asistente experto de la Biblioteca RAG de OSE IA.

REGLAS DE RESPUESTA:
1. Responde ÃšNICAMENTE basÃ¡ndote en el CONTEXTO DEL DOCUMENTO proporcionado abajo.
2. Si el contexto no tiene la respuesta o no hay documentos relevantes, responde obligatoriamente:
   "Lo siento, no encontrÃ© informaciÃ³n cargada en mi biblioteca que me permita responder esa pregunta de forma precisa."
3. NO inventes datos ni asumas informaciÃ³n que no estÃ© escrita en el contexto.
4. Responde con un tono profesional y servicial.

CONTEXTO DEL DOCUMENTO:
{context}
"""),
    ("human", "{question}")
])

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

async def process_ocr_task(doc_id: str, content: bytes, filename: str):
    print(f"âš™ï¸ Iniciando Background Task OCR para: {filename}")
    extracted_text = ""
    
    try:
        import fitz
        from datetime import datetime
        # Extraer texto de las primeras 20 pÃ¡ginas
        fitz_doc = fitz.open(stream=content, filetype="pdf")
        pages_to_process = min(len(fitz_doc), 20)
        for i in range(pages_to_process):
            extracted_text += f"\n--- PÃGINA {i+1} ---\n" + fitz_doc[i].get_text()
        fitz_doc.close()
    except Exception as e:
        print(f"âŒ Error leyendo archivo en segundo plano: {e}")
        supabase_client.table("rag_documents").update({
            "metadata": {"status": "error", "message": f"Error leyendo el archivo: {str(e)}"}
        }).eq("id", doc_id).execute()
        return

    # Obtener el file_url y entidad_id actuales de la sesiÃ³n
    file_url = None
    entidad_id = None
    try:
        row = supabase_client.table("rag_documents").select("metadata").eq("id", doc_id).execute()
        if row.data:
            file_url = row.data[0]["metadata"].get("file_url")
            entidad_id = row.data[0]["metadata"].get("entidad_id")
    except: pass

    try:
        # Generar metadata para el chunk consolidado
        doc_metadata = {
            "source": filename,
            "type": "trd_upload",
            "is_trd_internal": True,
            "status": "success",
            "extracted_at": str(datetime.now()),
            "pages": pages_to_process,
            "file_url": file_url,
            "entidad_id": entidad_id
        }
        
        # Generar embedding
        embedding_vector = None
        if embeddings:
            try:
                embedding_vector = embeddings.embed_query(extracted_text[:4000])
            except: pass

        # Insertar
        supabase_client.table("rag_documents").insert({
            "content": extracted_text,
            "metadata": doc_metadata,
            "embedding": embedding_vector
        }).execute()
        
        # Actualizar sesiÃ³n
        supabase_client.table("rag_documents").update({
            "metadata": {**doc_metadata, "status": "success"}
        }).eq("id", doc_id).execute()
        
        print(f"âœ… OCR exitoso para {filename}")
    except Exception as e:
        print(f"âŒ Error guardando OCR en RAG: {e}")

#  Endpoints 

router = APIRouter(prefix="/api")

# Import dedicated TRD routes with cloud sync and role checks
from .trd_routes import router as trd_router
app.include_router(trd_router)


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
async def upload_pdf(file: UploadFile = File(...), entidad_id: str = "", user: dict = Depends(get_current_user)):
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

    documents = []
    text_count = 0

    # Extraer texto con PyMuPDF
    try:
        fitz_doc = fitz.open(stream=content, filetype="pdf")
        for page_num_0, page in enumerate(fitz_doc):
            page_num = page_num_0 + 1
            raw_text = page.get_text()
            if raw_text:
                cleaned = clean_text(raw_text)
                if len(cleaned) > 30:
                    documents.append(Document(
                        page_content=cleaned,
                        metadata={
                            "page": page_num, 
                            "source": file.filename, 
                            "type": "text",
                            "entidad_id": entidad_final,
                            **({"file_url": file_url} if file_url else {})
                        }
                    ))
                    text_count += 1
        fitz_doc.close()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error leyendo el PDF: {str(e)}")

    if not documents:
        raise HTTPException(
            status_code=400,
            detail="No se pudo extraer texto del PDF. Puede ser una imagen escaneada sin capa de texto."
        )

    print(f" Pginas con texto extrado: {text_count}")

    # Chunking
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=2000,
        chunk_overlap=300,
        separators=["\n\n", "\n", ".", " ", ""],
    )
    chunks = splitter.split_documents(documents)
    print(f"  Chunks generados: {len(chunks)}")

    # Guardar en Supabase pgvector
    try:
        # Indexar en Supabase MANUALMENTE para evitar errores de LangChain/OpenRouter
        print(f" Preparando {len(chunks)} fragmentos para indexar...")
        
        batch_size = 25
        data_to_insert = []
        
        for i in range(0, len(chunks), batch_size):
            batch = chunks[i:i+batch_size]
            texts = [c.page_content for c in batch]
            
            # Embeddings con reintento por lote
            batch_embeddings = None
            for attempt in range(3):
                try:
                    batch_embeddings = embeddings.embed_documents(texts)
                    if batch_embeddings: break
                except Exception as e:
                    print(f" Reintento batch {i//batch_size + 1}, intento {attempt+1}: {e}")
                    if attempt == 2: raise Exception("No embedding data received during upload")
            
            for doc, emb in zip(batch, batch_embeddings):
                data_to_insert.append({
                    "content": doc.page_content,
                    "metadata": doc.metadata,
                    "embedding": emb
                })

        # Insercin directa en Supabase
        print(f" Insertando {len(data_to_insert)} registros en Supabase...")
        supabase_client.table("rag_documents").insert(data_to_insert).execute()

    except Exception as e:
        print(f" Error guardando en Supabase: {e}")
        raise HTTPException(status_code=500, detail=f"Error al indexar en la base de datos: {str(e)}")

    print(f" '{file.filename}' indexado en Supabase: {len(chunks)} chunks")
    return {
        "message": f"PDF '{file.filename}' procesado e indexado con xito",
        "chunks_created": len(chunks),
        "text_pages": text_count,
        "vector_store": "supabase_pgvector"
    }

@router.post("/chat")
async def chat(request: ChatRequest, user: dict = Depends(get_current_user)):
    if not supabase_client:
        raise HTTPException(status_code=503, detail="Supabase no estÃ¡ configurado.")

    print(f"\n --- CONSULTA DOCUMENCIO ---")
    print(f" Query: {request.query}")
    print(f" User Role: {user.get('role')}")

    if not embeddings or not llm:
        return {"answer": "Lo siento, los servicios de IA no estÃ¡n configurados correctamente. Por favor verifica las credenciales.", "sources": []}

    try:
        # 1. Generar embedding
        query_vector = None
        try:
            query_vector = embeddings.embed_query(request.query)
        except Exception as e:
            print(f" Error en embedding: {e}")
            return {"answer": "Tuve un inconveniente tcnico al procesar el sentido de tu pregunta. Por favor intenta de nuevo.", "sources": []}

        if not query_vector:
            return {"answer": "No pude procesar tu pregunta. Intenta redactarla de forma mÃ¡s sencilla.", "sources": []}

        # 2. Determinar entidad para filtro
        # Si es superadmin, no aplicamos filtro de entidad por defecto (permite ver todo)
        # excepto si se solicita una especÃ­fica.
        rol = user.get("role")
        if rol == "superadmin":
            entidad_actual = request.entidadId if request.entidadId and request.entidadId != "e0" else None
        else:
            entidad_actual = user.get("entity_id") or request.entidadId
        
        search_filter = {"entidad_id": entidad_actual} if entidad_actual else {}
        
        # 3. BÃºsqueda RPC
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
            return {"answer": "Lo siento, no encontrÃ© informaciÃ³n cargada en mi biblioteca que me permita responder esa pregunta de forma precisa.", "sources": []}

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
    """Genera un token de reseteo y envÃ­a el correo"""
    if not supabase_client: raise HTTPException(500, "Base de datos desconectada")
    
    target_email = request.email.strip().lower()
    
    # 1. Verificar si el usuario existe
    user_res = supabase_client.table("profiles").select("id, nombre").eq("email", target_email).execute()
    if not user_res.data:
        # Por seguridad no revelamos si existe o no, pero retornamos Ã©xito simulado si no existe
        return {"status": "ok", "message": "Si el correo estÃ¡ registrado, recibirÃ¡s un enlace de recuperaciÃ³n."}
    
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
                <h2 style="color: #00bfa5;">RecuperaciÃ³n de ContraseÃ±a</h2>
                <p>Hola {user['nombre']},</p>
                <p>Has solicitado restablecer tu contraseÃ±a en OSE IA. Haz clic en el siguiente botÃ³n para continuar:</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="{reset_link}" style="background-color: #00bfa5; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Restablecer ContraseÃ±a</a>
                </div>
                <p style="font-size: 12px; color: #777;">Si no solicitaste este cambio, puedes ignorar este correo. El enlace caducarÃ¡ en 1 hora.</p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                <p style="font-size: 10px; color: #aaa; text-align: center;">OSE IA â€¢ GestiÃ³n Documental Inteligente</p>
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

    return {"status": "ok", "message": "Si el correo estÃ¡ registrado, recibirÃ¡s un enlace de recuperaciÃ³n."}

@router.post("/perform-reset")
async def perform_reset(request: PerformResetRequest):
    """Valida el token y actualiza la contraseÃ±a"""
    if not supabase_client: raise HTTPException(500, "Base de datos desconectada")
    
    # 1. Buscar usuario por token
    now = int(datetime.now(timezone.utc).timestamp())
    res = supabase_client.table("profiles").select("*").eq("reset_token", request.token).execute()
    
    if not res.data:
        raise HTTPException(400, "El enlace de recuperaciÃ³n no es vÃ¡lido.")
    
    user = res.data[0]
    
    # 2. Verificar expiraciÃ³n
    if user.get("reset_token_expiry") and user["reset_token_expiry"] < now:
        raise HTTPException(400, "El enlace de recuperaciÃ³n ha expirado.")
        
    # 3. Actualizar contraseÃ±a y limpiar token
    supabase_client.table("profiles").update({
        "password": request.new_password,
        "reset_token": None,
        "reset_token_expiry": None
    }).eq("id", user["id"]).execute()
    
    return {"status": "success", "message": "Tu contraseÃ±a ha sido actualizada correctamente."}

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
    active_role = role_res.data[0]["role"] if role_res.data else user_data["perfil"]

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
        
        # Opcional: Si el email estÃ¡ en la whitelist y por alguna razÃ³n NO era superadmin, lo promovemos
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
        
        # Crear relacion con entidad por defecto tambiÃ©n en profile_entities
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
    require_entity_admin(current_user, user.entidadId or "e0")
    if not supabase_client: raise HTTPException(400, "No Supabase")
    
    # Asegurar que nuevos usuarios no se creen con roles altos por defecto via API abierta
    # Solo superadmin puede crear otros superadmins
    final_perfil = user.perfil
    if final_perfil in [SUPERADMIN_ROLE, ADMIN_ROLE] and current_user.get("role") != SUPERADMIN_ROLE:
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
    
    # Validar permisos
    if current_user.get("role") != SUPERADMIN_ROLE and user_id != current_user.get("user_id"):
        # Si no es superadmin, solo puede editarse a s mismo (y no su rol)
        # O si es admin de entidad podrÃ­a ser permitido pero con restricciones
        # Por ahora: Solo superadmin o auto-ediciÃ³n bÃ¡sica
        pass

    data = {}
    if user.nombre is not None: data["nombre"] = user.nombre
    if user.apellido is not None: data["apellido"] = user.apellido
    if user.estado is not None: data["estado"] = user.estado
    
    # SEGURIDAD: Solo superadmin puede cambiar el perfil (rol)
    if user.perfil is not None:
        if current_user.get("role") == SUPERADMIN_ROLE:
            data["perfil"] = user.perfil
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
        if role != ADMIN_ROLE:
            raise HTTPException(403, "No tienes permisos suficentes para realizar esta acciÃ³n")
        if not admin_entity_id:
            raise HTTPException(403, "No perteneces a ninguna entidad activa")
        if str(target_user_entity) != str(admin_entity_id):
            raise HTTPException(403, "No puedes eliminar usuarios de otras entidades")

    # 2. Limpiar dependencias (Claves ForÃ¡neas) de forma segura
    cleanup_tables = [
        ("profile_entities", "profile_id"),
        ("activity_logs", "user_id"),
        ("chat_history", "user_id")
    ]
    
    for table_name, column_name in cleanup_tables:
        try:
            supabase_client.table(table_name).delete().eq(column_name, user_id).execute()
        except Exception as e:
            # Ignorar si la tabla no existe o hay error de cachÃ© de esquema
            print(f"  Aviso: No se pudo limpiar {table_name}: {e}")

    try:
        # 3. Borrar el perfil principal
        res = supabase_client.table("profiles").delete().eq("id", user_id).execute()
        
        if not res.data:
             # Si llegamos aquÃ­ y no hay data, algo fallÃ³ en la query de borrado silenciosamente
             raise HTTPException(500, "No se pudo confirmar la eliminaciÃ³n del usuario")
             
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
async def analyze_trd(background_tasks: BackgroundTasks, file: UploadFile = File(...), entidad_id: str = "", user: dict = Depends(get_current_user)):
    if not supabase_client: raise HTTPException(503)
    content = await file.read()
    filename_clean = f"{datetime.now().timestamp()}_{file.filename.replace(' ', '_')}"
    supabase_client.storage.from_("trd-uploads").upload(filename_clean, content, {"content-type": "application/pdf"})
    file_url = supabase_client.storage.from_("trd-uploads").get_public_url(filename_clean)
    entidad_final = user.get("entity_id") if user.get("role") == ADMIN_ROLE else entidad_id
    res = supabase_client.table("rag_documents").insert({
        "content": "Import Session Snapshot",
        "metadata": {
            "source": file.filename, "status": "processing", "file_url": file_url, "entidad_id": entidad_final, "type": "temp_trd_session"
        }
    }).execute()
    doc_id = res.data[0]["id"]
    background_tasks.add_task(process_ocr_task, doc_id, content, file.filename)
    return {"id": doc_id, "status": "processing"}

@router.get("/rag-documents")
async def get_rag_documents(entidad_id: str = None, user: dict = Depends(get_current_user)):
    if not supabase_client: return []
    
    query = supabase_client.table("rag_documents").select("id, metadata, created_at")
    
    # Aplicar filtro por entidad si no es superadmin
    if user.get("role") != "superadmin":
        entidad = entidad_id or user.get("entity_id")
        if entidad:
            query = query.contains("metadata", {"entidad_id": entidad})
    
    res = query.order("created_at", desc=False).execute()
    seen_sources = {}
    for row in res.data:
        meta = row.get("metadata") or {}
        source = meta.get("source", "")
        if not source: continue
        
        # Si ya lo vimos, intentamos enriquecer la metadata (especialmente file_url)
        if source in seen_sources:
            current = seen_sources[source]["metadata"]
            if not current.get("file_url") and meta.get("file_url"):
                current["file_url"] = meta["file_url"]
            if not current.get("entidad_id") and meta.get("entidad_id"):
                current["entidad_id"] = meta["entidad_id"]
            # Si el nuevo registro tiene Ã©xito, preferimos su status
            if meta.get("status") == "success":
                current["status"] = "success"
        else:
            # Documentos vÃ¡lidos para mostrar: success o sesiones activas para admins
            is_valid = meta.get("status") == "success" or (user.get("role") == "superadmin" and meta.get("type") == "temp_trd_session")
            if is_valid:
                seen_sources[source] = {
                    "id": row["id"], 
                    "filename": meta.get("label") or source, 
                    "metadata": meta, 
                    "created_at": row["created_at"]
                }
                
    return sorted(seen_sources.values(), key=lambda d: d["created_at"], reverse=True)

@router.delete("/rag-documents/{doc_id}")
async def delete_rag_document(doc_id: str):
    if not supabase_client: raise HTTPException(503)
    res = supabase_client.table("rag_documents").select("metadata").eq("id", doc_id).execute()
    if res.data:
        source = res.data[0].get("metadata", {}).get("source")
        if source: supabase_client.table("rag_documents").delete().contains("metadata", {"source": source}).execute()
    return {"status": "deleted"}
    
@router.post("/invitations")
async def create_invitation(req: InvitationCreate, current_user: dict = Depends(get_current_user)):
    """Crea una invitaciÃ³n para un usuario (existente o no) a una entidad"""
    if not supabase_client: raise HTTPException(500, "Base de datos desconectada")
    
    # 1. Validar permisos: Solo admin de la entidad o superadmin
    user_role = current_user.get("role")
    target_entity_id = str(req.entity_id or "")

    if user_role != SUPERADMIN_ROLE:
        # VerificaciÃ³n dinÃ¡mica: Â¿Es admin de esta entidad especÃ­fica?
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
        # Si ya estÃ¡ en profile_entities para esta entidad, error
        is_member = any(r["profile_id"] == p_id for r in check_member.data)
        if is_member:
            raise HTTPException(400, "El usuario ya es miembro de esta entidad")

    # 3. Verificar si hay una invitaciÃ³n pendiente activa
    check_existing = supabase_client.table("invitations").select("*").eq("email", target_email).eq("entity_id", req.entity_id).eq("status", "pendiente").execute()
    if check_existing.data:
        # Verificar expiraciÃ³n
        inv = check_existing.data[0]
        expires_at_dt = datetime.fromisoformat(inv["expires_at"].replace('Z', '+00:00'))
        if expires_at_dt > datetime.now(timezone.utc):
             raise HTTPException(400, "Ya existe una invitaciÃ³n pendiente y activa para este correo")

    # 4. Crear la invitaciÃ³n (expira en 1 dÃ­a)
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
        raise HTTPException(500, "No se pudo crear la invitaciÃ³n")
    
    invitation = res.data[0]
    
    # 5. Intentar enviar correo real vÃ­a Resend
    entity_res = supabase_client.table("entities").select("razon_social").eq("id", req.entity_id).execute()
    entity_name = entity_res.data[0]["razon_social"] if entity_res.data else "una entidad de OSE IA"
    inviter_name = current_user.get("nombre", "Un administrador")
    invitation_id = invitation["id"]
    
    # URL de la aplicaciÃ³n con contexto de invitaciÃ³n
    frontend_url = "https://ose-new.vercel.app" # Cambiar por variable de entorno si aplica
    invite_link = f"{frontend_url}/?invitation_id={invitation_id}&email={target_email}"

    if RESEND_API_KEY:
        try:
            html_content = f"""
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Invitaci&#243;n a OSE IA</title>
            </head>
            <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed;">
                <tr>
                  <td align="center" style="padding: 40px 20px;">
                    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
                      <!-- Header Color Bar -->
                      <tr><td height="8" style="background: linear-gradient(90deg, #00bfa5, #009688); line-height: 8px; font-size: 8px;">&nbsp;</td></tr>
                      
                      <tr>
                        <td style="padding: 40px 50px;">
                          <div style="text-align: center; margin-bottom: 30px;">
                             <h1 style="color: #0f172a; font-size: 14px; text-transform: uppercase; letter-spacing: 2px; margin: 0; font-weight: 800;">OSE IA</h1>
                          </div>
                          
                          <h2 style="color: #0f172a; font-size: 28px; font-weight: 800; line-height: 36px; margin: 0 0 20px 0; text-align: center; letter-spacing: -0.02em;">
                            Colaboraci&#243;n Pendiente
                          </h2>
                          
                          <p style="color: #64748b; font-size: 16px; line-height: 26px; margin: 0 0 30px 0; text-align: center;">
                            Hola, <strong>{inviter_name}</strong> te ha invitado a formar parte de su equipo de trabajo en la plataforma oficial.
                          </p>

                          <!-- Invitation Card -->
                          <div style="background-color: #f1f5f9; border-radius: 16px; padding: 25px; margin-bottom: 35px; border: 1px solid #e2e8f0;">
                            <table width="100%" border="0" cellspacing="0" cellpadding="0">
                              <tr>
                                <td style="padding-bottom: 15px;">
                                  <span style="color: #94a3b8; font-size: 11px; text-transform: uppercase; font-weight: 800; letter-spacing: 1px;">Entidad</span><br>
                                  <span style="color: #0f172a; font-size: 16px; font-weight: 700;">{entity_name}</span>
                                </td>
                              </tr>
                              <tr>
                                <td>
                                  <span style="color: #94a3b8; font-size: 11px; text-transform: uppercase; font-weight: 800; letter-spacing: 1px;">Tu Rol</span><br>
                                  <span style="color: #0f172a; font-size: 16px; font-weight: 700;">{req.role.capitalize()}</span>
                                </td>
                              </tr>
                            </table>
                          </div>

                          <div style="text-align: center; margin-bottom: 35px;">
                            <a href="{invite_link}" style="background-color: #00bfa5; color: #ffffff; display: inline-block; font-size: 14px; font-weight: 800; line-height: 20px; padding: 18px 40px; text-align: center; text-decoration: none; border-radius: 14px; text-transform: uppercase; letter-spacing: 1px; box-shadow: 0 10px 15px rgba(0,191,165,0.2);">
                              Aceptar Invitaci&#243;n
                            </a>
                          </div>

                          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 30px 0;">
                          
                          <p style="color: #94a3b8; font-size: 12px; line-height: 20px; margin: 0; text-align: center;">
                            <strong>Nota para usuarios nuevos:</strong> Si no tienes una cuenta, este enlace te guiar&#225; gratis al registro. Al terminar, tu invitaci&#243;n estar&#225; lista para ser aceptada.<br><br>
                            Esta invitaci&#243;n es v&#225;lida por 24 horas.
                          </p>
                        </td>
                      </tr>
                      
                      <tr>
                        <td style="padding: 20px 50px 40px 50px; background-color: #f8fafc; text-align: center;">
                          <p style="color: #94a3b8; font-size: 11px; margin: 0;">
                            &#169; 2024 OSE IA &#8226; Gesti&#243;n Documental Inteligente<br>
                            Este es un correo autom&#225;tico, por favor no respondas.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </body>
            </html>
            """
            async with httpx.AsyncClient() as client:
                res = await client.post(
                    "https://api.resend.com/emails",
                    headers={"Authorization": f"Bearer {RESEND_API_KEY}", "Content-Type": "application/json"},
                    json={
                        "from": "onboarding@resend.dev",
                        "to": [target_email],
                        "subject": f"Invitacion a {entity_name}",
                        "html": html_content
                    }
                )
                print(f"DEBUG Email Invitation status: {res.status_code}")
        except Exception as e:
            print(f" Error enviando mail de invitaciÃ³n: {e}")

    return {"status": "success", "message": "InvitaciÃ³n enviada", "invitation": invitation}

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
            supabase_client.table("profiles").update({"entidad_id": invitation["entity_id"]}).eq("id", current_user.get("user_id")).execute()
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
        "entidad_id": invitation["entity_id"] if invitation else None
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
        "perfil": new_profile["perfil"],
        "estado": new_profile["estado"],
        "isActivated": new_profile["is_activated"],
        "entidadId": new_profile["entidad_id"],
        "entidadIds": user_entidades,
        "token": f"USER-{user_id}"
    }

@router.get("/health-check")
async def health_check():
    return {"status": "ok", "message": "OSE Backend + Supabase ready"}

app.include_router(router)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)