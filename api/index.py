import os
import re
import base64
from fastapi import FastAPI, File, UploadFile, HTTPException, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
from io import BytesIO
from dotenv import load_dotenv
import fitz  # PyMuPDF

# Cargar variables de entorno
load_dotenv()

# LangChain imports
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_pinecone import PineconeVectorStore, PineconeEmbeddings
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough
from langchain_core.messages import HumanMessage, SystemMessage
import json

# ─── Configuración ────────────────────────────────────────────────────────────

# --- Configuración OpenRouter ---
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_MODEL   = os.getenv("OPENROUTER_MODEL", "google/gemini-2.0-flash-001")

# Cadena de modelos de visión GRATUITOS
VISION_MODELS_FALLBACK = [
    "google/gemma-3-27b-it:free",
    "nvidia/nemotron-nano-12b-v2-vl:free",
    "qwen/qwen3.6-plus:free",
    "google/gemma-3-12b-it:free",
]

# --- Configuración Pinecone ---
PINECONE_API_KEY   = os.getenv("PINECONE_API_KEY")
PINECONE_INDEX_NAME = os.getenv("PINECONE_INDEX_NAME")
PINECONE_EMBEDDING_MODEL = os.getenv("PINECONE_EMBEDDING_MODEL", "multilingual-e5-large")
IMAGE_MIN_SIZE     = 8000  # bytes — ignorar íconos pequeños y logos de < 8KB

app = FastAPI(title="RAG PDF Backend - OSE Copilot")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Inicializar modelos ──────────────────────────────────────────────────────

vector_store = None
embeddings = None

if PINECONE_API_KEY:
    print(f"⏳ Inicializando modelo de Embeddings en nube (Pinecone: {PINECONE_EMBEDDING_MODEL})...")
    try:
        embeddings = PineconeEmbeddings(
            model=PINECONE_EMBEDDING_MODEL, 
            pinecone_api_key=PINECONE_API_KEY
        )
        print("✅ Embeddings listo (Pinecone API).")
        
        if PINECONE_INDEX_NAME:
            vector_store = PineconeVectorStore(
                index_name=PINECONE_INDEX_NAME,
                embedding=embeddings,
                pinecone_api_key=PINECONE_API_KEY
            )
            print(f"✅ Conectado a Pinecone (Índice: {PINECONE_INDEX_NAME})")
    except Exception as e:
        print(f"❌ Error iniciando Pinecone: {e}")
        vector_store = None
else:
    print("⚠️ PINECONE_API_KEY no encontrada. El sistema RAG no funcionará correctamente.")

print(f"🤖 LLM de texto: {OPENROUTER_MODEL}")
print(f"👁️  LLM de visión: {VISION_MODELS_FALLBACK[0]} (gratuito, con fallback automático)")

