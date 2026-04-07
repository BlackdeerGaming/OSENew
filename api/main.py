import os
import re
import base64
from fastapi import FastAPI, File, UploadFile, HTTPException, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
from dotenv import load_dotenv
import fitz  # PyMuPDF

# Cargar variables de entorno
load_dotenv()

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
            dimensions=1536,
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
    temperature=0.2,
    max_tokens=1024,
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

class GenerateDepsRequest(BaseModel):
    prompt: str

class AgentActionContext(BaseModel):
    dependencias: list[dict]
    series: list[dict]
    subseries: list[dict]

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

@router.get("/")
async def root():
    return {
        "status": "ok",
        "model": OPENROUTER_MODEL,
        "vector_store": "supabase_pgvector",
        "supabase": bool(supabase_client)
    }

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
async def upload_pdf(file: UploadFile = File(...)):
    """
    Sube un PDF, extrae texto, genera embeddings y los guarda en Supabase pgvector.
    Vision AI desactivada para evitar timeout de Vercel (10s límite).
    """
    if not supabase_client:
        raise HTTPException(status_code=503, detail="Supabase no está configurado en el servidor.")
    if embeddings is None:
        raise HTTPException(status_code=503, detail="El motor de embeddings no está disponible.")

    print(f"📥 POST /upload - File: {file.filename} - Type: {file.content_type}")
    content = await file.read()
    print(f"📊 Tamaño recibido: {len(content) / (1024*1024):.2f} MB")

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
                        metadata={"page": page_num, "source": file.filename, "type": "text"}
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
        vector_store = await SupabaseVectorStore.afrom_documents(
            documents=chunks,
            embedding=embeddings,
            client=supabase_client,
            table_name="rag_documents",
            query_name="match_rag_documents",
        )
        print(f"✅ '{file.filename}' indexado en Supabase: {len(chunks)} chunks")
    except Exception as e:
        print(f"❌ Error guardando en Supabase: {e}")
        raise HTTPException(status_code=500, detail=f"Error al indexar en la base de datos: {str(e)}")

    return {
        "message": "PDF procesado e indexado en Supabase con éxito",
        "chunks_created": len(chunks),
        "text_pages": text_count,
        "images_processed": 0,
        "vector_store": "supabase_pgvector"
    }

@router.post("/chat")
async def chat(request: ChatRequest):
    if not supabase_client:
        raise HTTPException(status_code=503, detail="Supabase no está configurado.")

    try:
        vector_store = SupabaseVectorStore(
            client=supabase_client,
            embedding=embeddings,
            table_name="rag_documents",
            query_name="match_rag_documents",
        )
        source_docs = vector_store.similarity_search(request.query, k=5)

        rag_chain = (
            RAG_PROMPT
            | llm
            | StrOutputParser()
        )

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

    system_prompt = f"""Eres el Agente OSE, un orquestador inteligente del sistema de TRD (Tablas de Retención Documental).
Tu objetivo es interpretar intenciones CRUD en el input del usuario (Crear, Leer, Actualizar, Eliminar) sobre la estructura jerárquica: Dependencias -> Series -> Subseries.

ESTADO ACTUAL DEL SISTEMA (Contexto):
Dependencias: {json.dumps(deps, ensure_ascii=False)}
Series: {json.dumps(series, ensure_ascii=False)}
Subseries: {json.dumps(subs, ensure_ascii=False)}

REGLAS DE VALIDACIÓN (CRÍTICAS):

1. CREACIÓN DE SERIES (OBLIGATORIO):
Para crear una Serie, debe existir una Dependencia asociada explícitamente.
- Si NO existe: actions: [] y responde "Por favor indica el nombre exacto de la dependencia entre comillas."

2. CREACIÓN DE SUBSERIES (OBLIGATORIO):
Para crear una Subserie, debe existir una Dependencia y una Serie.
- Si falta alguna: actions: [] y responde "Por favor indica el nombre de la dependencia y la serie entre comillas."

3. FORMATO ESTRICTO:
Retorna ÚNICAMENTE JSON válido, jamás uses código markdown como ```json. El objeto debe ser:
{{
  "message": "Tu respuesta amistosa",
  "actions": [
    {{
      "type": "CREATE" | "UPDATE" | "DELETE",
      "entity": "dependencias" | "series" | "subseries",
      "id": "ID o null",
      "payload": {{}}
    }}
  ]
}}

4. JERARQUÍA MASIVA: Si creas dependencia y series al mismo tiempo, usa id temporal "t1" en el padre y "t1" en dependenciaId del hijo.
5. ACTUALIZACIONES: Si modificas/eliminas un registro existente, usa su id real del ESTADO ACTUAL.
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
        for marker in ["```json", "```"]:
            content = content.replace(marker, "")
        content = content.strip()
        return json.loads(content)
    except Exception as e:
        print(f"❌ Error en agent-action: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/send-activation")
async def send_activation(request: ActivationEmailRequest):
    print(f"\n📧 [MOCK EMAIL] PARA: {request.email} | LINK: {request.link}\n")
    return {"status": "sent", "message": f"Email sent to {request.email}"}

@router.post("/request-reset")
async def request_reset(request: PasswordResetRequest):
    print(f"\n🔑 [MOCK RESET] PARA: {request.email}\n")
    return {"status": "ok", "message": "Si el correo está registrado, recibirás un enlace de recuperación."}

@router.post("/perform-reset")
async def perform_reset(request: PerformResetRequest):
    print(f"✅ Contraseña actualizada para token {request.token}")
    return {"status": "success", "message": "Tu contraseña ha sido actualizada correctamente."}

app.include_router(router)

@app.get("/")
async def health_check():
    return {"status": "ok", "message": "OSE Backend + Supabase ready"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
