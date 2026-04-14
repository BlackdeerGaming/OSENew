import os
import re
import base64
from dotenv import load_dotenv

# ─── CRITICAL: Load env vars FIRST before any other imports that read os.getenv ─
load_dotenv()

from fastapi import FastAPI, File, UploadFile, HTTPException, APIRouter, BackgroundTasks, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from api.permissions import get_current_user, JWT_SECRET, JWT_ALGORITHM
import jwt
from pydantic import BaseModel
import uvicorn
import fitz  # PyMuPDF
import time
import httpx
import asyncio
from datetime import datetime

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

# ─── Configuración ────────────────────────────────────────────────────────────

OPENROUTER_API_KEY  = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_MODEL    = os.getenv("OPENROUTER_MODEL", "google/gemini-2.0-flash-001")
SUPABASE_URL        = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
IMAGE_MIN_SIZE      = 8000  # bytes
RESEND_API_KEY      = os.getenv("RESEND_API_KEY")

# ─── Inicializar Supabase ─────────────────────────────────────────────────────

supabase_client: Client = None
if SUPABASE_URL and SUPABASE_SERVICE_KEY:
    try:
        supabase_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
        print("✅ Supabase conectado correctamente.")
    except Exception as e:
        print(f"❌ Error conectando a Supabase: {e}")
else:
    print("⚠️ SUPABASE_URL o SUPABASE_SERVICE_KEY no configurados.")

# ─── Embeddings usando OpenAI-compatible (Pinecone Embeddings → OpenAI ada) ──
# Usamos text-embedding-3-small de OpenAI via OpenRouter para los vectores
# Dimensión: 1536 (compatible con pgvector)
embeddings = None
if OPENROUTER_API_KEY:
    try:
        embeddings = OpenAIEmbeddings(
            model="text-embedding-3-small",
            openai_api_key=OPENROUTER_API_KEY,
            openai_api_base="https://openrouter.ai/api/v1",
        )
        print("✅ Embeddings (text-embedding-3-small via OpenRouter) listo.")
    except Exception as e:
        print(f"❌ Error inicializando embeddings: {e}")

# ─── FastAPI App ──────────────────────────────────────────────────────────────

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
    print(f"📥 {request.method} {request.url.path}")
    response = await call_next(request)
    print(f"📤 {response.status_code}")
    return response

# ─── LLM ─────────────────────────────────────────────────────────────────────

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
    ("system", """Eres OSE Copilot, un asistente experto en gestión documental corporativa.

REGLAS ESTRICTAS:
1. Responde ÚNICAMENTE usando la información del CONTEXTO proporcionado.
2. Si el contexto no contiene información suficiente, di exactamente:
   "No encontré información suficiente en el documento para responder esta pregunta."
3. NO inventes datos, fechas, nombres ni cifras que no estén en el contexto.
4. Responde siempre en español, de forma clara y estructurada.

CONTEXTO DEL DOCUMENTO:
{context}"""),
    ("human", "{question}")
])

# ─── Helpers ─────────────────────────────────────────────────────────────────

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

class UserActivate(BaseModel):
    token: str
    password: str

class LoginRequest(BaseModel):
    identifier: str
    password: str
    activationToken: str | None = None
    tokenExpiry: int | None = None

class UserUpdate(BaseModel):
    nombre: str | None = None
    apellido: str | None = None
    estado: str | None = None
    perfil: str | None = None
    entidadId: str | None = None
    entidadIds: list[str] | None = None
    isActivated: bool | None = None
    iaDisponible: bool | None = None

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

def clean_text(text: str) -> str:
    text = re.sub(r'(?<!\n)\n(?!\n)', ' ', text)
    text = re.sub(r'\n{2,}', '\n', text)
    text = re.sub(r'^\s*\d+\s*$', '', text, flags=re.MULTILINE)
    text = re.sub(r'  +', ' ', text)
    return text.strip()

def format_docs(docs):
    return "\n\n---\n\n".join(doc.page_content for doc in docs)