# ─── LLM de texto (Qwen) ─────────────────────────────────────────────────────
llm = ChatOpenAI(
    model=OPENROUTER_MODEL,
    openai_api_key=OPENROUTER_API_KEY,
    openai_api_base="https://openrouter.ai/api/v1",
    temperature=0.2,
    max_tokens=1024,
    default_headers={
        "HTTP-Referer": "http://localhost:5173",
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
5. Si el contexto incluye descripciones de imágenes u organigramas, úsalas para responder.

CONTEXTO DEL DOCUMENTO:
{context}"""),
    ("human", "{question}")
])

VISION_PROMPT = """Eres un experto en análisis de documentos corporativos.

Analiza esta imagen extraída de un documento oficial y describe con detalle:
- Si es un organigrama: nombra todas las áreas, cargos y jerarquías visibles.
- Si es una tabla: transcribe su contenido estructurado.
- Si es un diagrama: describe los elementos y sus relaciones.
- Si es otro tipo de imagen: describe su contenido relevante para gestión documental.

Sé específico y exhaustivo. Responde en español."""

# ─── Helpers ──────────────────────────────────────────────────────────────────

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

def clean_text(text: str) -> str:
    text = re.sub(r'(?<!\n)\n(?!\n)', ' ', text)
    text = re.sub(r'\n{2,}', '\n', text)
    text = re.sub(r'^\s*\d+\s*$', '', text, flags=re.MULTILINE)
    text = re.sub(r'  +', ' ', text)
    return text.strip()

def format_docs(docs):
    return "\n\n---\n\n".join(doc.page_content for doc in docs)

def describe_image_with_vision(image_bytes: bytes, page_num: int) -> str | None:
    """Envía imagen al modelo de visión con reintentos y cadena de fallback."""
    import time
    
    for model_id in VISION_MODELS_FALLBACK:
        # Crear cliente LLM para este modelo específico
        model_llm = ChatOpenAI(
            model=model_id,
            openai_api_key=OPENROUTER_API_KEY,
            openai_api_base="https://openrouter.ai/api/v1",
            temperature=0.1,
            max_tokens=1500,
            default_headers={
                "HTTP-Referer": "http://localhost:5173",
                "X-Title": "OSE Copilot Vision"
            }
        )
        
        # Intentar hasta 3 veces con backoff
        for attempt in range(3):
            try:
                b64 = base64.b64encode(image_bytes).decode("utf-8")
                message = HumanMessage(content=[
                    {"type": "text", "text": VISION_PROMPT},
                    {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64}"}}
                ])
                response = model_llm.invoke([message])
                desc = response.content.strip()
                print(f"  ✅ Pág. {page_num}: [{model_id.split('/')[1]}] {len(desc)} chars")
                return desc

            except Exception as e:
                err_str = str(e)
                if '429' in err_str:
                    wait = 2 ** (attempt + 1)  # 2, 4, 8 segundos
                    print(f"  ⏳ Pág. {page_num}: [{model_id.split('/')[1]}] rate limit, esperando {wait}s... (intento {attempt+1}/3)")
                    time.sleep(wait)
                elif '404' in err_str:
                    print(f"  ⚠️  [{model_id}] no disponible, probando siguiente modelo...")
                    break  # Este modelo no existe, saltar al siguiente
                else:
                    print(f"  ⚠️  Pág. {page_num}: [{model_id.split('/')[1]}] error: {e}")
                    break
    
    print(f"  ❌ Pág. {page_num}: todos los modelos de visión fallaron, imagen omitida.")
    return None

def extract_page_images(page: fitz.Page, page_num: int) -> list[bytes]:
    """Extrae imágenes de una página de PDF como bytes PNG."""
    images = []
    # Renderizar la página completa como imagen solo si tiene imágenes internas
    image_list = page.get_images(full=True)
    if not image_list:
        return images

    doc = page.parent
    for img_info in image_list:
        xref = img_info[0]
        try:
            base_img = doc.extract_image(xref)
            img_bytes = base_img["image"]
            # Filtrar imágenes demasiado pequeñas (íconos, decoraciones)
            if len(img_bytes) < IMAGE_MIN_SIZE:
                continue
            # Convertir a PNG usando PyMuPDF para normalizar el formato
            pix = fitz.Pixmap(doc, xref)
            if pix.n > 4:  # CMYK → RGB
                pix = fitz.Pixmap(fitz.csRGB, pix)
            images.append(pix.tobytes("png"))
        except Exception as e:
            print(f"  ⚠️  Error extrayendo imagen xref={xref}: {e}")
    return images

# ─── Endpoints ────────────────────────────────────────────────────────────────

router = APIRouter(prefix="/api")

@router.get("/")
async def root():
    return {"status": "ok", "model": OPENROUTER_MODEL, "vision_model": VISION_MODELS_FALLBACK[0]}

@router.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):
    global vector_store

    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="El archivo debe ser un PDF")

    if embeddings is None:
        raise HTTPException(status_code=503, detail="El motor de embeddings no está disponible.")

    content = await file.read()
    documents = []
    text_count = 0
    image_count = 0

    # Abrir PDF con PyMuPDF (para imágenes) y pypdf (para texto)
    fitz_doc = fitz.open(stream=content, filetype="pdf")

    for page_num_0, page in enumerate(fitz_doc):
        page_num = page_num_0 + 1

        # ── Paso 1a: Extraer TEXTO ─────────────────────────────────────────
        raw_text = page.get_text()
        if raw_text:
            cleaned = clean_text(raw_text)
            if len(cleaned) > 30:
                documents.append(Document(
                    page_content=cleaned,
                    metadata={"page": page_num, "source": file.filename, "type": "text"}
                ))
                text_count += 1

        # ── Paso 1b: Extraer IMÁGENES y describirlas ───────────────────────
        page_images = extract_page_images(page, page_num)
        for img_bytes in page_images:
            desc = describe_image_with_vision(img_bytes, page_num)
            if desc:
                documents.append(Document(
                    page_content=f"[Imagen - Página {page_num}]\n{desc}",
                    metadata={"page": page_num, "source": file.filename, "type": "image"}
                ))
                image_count += 1
            import time; time.sleep(3)  # Pausa entre imágenes para evitar rate limit

    fitz_doc.close()

    if not documents:
        raise HTTPException(
            status_code=400,
            detail="No se pudo extraer contenido del PDF. Puede ser una imagen escaneada sin OCR o estar cifrado."
        )

    print(f"📄 Páginas con texto: {text_count} | Imágenes procesadas: {image_count}")

    # ── Paso 2: Chunking ───────────────────────────────────────────────────
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=3000,
        chunk_overlap=500,
        length_function=len,
        separators=["\n\n", "\n", ".", " ", ""],
    )
    chunks = splitter.split_documents(documents)

    # ── Paso 3: Embeddings + Pinecone ─────────────────────────────────────
    if not PINECONE_API_KEY or not PINECONE_INDEX_NAME:
         raise HTTPException(status_code=503, detail="Configuración de Pinecone incompleta en el servidor.")

    vector_store = PineconeVectorStore.from_documents(
        documents=chunks,
        embedding=embeddings,
        index_name=PINECONE_INDEX_NAME,
        pinecone_api_key=PINECONE_API_KEY
    )

    print(f"✅ '{file.filename}' indexado: {len(chunks)} chunks ({text_count} texto + {image_count} imágenes)")
    return {
        "message": "PDF procesado con éxito (texto + imágenes)",
        "chunks_created": len(chunks),
        "text_pages": text_count,
        "images_processed": image_count
    }


@router.post("/chat")
async def chat(request: ChatRequest):
    global vector_store

    if vector_store is None:
        raise HTTPException(
            status_code=400,
            detail="El Vector Store está vacío. Sube un documento PDF primero."
        )

    retriever = vector_store.as_retriever(search_kwargs={"k": 5})

    rag_chain = (
        {"context": retriever | format_docs, "question": RunnablePassthrough()}
        | RAG_PROMPT
        | llm
        | StrOutputParser()
    )

    try:
        answer = rag_chain.invoke(request.query)
    except Exception as e:
        print(f"❌ Error LLM: {e}")
        raise HTTPException(status_code=500, detail=f"Error al consultar el LLM: {str(e)}")

    source_docs = retriever.invoke(request.query)
    pages = sorted(set(
        d.metadata.get("page")
        for d in source_docs
        if d.metadata.get("page") is not None
    ))

    return {"answer": answer, "sources": pages}

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

Asegúrate de generar un objeto por cada dependencia solicitada en el prompt del usuario (Ej: si pide 4 dependencias, el arreglo debe tener 4 objetos).
IMPORTANTE: RESPONDE SOLO CON EL JSON VÁLIDO. NO incluyas markdown (```json), etiquetas, saludos, explicaciones ni texto adicional."""

    try:
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=request.prompt)
        ]
        
        response = llm.invoke(messages)
        content = response.content.strip()
        
        # Limpiar posible markdown residual si el modelo no obedece la regla "solo JSON"
        if content.startswith("```json"):
             content = content[7:]
        if content.startswith("```"):
             content = content[3:]
        if content.endswith("```"):
             content = content[:-3]
        content = content.strip()

        dependencias = json.loads(content)
        return {"dependencias": dependencias}
    except Exception as e:
        print(f"❌ Error generando dependencias: {e}")
        raise HTTPException(status_code=500, detail=f"Error al generar dependencias: {str(e)}\nRespuesta en crudo: {response.content if 'response' in locals() else 'N/A'}")

@router.post("/agent-action")
async def agent_action(request: AgentActionRequest):
    import json
    
    # Extraer arrays mínimos para el contexto del prompt
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
Para crear una Serie, debe existir una Dependencia asociada explícitamente (o deducible inequívocamente de los mensajes anteriores).
- Si NO especifica la dependencia: Tu JSON tendrá la sección de `actions` vacía `[]`, y responderás EXACTAMENTE: "Por favor indica el nombre exacto de la dependencia entre comillas."
- Si la dependencia NO existe en el ESTADO ACTUAL o es ambigua (y no la estemos creando en el mismo paso): Tu JSON tendrá `actions: []` y responderás EXACTAMENTE: "No encontré la dependencia. Por favor indícala entre comillas."

2. CREACIÓN DE SUBSERIES (OBLIGATORIO):
Para crear una Subserie, debe existir una Dependencia y una Serie explícitamente.
- Si falta nombrar alguna: `actions: []` y responderás EXACTAMENTE: "Por favor indica el nombre de la dependencia y la serie entre comillas, separados por coma."
- Si la Dependencia o Serie NO existen o son ambiguas: `actions: []` y responderás EXACTAMENTE: "No encontré la dependencia o la serie. Por favor indícalas entre comillas, separadas por coma."

3. RELACIONES JERÁRQUICAS (ORGANIGRAMA):
Si el usuario indica que una Dependencia "depende de", "es hija de", o "está debajo de" otra Dependencia:
- Si la padre NO existe: `actions: []` y responde EXACTAMENTE "La dependencia padre no existe. ¿Deseas crearla primero?".
- Si estás CREANDO la hija ahora mismo: añádele al payload la propiedad `dependeDe` con el "id" de la dependencia padre.
- Si ambas dependencias YA EXISTEN: Emite un evento "UPDATE" para la Dependencia hija afectando en su payload el valor `"dependeDe"` con el id real de la Dependencia Padre.