# ─── Endpoints ────────────────────────────────────────────────────────────────

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
        print(f"❌ Error en rag-stat: {e}")
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
    Vision AI desactivada para evitar timeout de Vercel (10s límite).
    """
    if not supabase_client:
        raise HTTPException(status_code=503, detail="Supabase no está configurado en el servidor.")
    if embeddings is None:
        raise HTTPException(status_code=503, detail="El motor de embeddings no está disponible.")

    print(f"📥 POST /upload - File: {file.filename} - Type: {file.content_type}")

    # ── Deduplication check ──────────────────────────────────────────────────────
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
                detail=f"El documento '{file.filename}' ya existe en la Biblioteca RAG. Elimínalo primero si deseas reindexarlo."
            )
    except HTTPException:
        raise
    except Exception as dup_err:
        print(f"⚠️ Error en chequeo de duplicados: {dup_err}")  # No bloquear el flujo

    content = await file.read()
    print(f"📊 Tamaño recibido: {len(content) / (1024*1024):.2f} MB")

    # 1. Guardar el archivo original en Supabase Storage
    file_url = None
    try:
        bucket = "rag-uploads"
        # Limpiar nombre del archivo
        clean_filename = f"{int(time.time())}_{file.filename.replace(' ', '_')}"
        supabase_client.storage.from_(bucket).upload(clean_filename, content, {"content-type": "application/pdf"})
        file_url = supabase_client.storage.from_(bucket).get_public_url(clean_filename)
        print(f"☁️  PDF subido a Storage: {file_url}")
    except Exception as e:
        print(f"⚠️  Error subiendo PDF a Storage, se continuará con el RAG pero no habrá visor original: {e}")

    # Determinar entidad para el documento
    entidad_final = user.get("entity_id") if user.get("role") == "admin" else entidad_id

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

    print(f"📄 Páginas con texto extraído: {text_count}")

    # Chunking
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=2000,
        chunk_overlap=300,
        separators=["\n\n", "\n", ".", " ", ""],
    )
    chunks = splitter.split_documents(documents)
    print(f"✂️  Chunks generados: {len(chunks)}")

    # Guardar en Supabase pgvector
    try:
        # Indexar en Supabase MANUALMENTE para evitar errores de LangChain/OpenRouter
        print(f"📦 Preparando {len(chunks)} fragmentos para indexar...")
        
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
                    print(f"⚠️ Reintento batch {i//batch_size + 1}, intento {attempt+1}: {e}")
                    if attempt == 2: raise Exception("No embedding data received during upload")
            
            for doc, emb in zip(batch, batch_embeddings):
                data_to_insert.append({
                    "content": doc.page_content,
                    "metadata": doc.metadata,
                    "embedding": emb
                })

        # Inserción directa en Supabase
        print(f"📡 Insertando {len(data_to_insert)} registros en Supabase...")
        supabase_client.table("rag_documents").insert(data_to_insert).execute()

    except Exception as e:
        print(f"❌ Error guardando en Supabase: {e}")
        raise HTTPException(status_code=500, detail=f"Error al indexar en la base de datos: {str(e)}")

    print(f"✅ '{file.filename}' indexado en Supabase: {len(chunks)} chunks")
    return {
        "message": f"PDF '{file.filename}' procesado e indexado con éxito",
        "chunks_created": len(chunks),
        "text_pages": text_count,
        "vector_store": "supabase_pgvector"
    }

@router.post("/chat")
async def chat(request: ChatRequest, user: dict = Depends(get_current_user)):
    if not supabase_client:
        raise HTTPException(status_code=503, detail="Supabase no está configurado.")

    try:
        print(f"\n🔍 --- INICIO CONSULTA RAG ---")
        print(f"❓ Query: {request.query}")

        # 1. Generar embedding con reintento simple
        query_vector = None
        for attempt in range(3):
            try:
                query_vector = embeddings.embed_query(request.query)
                if query_vector: break
            except Exception as e:
                print(f"⚠️ Intento {attempt+1} fallido: {e}")
                if attempt == 2: raise e

        if not query_vector:
            print("❌ No se pudo generar el vector de búsqueda.")
            raise Exception("No embedding data received")
        
        print(f"✅ Embedding listo (Dim: {len(query_vector)})")

        # Determinar entidad para filtro
        entidad_actual = user.get("entity_id") if user.get("role") == "admin" else (request.entidadId or "")

        # 2. Búsqueda RPC
        print("📡 Consultando Supabase...")
        rpc_res = supabase_client.rpc("match_rag_documents", {
            "query_embedding": query_vector,
            "match_count": 5,
            "filter": {"entidad_id": entidad_actual} if entidad_actual else {}
        }).execute()

        source_docs = []
        if rpc_res.data:
            print(f"📊 Fragmentos encontrados: {len(rpc_res.data)}")
            source_docs = [
                Document(page_content=row["content"], metadata=row["metadata"])
                for row in rpc_res.data
                if row.get("metadata", {}).get("status") in (None, "success")
            ]
        else:
            print("⚠️ Supabase devolvió ZERO resultados.")

        # 3. Respuesta LLM
        print("🤖 Generando respuesta...")
        rag_chain = ( RAG_PROMPT | llm | StrOutputParser() )
        answer = rag_chain.invoke({
            "context": format_docs(source_docs),
            "question": request.query
        })
        
        print(f"✅ Chat finalizado con éxito.")
        pages = sorted(set(
            d.metadata.get("page")
            for d in source_docs
            if d.metadata.get("page") is not None
        ))

        return {"answer": answer, "sources": pages}

    except Exception as e:
        print(f"❌ Error en chat: {e}")
        raise HTTPException(status_code=500, detail=f"Error al consultar: {str(e)}")

@router.post("/generate-dependencias")
async def generate_dependencias(request: GenerateDepsRequest):
    system_prompt = """Eres un experto en gestión organizacional y diseño de estructuras administrativas. 
El usuario te dará una instrucción para crear dependencias. Debes extraer los nombres de las dependencias solicitadas, mantener EXACTAMENTE el orden en que las pidió, y rellenar la información faltante con datos simulados pero realistas y corporativos.

INSTRUCCIONES DE FORMATO:
Debes responder ESTRICTAMENTE con un arreglo de objetos JSON en el que cada objeto tenga esta estructura exacta (sin texto extra):
[
  {
    "nombre": "Nombre de la dependencia",
    "sigla": "Sigla en mayúsculas (2 a 4 letras)",
    "codigo": "Un número o código alfanumérico único",
    "pais": "Colombia",
    "departamento": "Cundinamarca",
    "ciudad": "Bogotá",
    "direccion": "Dirección realista en la ciudad",
    "telefono": "Número de teléfono ficticio realista",
    "dependeDe": "ninguna"
  }
]