4. FORMATO ESTRICTO:
Retorna ÚNICAMENTE JSON válido, jamás uses código markdown como ```json. El objeto debe ser:
{{
  "message": "Tu respuesta amistosa y confirmatoria (o el mensaje de error exacto si faltó información)",
  "actions": [
    {{
      "type": "CREATE" | "READ" | "UPDATE" | "DELETE",
      "entity": "dependencias" | "series" | "subseries",
      "id": "ID del objeto o null",
      "payload": {{
         // Datos inventados/reales correspondientes. 
         // IMPORTANTE: Si es CREATE serie, DEBE obligatoriamente tener "dependenciaId".
      }}
    }}
  ]
}}

5. JERARQUÍA MASIVA: Si el usuario manda a crear la dependencia y sus series al mismo tiempo (ej: "Crea dependencia Jurídica y la serie Contratos"), entonces usa un 'id' temporal al Padre (ej: "id": "t1") y pon exactamente ese string "t1" en el atributo 'dependenciaId' del Hijo para que pasen tus propias validaciones lógicas. Y úsalo también para "dependeDe" si hay dependencias hijas nuevas en el mismo batch.

6. ACTUALIZACIONES: Si vas a modificar o hacer DELETE de un registro que ya existe, asocia obligatoriamente el id real del 'ESTADO ACTUAL' en la variable 'id' del Action.
"""
    try:
        from langchain_core.messages import AIMessage
        
        # Build LLM Messages including history
        messages_llm = [SystemMessage(content=system_prompt)]
        
        # Solo mantener el historial más reciente para no exceder tokens (últimos 6 mensajes)
        for h in request.history[-6:]:
            # Ignoramos mensajes del systema del chat (por ejemplo cuando el system dice "Aquí tienes...")
            if h.role == "user":
                messages_llm.append(HumanMessage(content=h.content))
            elif h.role == "agent":
                messages_llm.append(AIMessage(content=h.content))
                
        # Prompt actual
        messages_llm.append(HumanMessage(content=request.prompt))
        
        response = llm.invoke(messages_llm)
        content = response.content.strip()
        
        if content.startswith("```json"):
             content = content[7:]
        if content.startswith("```"):
             content = content[3:]
        if content.endswith("```"):
             content = content[:-3]
        content = content.strip()

        result = json.loads(content)
        return result
    except Exception as e:
        print(f"❌ Error en agent-action: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class ActivationEmailRequest(BaseModel):
    email: str
    nombre: str
    link: str

@router.post("/send-activation")
async def send_activation(request: ActivationEmailRequest):
    """
    Simula el envío de un correo electrónico de activación.
    En producción, aquí se usaría fastapi-mail o un servicio como SendGrid/Resend.
    """
    print("\n" + "="*50)
    print("📧 [MOCK EMAIL SERVICE] - ENVIANDO MENSAJE")
    print(f"PARA: {request.email}")
    print(f"ASUNTO: Activa tu cuenta en OSE - TRD Builder")
    print("-" * 50)
    print(f"Hola {request.nombre},")
    print(f"Has sido invitado a la plataforma OSE.")
    print(f"Para definir tu contraseña y activar tu cuenta, haz clic en:")
    print(f"{request.link}")
    print("-" * 50)
    print("✅ Correo enviado con éxito (Consola)")
    print("="*50 + "\n")
    
    return {"status": "sent", "message": f"Email sent to {request.email}"}

class PasswordResetRequest(BaseModel):
    email: str

class PerformResetRequest(BaseModel):
    token: str
    new_password: str

@router.post("/request-reset")
async def request_reset(request: PasswordResetRequest):
    """
    Simula la solicitud de recuperación de contraseña.
    En producción, buscaría al usuario en DB y enviaría un correo real.
    """
    base_url = os.getenv("VERCEL_URL", "localhost:5173")
    if not base_url.startswith("http"):
        base_url = f"https://{base_url}" if "localhost" not in base_url else f"http://{base_url}"
        
    reset_link = f"{base_url}/?reset_token={token}"
    
    print("\n" + "!"*50)
    print("🔑 [MOCK PASSWORD RESET] - SOLICITUD RECIBIDA")
    print(f"PARA: {request.email}")
    print(f"ENLACE: {reset_link}")
    print("Válido por 1 hora.")
    print("!"*50 + "\n")
    
    return {
        "status": "ok", 
        "message": "Si el correo está registrado, recibirás un enlace de recuperación."
    }

@router.post("/perform-reset")
async def perform_reset(request: PerformResetRequest):
    """
    Simula el proceso final de cambio de contraseña con el token.
    """
    print(f"✅ Contraseña actualizada para token {request.token}")
    return {"status": "success", "message": "Tu contraseña ha sido actualizada correctamente."}

app.include_router(router)

# Root fallback to avoid 404 in root if /api is not matched at Vercel level
@app.get("/")
async def root():
    return {"status": "ok", "message": "OSE Copilot API is running at /api"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