Asegúrate de generar un objeto por cada dependencia solicitada en el prompt del usuario.
IMPORTANTE: RESPONDE SOLO CON EL JSON VÁLIDO. NO incluyas markdown (```json), etiquetas, saludos, explicaciones ni texto adicional."""

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
        print(f"❌ Error generando dependencias: {e}")
        raise HTTPException(status_code=500, detail=f"Error al generar dependencias: {str(e)}")

@router.post("/agent-action")
async def agent_action(request: AgentActionRequest):
    from langchain_core.messages import AIMessage

    deps = [{"id": d.get("id"), "nombre": d.get("nombre")} for d in request.context.dependencias]
    series = [{"id": s.get("id"), "nombre": s.get("nombre"), "dependenciaId": s.get("dependenciaId")} for s in request.context.series]
    subs = [{"id": s.get("id"), "nombre": s.get("nombre"), "serieId": s.get("serieId")} for s in request.context.subseries]
    trds = [{"id": t.get("id"), "dependencia_id": t.get("dependenciaId"), "serie_id": t.get("serieId")} for t in request.context.trdRecords]
    ents = [{"id": e.get("id"), "nombre": e.get("nombre") or e.get("razonSocial")} for e in request.context.entidades]

    system_prompt = f"""Eres el Agente OSE (Orianna IA), un orquestador inteligente del sistema de TRD (Tablas de Retención Documental) basado en la Ley 594 de 2000 (Colombia).
Tu objetivo es interpretar intenciones CRUD sobre la estructura: Dependencias -> Series -> Subseries -> Valoración TRD.

ESTADO ACTUAL DEL SISTEMA (Contexto):
- Entidades Disponibles (Usa la primera como default si creas algo): {json.dumps(ents, ensure_ascii=False)}
- Dependencias: {json.dumps(deps, ensure_ascii=False)}
- Series: {json.dumps(series, ensure_ascii=False)}
- Subseries: {json.dumps(subs, ensure_ascii=False)}
- Valoraciones TRD (Existen): {json.dumps(trds, ensure_ascii=False)}

REGLAS DE FORMATO DE PAYLOAD (OBLIGATORIO):

1. ENTIDAD 'dependencias':
   - nombre: string (obligatorio)
   - sigla: string (3-4 letras, ej: "DESP")
   - codigo: string (numérico, ej: "100")
   - pais: "Colombia"
   - departamento: string (ej: "Cundinamarca")
   - ciudad: string (ej: "Bogotá")
   - direccion: string
   - dependeDe: string (ID del padre o "ninguna")

2. ENTIDAD 'series':
   - dependenciaId: string (ID obligatorio)
   - nombre: string (obligatorio)
   - codigo: string (numérico, ej: "100-1")
   - tipoDocumental: string (lista separada por comas)

3. ENTIDAD 'subseries':
   - dependenciaId: string (ID obligatorio)
   - serieId: string (ID obligatorio)
   - nombre: string (obligatorio)
   - codigo: string (numérico, ej: "100-1-01")
   - tipoDocumental: string (lista separada por comas)

4. ENTIDAD 'trd_records' (VALORACIÓN - Requerido para ver en Tabla Final):
   - dependenciaId: string (ID obligatorio)
   - serieId: string (ID obligatorio)
   - subserieId: string (opcional)
   - retencionGestion: number (ej: 2)
   - retencionCentral: number (ej: 5)
   - disposicion: "CT" | "E" | "S" | "D"
   - procedimiento: string
   - ddhh: "Sí" | "No"
   - actoAdmo: string (ej: "Resolución 001 de 2024")

REGLAS DE RESPUESTA:
- Retorna ÚNICAMENTE JSON válido.
- SI EL USUARIO PIDE 'CREAR LA TRD': Debes crear Dependencia -> Serie -> Subserie (si aplica) -> Y OBLIGATORIAMENTE el 'trd_records' asociado para que los datos sean visibles en la Tabla Final.
- IMPORTANTE: Si una entidad (dependencia/serie) YA EXISTE en el contexto, USA SU ID REAL proporcionado arriba en lugar de un nombre para los campos parentales (ej: serieId, dependenciaId).
- Si creas un registro nuevo, INVENTA valores realistas para los campos obligatorios basado en el contexto.

ESTRUCTURA DEL JSON:
{{
  "message": "Tu respuesta amistosa y confirmación",
  "actions": [
    {{
      "type": "CREATE" | "UPDATE" | "DELETE",
      "entity": "dependencias" | "series" | "subseries" | "trd_records",
      "id": "ID real o temporal",
      "payload": {{ ... }}
    }}
  ]
}}

CRÍTICO:
- Si confirmas una creación/edición en 'message', DEBES incluir el objeto correspondiente en 'actions'.
- NO respondas solo con texto si el usuario pidió una acción.
- Usa IDs temporales (t1, t2...) para enlazar registros nuevos en una misma respuesta.
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
        print(f"❌ Error en agent-action: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/send-activation")
async def send_activation(request: ActivationEmailRequest):
    html_content = f"""
    <div style="background-color: #f8fafc; padding: 40px 20px; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <div style="max-width: 560px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); border: 1px solid #e2e8f0;">
            <div style="background-color: #0f172a; padding: 32px; text-align: center;">
                <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.025em;">OSE IA</h1>
                <p style="color: #94a3b8; margin: 8px 0 0 0; font-size: 14px;">Gestión Documental Inteligente</p>
            </div>
            <div style="padding: 40px 32px;">
                <h2 style="color: #1e293b; margin: 0 0 16px 0; font-size: 20px; font-weight: 600;">¡Hola, {request.nombre}!</h2>
                <p style="color: #475569; margin: 0 0 24px 0; font-size: 16px; line-height: 1.6;">
                    Has sido invitado a unirte a <strong>OSE IA</strong>. Nuestra plataforma utiliza inteligencia artificial para transformar la forma en que gestionas y consultas tu archivo documental.
                </p>
                <div style="background-color: #f1f5f9; border-radius: 8px; padding: 20px; margin-bottom: 32px; border-left: 4px solid #2563eb;">
                    <p style="color: #1e293b; margin: 0; font-size: 14px; line-height: 1.5;">
                        Para comenzar, es necesario que actives tu cuenta y definas una contraseña segura mediante el siguiente botón:
                    </p>
                </div>
                <div style="text-align: center; margin-bottom: 32px;">
                    <a href="{request.link}" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; transition: background-color 0.2s;">
                        Activar mi cuenta ahora
                    </a>
                </div>
                <p style="color: #64748b; margin: 0 0 8px 0; font-size: 13px;">
                    ¿Tienes problemas con el botón? Copia y pega este enlace:
                </p>
                <p style="background-color: #f8fafc; padding: 12px; border-radius: 6px; border: 1px solid #e2e8f0; font-size: 12px; color: #2563eb; margin: 0; word-break: break-all;">
                    {request.link}
                </p>
            </div>
            <div style="background-color: #f8fafc; padding: 24px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
                <p style="color: #94a3b8; margin: 0; font-size: 12px;">
                    Este enlace de invitación es único para ti y expirará en <strong>30 minutos</strong> automáticamente por motivos de seguridad.
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
                    print(f"❌ Error Resend ({res.status_code}): {res.text}")
                else:
                    print(f"✅ Email enviado exitosamente via Resend (ID: {res.json().get('id')})")
        except Exception as e:
            print(f"❌ Error enviando email: {e}")

    print(f"\n📧 [EMAIL ENVIADO] PARA: {request.email} | LINK: {request.link}\n")
    return {"status": "sent", "message": f"Email sent to {request.email}"}

@router.post("/request-reset")
async def request_reset(request: PasswordResetRequest):
    print(f"\n🔑 [MOCK RESET] PARA: {request.email}\n")
    return {"status": "ok", "message": "Si el correo está registrado, recibirás un enlace de recuperación."}

@router.post("/perform-reset")
async def perform_reset(request: PerformResetRequest):
    print(f"✅ Contraseña actualizada para token {request.token}")
    return {"status": "success", "message": "Tu contraseña ha sido actualizada correctamente."}

@router.post("/activate")
async def activate_user(req: UserActivate):
    if not supabase_client: raise HTTPException(500, "Error de conexión a la base de datos")
    
    # Buscar usuario por token
    res = supabase_client.table("profiles").select("*").eq("activation_token", req.token).execute()
    
    if not res.data:
        raise HTTPException(400, "El código de activación no es válido.")
        
    user_data = res.data[0]
    
    # Verificar expiración (si el tokenExpiry es anterior al tiempo actual)
    if user_data.get("token_expiry") and user_data["token_expiry"] < int(time.time() * 1000):
         raise HTTPException(400, "El código de activación ha expirado. Solicita una nueva invitación.")

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
        print(f"❌ Error activando usuario: {e}")
        raise HTTPException(500, f"Error interno: {str(e)}")

@router.post("/login")
async def login(req: LoginRequest):
    if not supabase_client: raise HTTPException(500, "Error de conexión a la base de datos")
    
    # Buscar por email o username
    res = supabase_client.table("profiles").select("*").or_(f"email.eq.{req.identifier},username.eq.{req.identifier}").execute()
    
    if not res.data:
        raise HTTPException(401, "El usuario no existe")
    
    user_data = res.data[0]
    
    if not user_data.get("is_activated"):
        raise HTTPException(401, "Esta cuenta aún no ha sido activada")
        
    # Verificación de contraseña (en texto plano por ahora según el requerimiento anterior, 
    # en producción usaría hashing)
    if user_data.get("password") != req.password:
        raise HTTPException(401, "Contraseña incorrecta")
        
    # Obtener entidades asociadas
    entities_res = supabase_client.table("profile_entities").select("entity_id").eq("profile_id", user_data["id"]).execute()
    entidad_ids = [e["entity_id"] for e in entities_res.data]
    
    # Generar Token JWT
    payload = {
        "user_id": str(user_data["id"]),
        "role": user_data["perfil"],
        "entity_id": str(user_data.get("entidad_id") or (entidad_ids[0] if entidad_ids else None))
    }
    
    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    
    # REGISTRO DE ACTIVIDAD: Inicio de sesión
    try:
        save_activity_log(
            { "message": "Inicio de sesión", "user_name": user_data["nombre"] }, 
            user={"user_id": user_data["id"], "entity_id": user_data.get("entidad_id"), "role": user_data["perfil"]}
        )
    except Exception as e:
        print(f"⚠️ Error registrando inicio de sesión: {e}")

    return {
        "id": user_data["id"],
        "nombre": user_data["nombre"],
        "email": user_data["email"],
        "role": user_data["perfil"],
        "entidadId": user_data.get("entidad_id"),
        "entidadIds": entidad_ids,
        "token": token
    }

# --- CRUD USUARIOS ---
@router.get("/users")
async def get_users(entidad_id: str | None = None, user: dict = Depends(get_current_user)):
    if not supabase_client: return []
    
    query = supabase_client.table("profiles").select("*")
    
    # Restricción multi-entidad: El administrador solo ve usuarios de su entidad.
    # El superadministrador puede filtrar o ver todos.
    if user.get("role") == "admin":
        entidad_actual = user.get("entity_id")
        query = query.eq("entidad_id", entidad_actual)
    elif entidad_id:
        query = query.eq("entidad_id", entidad_id)
        
    res = query.execute()
    # Obtener todas las relaciones de entidades
    rel_res = supabase_client.table("profile_entities").select("*").execute()
    rels = {}
    for r in rel_res.data:
        p_id = r["profile_id"]
        if p_id not in rels: rels[p_id] = []
        rels[p_id].append(r["entity_id"])

    # Mapear snake_case a camelCase para el frontend
    mapped = []
    for u in res.data:
        mapped.append({
            "id": u["id"], "nombre": u["nombre"], "apellido": u["apellido"], "email": u["email"],
            "username": u["username"], "perfil": u["perfil"], "estado": u["estado"],
            "isActivated": u["is_activated"], "entidadId": u["entidad_id"],
            "entidadIds": rels.get(u["id"], []),
            "activationToken": u.get("activation_token"), "tokenExpiry": u.get("token_expiry"),
            "iaDisponible": u.get("ia_disponible", False)
        })
    return mapped

@router.post("/users")
async def create_user(user: UserCreate):
    if not supabase_client: raise HTTPException(400, "No Supabase")
    data = {
        "nombre": user.nombre, "apellido": user.apellido, "email": user.email, "username": user.username,
        "perfil": user.perfil, "entidad_id": user.entidadId, "activation_token": user.activationToken,
        "token_expiry": user.tokenExpiry, "ia_disponible": user.iaDisponible or False
    }
    res = supabase_client.table("profiles").insert(data).execute()
    new_user = res.data[0]
    
    # Insertar en tabla de unión si hay entidades
    if user.entidadIds:
        rels = [{"profile_id": new_user["id"], "entity_id": e_id} for e_id in user.entidadIds]
        supabase_client.table("profile_entities").insert(rels).execute()
        
    return new_user

@router.put("/users/{user_id}")
async def update_user(user_id: str, user: UserUpdate):
    if not supabase_client: raise HTTPException(400, "No Supabase")
    data = {}
    if user.nombre is not None: data["nombre"] = user.nombre
    if user.apellido is not None: data["apellido"] = user.apellido
    if user.estado is not None: data["estado"] = user.estado
    if user.perfil is not None: data["perfil"] = user.perfil
    if user.entidadId is not None: data["entidad_id"] = user.entidadId
    if user.isActivated is not None: data["is_activated"] = user.isActivated
    if user.iaDisponible is not None: data["ia_disponible"] = user.iaDisponible
    
    res = supabase_client.table("profiles").update(data).eq("id", user_id).execute()
    
    # Actualizar entidades asociadas si se proporcionan
    if user.entidadIds is not None:
        # Eliminar anteriores
        supabase_client.table("profile_entities").delete().eq("profile_id", user_id).execute()
        # Insertar nuevas
        if user.entidadIds:
            rels = [{"profile_id": user_id, "entity_id": e_id} for e_id in user.entidadIds]
            supabase_client.table("profile_entities").insert(rels).execute()
            
    return res.data[0]

@router.delete("/users/{user_id}")
async def delete_user(user_id: str):
    if not supabase_client: raise HTTPException(400, "No Supabase")
    supabase_client.table("profiles").delete().eq("id", user_id).execute()
    return {"status": "deleted"}

# --- CRUD ENTIDADES ---
@router.get("/entities")
async def get_entities():
    if not supabase_client: return []
    res = supabase_client.table("entities").select("*").execute()
    # Mapear snake_case a camelCase
    mapped = []
    for e in res.data:
        mapped.append({
            "id": e["id"], "razonSocial": e["razon_social"], 
            "nit": e["nit"], "numeroDocumento": e["nit"], 
            "email": e.get("email"), "correo": e.get("email"),
            "telefono": e.get("telefono"), "pais": e["pais"], "departamento": e.get("departamento"),
            "ciudad": e.get("ciudad"), "sigla": e.get("sigla"), "direccion": e.get("direccion"),
            "maxUsuarios": e["max_usuarios"], "maxDependencias": e["max_dependencias"], "estado": e["estado"]
        })
    return mapped

@router.post("/entities")
async def create_entity(entity: EntityCreate):
    if not supabase_client: raise HTTPException(400, "No Supabase")
    data = {
        "razon_social": entity.razonSocial, "nit": entity.nit or entity.numeroDocumento,
        "email": entity.email or entity.correo, "telefono": entity.telefono, "pais": entity.pais,
        "departamento": entity.departamento, "ciudad": entity.ciudad, "sigla": entity.sigla,
        "direccion": entity.direccion, "max_usuarios": entity.maxUsuarios,
        "max_dependencias": entity.maxDependencias, "estado": entity.estado
    }
    res = supabase_client.table("entities").insert(data).execute()
    return res.data[0]

@router.put("/entities/{entity_id}")
async def update_entity(entity_id: str, entity: EntityCreate):
    if not supabase_client: raise HTTPException(400, "No Supabase")
    data = {
        "razon_social": entity.razonSocial, "nit": entity.nit or entity.numeroDocumento, "email": entity.email or entity.correo,
        "telefono": entity.telefono, "pais": entity.pais, "departamento": entity.departamento,
        "ciudad": entity.ciudad, "sigla": entity.sigla, "direccion": entity.direccion,
        "max_usuarios": entity.maxUsuarios, "max_dependencias": entity.maxDependencias, "estado": entity.estado
    }
    res = supabase_client.table("entities").update(data).eq("id", entity_id).execute()
    return res.data[0]

@router.delete("/entities/{entity_id}")
async def delete_entity(entity_id: str):
    if not supabase_client: raise HTTPException(400, "No Supabase")
    supabase_client.table("entities").delete().eq("id", entity_id).execute()
    return {"status": "deleted"}

TRD_ANALYZE_PROMPT = """Eres un extractor de datos de alta precisión especializado en TRD Colombianas.
Tu salida debe ser ÚNICAMENTE un objeto JSON. No incluyas explicaciones ni markdown.

ESTRUCTURA OBLIGATORIA DEL JSON:
{{
  "message": "Resumen",
  "actions": [
    {{
      "type": "CREATE",
      "entity": "dependencias",
      "id": "dep_1",
      "payload": {{ "nombre": "Nombre Oficina", "codigo": "1.1", "sigla": "ABREVIATURA" }}
    }},
    {{
      "type": "CREATE",
      "entity": "series",
      "id": "ser_1",
      "payload": {{ "dependenciaId": "dep_1", "nombre": "Nombre Serie", "codigo": "11-2" }}
    }},
    {{
      "type": "CREATE",
      "entity": "subseries",
      "id": "sub_1",
      "payload": {{ "serieId": "ser_1", "dependenciaId": "dep_1", "nombre": "Nombre Subserie", "codigo": "11-2-14" }}
    }},
    {{
      "type": "CREATE",
      "entity": "trd_records",
      "payload": {{
        "dependenciaId": "dep_1",
        "serieId": "ser_1",
        "subserieId": "sub_1",
        "retencionGestion": 2,
        "retencionCentral": 8,
        "disposicion": "CT",
        "procedimiento": "Texto del procedimiento"
      }}
    }}
  ]
}}

REGLAS DE ORO:
1. Usa IDs temporales (dep_1, ser_1, sub_1) para vincular hijos con padres.
2. Extrae TODOS los registros que veas en la tabla.
3. Si un campo no aplica, usa null.
4. Para la disposición usa abreviaturas: CT, E, S, D.

TEXTO/VISIÓN:
{text}
"""


async def process_ocr_task(doc_id: str, content: bytes, filename: str):
    print(f"⚙️ Iniciando Background Task OCR para: {filename}")
    extracted_text = ""
    ocr_engaged = False
    
    try:
        fitz_doc = fitz.open(stream=content)
        pages_to_process = min(len(fitz_doc), 15)
        for i in range(pages_to_process):
            extracted_text += f"\n--- PÁGINA {i+1} ---\n" + fitz_doc[i].get_text()
        fitz_doc.close()
    except Exception as e:
        print(f"*** Error leyendo archivo con Fitz: {type(e).__name__}: {e}")
        try:
            row_m = supabase_client.table("rag_documents").select("metadata").eq("id", doc_id).execute()
            curr_meta = row_m.data[0]["metadata"] if row_m.data else {}
        except:
            curr_meta = {}
        curr_meta["status"] = "error"
        curr_meta["error"] = f"Fitz: {str(e)}"
        curr_meta["message"] = f"Error leyendo el archivo: {str(e)}"
        supabase_client.table("rag_documents").update({"metadata": curr_meta}).eq("id", doc_id).execute()
        return

    if len(extracted_text.strip()) < 50:
        print("⚠️ Texto insuficiente extraído.")
    
    try:
        # Usar el LLM para analizar la estructura
        messages_llm = [
            SystemMessage(content=TRD_ANALYZE_PROMPT.format(text=extracted_text))
        ]
        
        # --- INTERNAL OCR SKILL FALLBACK ---
        try:
            fitz_doc = fitz.open(stream=content)
            if len(fitz_doc) > 0:
                print("🛠️ OCR_SKILL: Activando 'trd-internal-ocr' debido a documento escaneado/legibilidad baja.")
                ocr_engaged = True
                page = fitz_doc[0]
                pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
                img_data = base64.b64encode(pix.tobytes("png")).decode("utf-8")
                
                messages_llm.append(HumanMessage(content=[
                    {"type": "text", "text": "Estás operando como el motor 'trd-internal-ocr'. Aquí tienes la imagen real de la TRD. Por favor, identifica las filas y columnas para extraer las dependencias, series y subseries. Genera el JSON."},
                    {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{img_data}"}}
                ]))
            fitz_doc.close()
        except Exception as vision_err:
            print(f"⚠️ OCR_SKILL falló al procesar imagen: {vision_err}")

        print(f"[LLM] Llamando a modelo: {OPENROUTER_MODEL}...")
        try:
            response = await asyncio.to_thread(llm.invoke, messages_llm)
        except Exception as llm_err:
            print(f"[LLM ERROR] {type(llm_err).__name__}: {llm_err}")
            raise
        content_ai = response.content.strip()
        print(f"[LLM] Respuesta recibida ({len(content_ai)} chars)")

        # --- SE RETIRÓ PERSISTENCIA TEMPRANA EN RAG (Problem 3) ---
        # Ahora el texto extraído se guarda silenciosamente en la sesión
        # y solo se indexará tras aprobación del usuario.

        # Extraer JSON
        json_match = re.search(r'(\{.*\})', content_ai, re.DOTALL)
        parsed_data = {}
        if json_match:
            try:
                parsed_data = json.loads(json_match.group(1))
                if not parsed_data.get("actions") or len(parsed_data["actions"]) == 0:
                    parsed_data["message"] = f"La IA analizó pero no generó acciones. Respuesta bruta: {content_ai[:1000]}"
            except Exception as json_err:
                print(f"❌ Error parseando JSON: {json_err}")
                
        if not parsed_data:
            parsed_data = {
                "message": f"No se pudo detectar el formato JSON.",
                "actions": [],
                "raw": content_ai
            }

        parsed_data["ocr_engaged"] = ocr_engaged
        
        # --- UPDATE IMPORT SESSION ---
        try:
            # Obtener metadata actual para no pisarla
            row = supabase_client.table("rag_documents").select("metadata").eq("id", doc_id).execute()
            if row.data:
                curr_meta = row.data[0]["metadata"]
                curr_meta.update({
                    "status": "reviewing",
                    "actions": parsed_data.get("actions", []),
                    "message": parsed_data.get("message", ""),
                    "ocr_engaged": ocr_engaged,
                    "pages": pages_to_process
                })
                supabase_client.table("rag_documents").update({
                    "content": extracted_text,
                    "metadata": curr_meta
                }).eq("id", doc_id).execute()
                print("✅ Session updated a reviewing.")
        except Exception as upd_err:
            print(f"❌ Error updateting session: {upd_err}")

    except Exception as e:
        import traceback
        print(f"[OCR TASK ERROR] {type(e).__name__}: {e}")
        print(f"[TRACEBACK] {traceback.format_exc()}")
        try:
            row = supabase_client.table("rag_documents").select("metadata").eq("id", doc_id).execute()
            if row.data:
                curr_meta = row.data[0]["metadata"]
                curr_meta["status"] = "error"
                curr_meta["error"] = f"{type(e).__name__}: {str(e)}"
                curr_meta["message"] = str(e)
                supabase_client.table("rag_documents").update({"metadata": curr_meta}).eq("id", doc_id).execute()
        except:
            pass


@router.post("/analyze-trd")
async def analyze_trd(background_tasks: BackgroundTasks, file: UploadFile = File(...), entidad_id: str = "", user: dict = Depends(get_current_user)):
    if not supabase_client:
        raise HTTPException(status_code=503, detail="Supabase no configurado.")
    
    print(f"🔍 Recibiendo TRD para analizar: {file.filename}")
    content = await file.read()
    
    # Subir a Supabase Storage y crear sesión inicial
    file_url = ""
    try:
        bucket = "trd-uploads"
        filename_clean = f"{datetime.now().timestamp()}_{file.filename.replace(' ', '_')}"
        supabase_client.storage.from_(bucket).upload(filename_clean, content)
        file_url = supabase_client.storage.from_(bucket).get_public_url(filename_clean)
    except Exception as e:
        print(f"⚠️ Error subiendo a storage: {e}")
        
    # Entidad de la sesión
    entidad_final = user.get("entity_id") if user.get("role") == "admin" else entidad_id

    # Intentar traer el nombre de la entidad para el log y metadata
    entidad_nombre = "Global"
    if entidad_final:
        try:
            ent_res = supabase_client.table("entities").select("razon_social").eq("id", entidad_final).execute()
            if ent_res.data:
                entidad_nombre = ent_res.data[0].get("razon_social", "Entidad Desconocida")
        except:
            pass

    doc_metadata = {
        "source": file.filename,
        "type": "trd_import_session",
        "is_trd_internal": True,
        "status": "analyzing",
        "file_url": file_url,
        "entidad_id": entidad_final,
        "entidad_nombre": entidad_nombre,
        "extracted_at": str(datetime.now()),
        "actions": []
    }
    
    try:
        rag_payload = {"content": "Import Session Snapshot", "metadata": doc_metadata}
        inserted = supabase_client.table("rag_documents").insert(rag_payload).execute()
        if inserted.data and len(inserted.data) > 0:
            doc_id = inserted.data[0].get("id")
            # Lanzamos BackgroundTask
            background_tasks.add_task(process_ocr_task, doc_id, content, file.filename)
            return {"import_id": doc_id, "status": "analyzing"}
        else:
            raise HTTPException(status_code=500, detail="No se pudo crear la sesión RAG")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
        return parsed_data
        
    except Exception as e:
        print(f"❌ Error en analyze-trd: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ─── CRUD TRD Imports ───────────────────────────────────────────────────────

@router.get("/imports")
async def get_imports(request: Request, entidad_id: str | None = None, user: dict = Depends(get_current_user)):
    if not supabase_client: return []
    
    # Diagnóstico: registrar qué usuario está solicitando imports
    auth_header = request.headers.get("Authorization", "NO_AUTH_HEADER")
    print(f"📋 GET /imports | role={user.get('role')} | entity_id={user.get('entity_id')} | token_start={auth_header[:30]}")
    
    # Restricción: solo filtrar si no es superadmin o si el superadmin pide una entidad específica
    query = supabase_client.table("rag_documents") \
        .select("id, metadata, created_at") \
        .eq("metadata->>type", "trd_import_session")

    if user.get("role") == "admin":
        query = query.eq("metadata->>entidad_id", user.get("entity_id"))
    elif user.get("role") != "superadmin" and entidad_id:
        query = query.eq("metadata->>entidad_id", entidad_id)
    # Si es superadmin y no hay entidad_id, no filtramos por entidad_id (ve todo)

    res = query.order("created_at", desc=True).execute()
    imports = []
    for row in res.data:
        meta = row.get("metadata", {})
        imports.append({
            "id": row["id"],
            "filename": meta.get("source", ""),
            "created_at": row["created_at"],
            "status": meta.get("status", "reviewing"),
            "file_url": meta.get("file_url", ""),
            "actions": meta.get("actions", []),
            "message": meta.get("message", ""),
            "ocr_engaged": meta.get("ocr_engaged", False),
            "entidad_nombre": meta.get("entidad_nombre", "Global")
        })
    return imports

# ─── ACTIVITY LOGS ──────────────────────────────────────────────────────────

@router.post("/activity-logs")
async def save_activity_log(log_data: dict, user: dict = Depends(get_current_user)):
    if not supabase_client: raise HTTPException(status_code=503)
    
    entidad_id = user.get("entity_id")
    # For sub-admins/admins, we force their entity. For superadmins, they might provide one or use "global".
    if not entidad_id and user.get("role") == "superadmin":
        entidad_id = log_data.get("entidad_id")
        
    log_entry = {
        "user_id": user.get("user_id"),
        "user_name": log_data.get("user_name") or "Usuario",
        "entidad_id": entidad_id,
        "message": log_data.get("message"),
        "created_at": str(datetime.now())
    }
    
    try:
        res = supabase_client.table("activity_logs").insert(log_entry).execute()
        
        # PRUINING LOGIC: Solo mantener los últimos 100 registros por entidad
        if entidad_id:
            # DELETE with OFFSET is more efficient to keep the 'top N'
            # Note: Supabase's direct DELETE with subqueries might be limited, 
            # so we'll do a simple 'get old IDs then delete' for safety if performance isn't critical.
            # But let's try the direct SQL-like approach first if possible or a safe alternative.
            try:
                # Obtenemos los IDs que exceden el límite de 100
                old_logs = supabase_client.table("activity_logs").select("id").eq("entidad_id", entidad_id).order("created_at", desc=True).offset(100).execute()
                if old_logs.data:
                    ids_to_delete = [l["id"] for l in old_logs.data]
                    supabase_client.table("activity_logs").delete().in_("id", ids_to_delete).execute()
                    print(f"🗑️ Purgados {len(ids_to_delete)} logs antiguos para entidad {entidad_id}")
            except Exception as prune_err:
                print(f"⚠️ Error purgando logs antiguos: {prune_err}")

        return {"status": "success", "id": res.data[0]["id"] if res.data else None}
    except Exception as e:
        print(f"❌ Error guardando log: {e}")
        # No bloqueamos el flujo principal por un error de log, pero avisamos
        return {"status": "error", "message": str(e)}

@router.get("/activity-logs")
async def get_activity_logs(user: dict = Depends(get_current_user)):
    if not supabase_client: return []
    
    # Realizamos un JOIN con la tabla profiles para traer el nombre real del usuario por su ID
    query = supabase_client.table("activity_logs").select("*, profiles:user_id (nombre)").order("created_at", desc=True).limit(100)
    
    # Filtro: El administrador solo ve logs de su entidad. 
    if user.get("role") == "admin":
        entidad_actual = user.get("entity_id")
        query = query.eq("entidad_id", entidad_actual)
        
    try:
        res = query.execute()
        # Mapear para el frontend
        logs = []
        for row in res.data:
            # Prioridad: 1. Nombre del perfil (Join), 2. user_name guardado, 3. "Usuario"
            raw_profile = row.get("profiles")
            display_name = "Usuario"
            if isinstance(raw_profile, dict) and raw_profile.get("nombre"):
                display_name = raw_profile["nombre"]
            elif row.get("user_name"):
                display_name = row["user_name"]

            logs.append({
                "id": f"act_{row['id']}",
                "user": display_name,
                "message": row["message"],
                "timestamp": row["created_at"]
            })
        return logs
    except Exception as e:
        print(f"⚠️ Error cargando logs: {e}")
        return []

@router.put("/imports/{import_id}")
async def update_import_status(import_id: str, status_data: dict):
    if not supabase_client: raise HTTPException(status_code=503)
    
    # Basic UUID check to avoid crashes with random float strings from frontend
    if len(import_id) < 32 and "." in import_id:
        return {"status": "ignored", "reason": "invalid_id_format"}

    res = supabase_client.table("rag_documents").select("metadata, content").eq("id", import_id).execute()
    if not res.data:
        raise HTTPException(404)
        
    meta = res.data[0]["metadata"]
    content = res.data[0].get("content") or ""
    new_status = status_data.get("status", meta.get("status"))
    meta["status"] = new_status
    
    update_payload = {"metadata": meta}
    
    # Si fue aprobado (success), entonces lo convertimos en documento activo de RAG
    if new_status == "success":
        meta["type"] = "trd_upload" # Cambia de temp_trd_session a doc real
        if "extracted_at" not in meta:
             meta["extracted_at"] = str(datetime.now())
        
        # Vectorizamos retrospectivamente
        try:
             if embeddings and content and content != "Import Session Snapshot":
                  embedding_vector = embeddings.embed_query(content)
                  update_payload["embedding"] = embedding_vector
        except Exception as e:
             print(f"⚠️ Error embedding approved TRD: {e}")
             
    supabase_client.table("rag_documents").update(update_payload).eq("id", import_id).execute()
    return {"status": "updated"}

@router.delete("/imports/{import_id}")
async def delete_import(import_id: str):
    if not supabase_client: raise HTTPException(status_code=503)
    # Al eliminar se borra la sesion guardada
    supabase_client.table("rag_documents").delete().eq("id", import_id).execute()
    return {"status": "deleted"}

# ─── CRUD RAG Documents ───────────────────────────────────────────────────────

@router.get("/rag-documents")
async def get_rag_documents():
    """
    Returns one entry per unique document (deduped by metadata.source).
    Handles both regular PDF uploads (type='text' chunks) and TRD/import session rows.
    """
    if not supabase_client: return []
    
    try:
        # Fetch ALL rows ordered oldest-first so we get the 'first chunk' as representative
        res = supabase_client.table("rag_documents") \
            .select("id, metadata, created_at") \
            .order("created_at", desc=False) \
            .execute()
        
        # Deduplicate by source filename — keep first row encountered per source
        seen_sources = {}
        for row in res.data:
            meta = row.get("metadata") or {}
            source = meta.get("source", "")
            if not source:
                continue  # skip rows without a source
            
            # Filter: Solo mostrar documentos aprobados o que no sean sesiones (Problem 3)
            if meta.get("status") and meta.get("status") != "success":
                continue

            if source not in seen_sources:
                seen_sources[source] = {
                    "id": row["id"],
                    "filename": meta.get("label") or source,
                    "metadata": meta,
                    "created_at": row["created_at"]
                }
            else:
                # If a later chunk/row has extra metadata (e.g. is_trd_internal), merge it in
                existing_meta = seen_sources[source]["metadata"]
                for key in ("is_trd_internal", "label", "description", "type", "file_url", "pages", "status"):
                    if key in meta and key not in existing_meta:
                        existing_meta[key] = meta[key]
        
        # Sort result by created_at descending (newest first)
        docs = sorted(seen_sources.values(), key=lambda d: d["created_at"], reverse=True)
        return docs

    except Exception as e:
        print(f"❌ Error en GET /rag-documents: {e}")
        return []


@router.get("/rag-documents/{doc_id}/content")
async def get_rag_document_content(doc_id: str):
    """Returns the full text content of a document by concatenating all its chunks."""
    if not supabase_client: raise HTTPException(status_code=503)
    try:
        # First, get the source filename from the representative row
        row_res = supabase_client.table("rag_documents").select("metadata").eq("id", doc_id).execute()
        if not row_res.data:
            raise HTTPException(status_code=404, detail="Documento no encontrado.")
        source = (row_res.data[0].get("metadata") or {}).get("source")
        if not source:
            raise HTTPException(status_code=400, detail="El documento no tiene fuente definida.")

        # Fetch ALL chunks for this source, ordered by page
        chunks_res = (
            supabase_client.table("rag_documents")
            .select("content, metadata, created_at")
            .contains("metadata", {"source": source})
            .order("created_at", desc=False)
            .execute()
        )

        # Group by page number, deduplicate overlapping chunks
        pages: dict[int, list] = {}
        for chunk in chunks_res.data:
            page_num = (chunk.get("metadata") or {}).get("page", 0)
            pages.setdefault(page_num, []).append(chunk.get("content", ""))

        # Build full text page by page
        full_pages = []
        for page_num in sorted(pages.keys()):
            # Join multiple chunks of same page (avoid duplicates from overlap)
            page_text = "\n".join(pages[page_num])
            full_pages.append({"page": page_num, "text": page_text})

        return {
            "source": source,
            "total_pages": len(full_pages),
            "pages": full_pages
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error en /rag-documents/{doc_id}/content: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/rag-documents/{doc_id}")
async def delete_rag_document(doc_id: str):
    if not supabase_client: raise HTTPException(status_code=503)
    # Look up source filename so we can delete ALL chunks for this document
    try:
        row_res = supabase_client.table("rag_documents").select("metadata").eq("id", doc_id).execute()
        if row_res.data:
            source = (row_res.data[0].get("metadata") or {}).get("source")
            if source:
                # Delete ALL rows with this source (all chunks of the same file)
                supabase_client.table("rag_documents").delete().contains("metadata", {"source": source}).execute()
                return {"status": "deleted", "source": source}
    except Exception as e:
        print(f"⚠️ Error en delete por source: {e}")
    # Fallback: delete only the specific row
    supabase_client.table("rag_documents").delete().eq("id", doc_id).execute()
    return {"status": "deleted"}

@router.put("/rag-documents/{doc_id}")
async def update_rag_document(doc_id: str, update: dict):
    """Update editable metadata fields of a RAG document (label, description, is_trd_internal)."""
    if not supabase_client: raise HTTPException(status_code=503)
    # Fetch current metadata
    res = supabase_client.table("rag_documents").select("metadata").eq("id", doc_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Documento no encontrado.")
    current_meta = res.data[0].get("metadata", {}) or {}
    # Merge only allowed editable fields
    editable_fields = {"label", "description", "is_trd_internal"}
    for field in editable_fields:
        if field in update:
            current_meta[field] = update[field]
    supabase_client.table("rag_documents").update({"metadata": current_meta}).eq("id", doc_id).execute()
    return {"status": "updated", "metadata": current_meta}

@router.post("/rag-documents")
async def create_rag_document(doc: dict):
    if not supabase_client: raise HTTPException(status_code=503)
    # Generar embedding si viene contenido
    if "content" in doc and embeddings:
        doc["embedding"] = embeddings.embed_query(doc["content"])
    res = supabase_client.table("rag_documents").insert(doc).execute()
    return res.data[0] if res.data else {}


app.include_router(router)

@app.get("/")
async def health_check():
    return {"status": "ok", "message": "OSE Backend + Supabase ready"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
