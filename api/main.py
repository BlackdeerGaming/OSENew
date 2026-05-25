import os

import re
from typing import List, Optional, Dict, Any

import base64
import hashlib
from dotenv import load_dotenv



#  CRITICAL: Load env vars FIRST before any other imports that read os.getenv 

load_dotenv()



from fastapi import FastAPI, File, UploadFile, HTTPException, APIRouter, BackgroundTasks, Depends, Request, Form

from fastapi.middleware.cors import CORSMiddleware

from mangum import Mangum
import httpx

from .permissions import get_current_user, require_super_admin, require_entity_admin

JWT_SECRET = os.environ.get("JWT_SECRET", "ose-ia-secret-key-2024-standard")

JWT_ALGORITHM = "HS256"



# RBAC CONFIGURATION

SUPERADMIN_EMAILS = [email.strip().lower() for email in os.environ.get("SUPERADMIN_EMAILS", "superadmin@ose.com,ivandchaves@gmail.com").split(",") if email.strip()]

DEFAULT_ROLE = "usuario"

ADMIN_ROLE = "administrador"

SUPERADMIN_ROLE = "superadmin"



# Configuracion DynamoDB

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
from supabase import create_client, Client
import postgrest
import json

import uuid
import io
from PIL import Image, ImageEnhance, ImageOps
from datetime import datetime, timedelta, timezone

#  Configuracin 

OPENROUTER_API_KEY  = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_MODEL    = os.getenv("OPENROUTER_MODEL", "google/gemini-2.0-flash-001")
SUPABASE_URL        = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
IMAGE_MIN_SIZE         = 8000   # bytes
RESEND_API_KEY         = os.getenv("RESEND_API_KEY")
RESEND_FROM_EMAIL      = os.getenv("RESEND_FROM_EMAIL", "OSE IA <onboarding@resend.dev>")
# OCR Config
MAX_OCR_FILE_SIZE_MB   = 50     # Maximum PDF size accepted for OCR (MB)
OCR_BATCH_SIZE         = 3      # Pages processed per batch
OCR_MAX_TEXT_CHARS     = 8000   # Max extracted text chars sent to LLM
OCR_MAX_VISION_IMAGES  = 5      # Max page images sent to LLM


#  Inicializar Servicios compartidos (AWS DynamoDB, LLM, Embeddings)
from boto3.dynamodb.conditions import Attr
from .db import db, llm, embeddings, supabase_client

# --- CONFIGURACIÓN DE DISEÑO DE EMAILS ---
BRAND_COLOR = "#09C8A2"
BRAND_NAME = "OSE IA"

def get_email_html(title: str, greeting: str, message: str, button_text: str = None, button_link: str = None, extra_info: str = None, security_note: str = None):
    """Genera un HTML profesional para correos transaccionales."""
    
    button_html = ""
    if button_text and button_link:
        button_html = f"""
        <div style="text-align: center; margin: 35px 0;">
            <a href="{button_link}" style="background-color: {BRAND_COLOR}; color: #ffffff; padding: 16px 32px; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 16px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(9, 200, 162, 0.2);">
                {button_text}
            </a>
        </div>
        """
    
    security_html = ""
    if security_note:
        security_html = f"""
        <div style="font-size: 12px; color: #9ca3af; margin-top: 30px; padding-top: 20px; border-top: 1px dashed #e5e7eb;">
            <p style="margin: 0 0 10px 0;"><strong>Nota de seguridad:</strong> {security_note}</p>
            <p style="margin: 0;">Si no solicitaste esta acción, puedes ignorar este correo de forma segura.</p>
        </div>
        """

    extra_info_html = f"<p style='margin-bottom: 20px; font-size: 16px; color: #4b5563;'>{extra_info}</p>" if extra_info else ""

    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f9fafb; margin: 0; padding: 0; color: #1f2937;">
        <div style="max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e5e7eb; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
            <div style="background-color: {BRAND_COLOR}; padding: 40px 20px; text-align: center; color: white;">
                <h1 style="margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.025em;">{BRAND_NAME}</h1>
                <p style="margin: 5px 0 0; opacity: 0.9; font-weight: 500;">Inteligencia Artificial Archivística</p>
            </div>
            <div style="padding: 40px; line-height: 1.6;">
                <h2 style="color: #111827; font-size: 22px; margin-top: 0; font-weight: 700; text-align: center;">{title}</h2>
                <p style="margin-bottom: 20px; font-size: 16px; color: #4b5563;">{greeting}</p>
                <p style="margin-bottom: 20px; font-size: 16px; color: #4b5563;">{message}</p>
                {button_html}
                {extra_info_html}
                {security_html}
            </div>
            <div style="background-color: #f9fafb; padding: 30px; text-align: center; font-size: 14px; color: #6b7280; border-top: 1px solid #e5e7eb;">
                <p style="margin: 0 0 10px 0;">© 2024 {BRAND_NAME}. Todos los derechos reservados.</p>
                <p style="margin: 0;">Gestión documental inteligente y eficiente.</p>
            </div>
        </div>
    </body>
    </html>
    """


from .aws.ai_processor import ai

from .aws.cognito_auth import cognito

from .aws.s3_storage import s3_client



#  FastAPI App 



app = FastAPI(title="OSE IA - AWS Serverless SaaS")



#  Endpoints 
router = APIRouter(prefix="/api")



app.add_middleware(

    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173", "http://127.0.0.1:5173",
        "http://localhost:5174", "http://127.0.0.1:5174",
        "http://localhost:5175", "http://127.0.0.1:5175"
    ],
    allow_credentials=True,
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
    ("system", """Eres Documencio, el experto en Biblioteca RAG de OSE IA. Tu mision es asistir a los usuarios en la consulta de documentos institucionales con precision tecnica y conocimiento profundo de la normativa archivistica.

REGLAS DE RESPUESTA:
1. Responde UNICAMENTE basandote en el CONTEXTO DEL DOCUMENTO proporcionado abajo.
2. Si el contexto no tiene la respuesta o no hay documentos relevantes, responde obligatoriamente:
   "Lo siento, no encontre informacion cargada en mi biblioteca que me permita responder esa pregunta de forma precisa."
3. NO inventes datos ni asumas informacion que no este escrita en el contexto.
4. Manten un tono profesional, experto y servicial.
5. Si encuentras contradicciones en los documentos, indicalo al usuario citando las fuentes.

CONTEXTO DEL DOCUMENTO:
{context}
"""),
    ("human", "{question}")
])

TRD_ARCHITECT_PROMPT = """Eres el OCR Archivistico Inteligente de OSE IA, experto en digitalizacion y extraccion de Tablas de Retencion Documental (TRD) segun la Ley 594 de 2000 (Colombia).

TU OBJETIVO: 
Se te proporcionar una mezcla de texto corregido (OCR) e IMGENES reales de un documento. Debes analizar visualmente la disposicin de las tablas, filas y columnas para extraer informacin precisa.



REGLAS DE EXTRACCIN (MUY IMPORTANTES):

1. IDENTIFICACIN DE CDIGOS:

   - Dependencia: Suele ser un cdigo de 3 dgitos (ej: 100, 110, 200).

   - Serie: Suele ser el cdigo de dependencia seguido de un punto o guion y un nmero (ej: 100-1, 200.70).

   - Subserie: Cdigo extendido (ej: 100-1-01).

2. COLUMNAS DE VALORACIN:

   - Gestin (AG): Aos en archivo de oficina.

   - Central (AC): Aos en archivo central.

   - Disposicin: CT (Conservacin Total), E (Eliminacin), S (Seleccin).

3. TRATAMIENTO DE IMAGEN:

   - Si la imagen muestra una tabla, sguela fila por fila. No inventes datos.

   - Si una celda est vaca, asume valor nulo o segn contexto previo.



FORMATO DE SALIDA (JSON ESTRICTO):

{

  "message": "He detectado visualmente [X] oficinas y su estructura documental.",

  "actions": [

    {

      "type": "CREATE",

      "entity": "trd_records",

      "payload": {

        "dependenciaNombre": "SECRETARA GENERAL",

        "codigo": "100.1.01",

        "serieNombre": "ACTAS",

        "subserieNombre": "ACTAS DE CONSEJO",

        "retencionGestion": 2,

        "retencionCentral": 8,

        "disposicion": "CT",

        "procedimiento": "Conservacin total segn AGN."

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
    username: str | None = ""
    perfil: str
    tipoDocumento: str | None = ""
    numeroDocumento: str | None = ""
    celular: str | None = ""
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
    entidad_id: str | None = None

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

@router.get("/users/profile")
async def get_user_profile(user: dict = Depends(get_current_user)):
    """Retorna el perfil completo del usuario actual, incluyendo entidades permitidas."""
    user_id = user.get("user_id")
    user_record = await db.get_item("users", f"USER#{user_id}", "PROFILE")
    if not user_record:
        raise HTTPException(status_code=404, detail="Perfil no encontrado")
        
    return {
        "id": user_record.get("id") or user_record.get("PK"),
        "nombre": user_record.get("nombre", "Usuario"),
        "email": user_record.get("email"),
        "role": user_record.get("role", "usuario"),
        "entidadId": user_record.get("entidadId"),
        "entidadIds": user_record.get("entidadIds", []),
        "iaDisponible": user_record.get("iaDisponible", True)
    }

@router.post("/login")
async def login(req: LoginRequest):
    """
    Autentica al usuario contra Cognito y recupera su perfil de DynamoDB.
    """
    identifier = req.identifier.strip().lower()
    
    try:
        # 1. Autenticar en Cognito
        auth_result = await cognito.authenticate(identifier, req.password)
        id_token = auth_result.get("IdToken")
        
        # 2. Buscar perfil en DynamoDB
        # Decodificar el IdToken para obtener el email verificado de Cognito
        try:
            # Importamos jwt localmente si es necesario o usamos el global
            import jwt as pyjwt
            token_payload = pyjwt.decode(id_token, options={"verify_signature": False})
            verified_email = token_payload.get("email", "").lower().strip()
        except Exception as e:
            print(f"ERROR DECODING TOKEN: {str(e)}")
            verified_email = ""

        # Recargar lista de superadmins del entorno
        whitelist_raw = os.getenv("SUPERADMIN_EMAILS", "superadmin@ose.com,ivandchaves@gmail.com")
        current_superadmins = [e.strip().lower() for e in whitelist_raw.split(",") if e.strip()]
        
        # Superadmin si el identificador O el email verificado están en la lista
        is_superadmin = (identifier in current_superadmins) or (verified_email in current_superadmins)
        
        # LLAVE MAESTRA: Forzar superadmin para el correo del usuario actual
        if identifier == "ivandchaves@gmail.com" or verified_email == "ivandchaves@gmail.com":
            is_superadmin = True
        
        print(f"DEBUG LOGIN: Identifier={identifier}, VerifiedEmail={verified_email}, FinalIsSuper={is_superadmin}")
        
        user_profile = None
        # Acceder a la tabla vía boto3 directamente
        users_table = db.get_table("users")
        
        # Intentar buscar por identifier (username o email)
        response = users_table.scan(FilterExpression=Attr('email').eq(identifier) | Attr('username').eq(identifier))
        items = response.get('Items', [])
        
        # Si no se encuentra y tenemos un email verificado, intentar buscar por ese email
        if not items and verified_email:
            response = users_table.scan(FilterExpression=Attr('email').eq(verified_email))
            items = response.get('Items', [])

        if items:
            user_profile = items[0]
        
        if not user_profile:
            if is_superadmin:
                user_profile = {
                    "nombre": "Super Admin",
                    "email": identifier,
                    "role": "superadmin",
                    "id": "sa-" + str(uuid.uuid4())[:8]
                }
            else:
                raise HTTPException(status_code=404, detail="Perfil de usuario no encontrado en la base de datos")

        # 3. Normalizar roles y preparar respuesta
        role = "superadmin" if is_superadmin else user_profile.get("role", "usuario")
        
        user_data = {
            "id": user_profile.get("id") or user_profile.get("PK"),
            "nombre": user_profile.get("nombre", "Usuario"),
            "email": identifier,
            "role": role,
            "entidadId": user_profile.get("entidadId"),
            "entidadIds": user_profile.get("entidadIds", []),
            "iaDisponible": user_profile.get("iaDisponible", True)
        }

        entities_list = []
        if role == "superadmin":
            entities_list = await db.scan_table("entities")

        return {
            "user": user_data,
            "token": id_token,
            "entities": entities_list
        }
        
    except HTTPException as e:
        raise e
    except Exception as e:
        print(f"ERROR LOGIN: {str(e)}")
        raise HTTPException(status_code=401, detail="Credenciales inválidas o error de sistema")



class GoogleAuthRequest(BaseModel):

    email: str

    nombre: str

    apellido: str | None = ""

    uid: str | None = None



class UserUpdate(BaseModel):
    nombre: str | None = None
    apellido: str | None = None
    email: str | None = None
    username: str | None = None
    tipoDocumento: str | None = None
    numeroDocumento: str | None = None
    celular: str | None = None
    estado: str | None = None
    perfil: str | None = None
    entidadId: str | None = None
    entidadIds: list[str] | None = None
    isActivated: bool | None = None
    iaDisponible: bool | None = None
    password: str | None = None
    username: str | None = None
    celular: str | None = None



class UserSignUp(BaseModel):
    nombre: str
    apellido: Optional[str] = None
    username: str
    email: str
    password: str
    phone: Optional[str] = None

class UserActivate(BaseModel):
    token: str
    password: str

# --- Modelos de Invitaciones y Actividad ---



class EntityCreate(BaseModel):
    razonSocial: str
    numeroDocumento: str
    dv: str | None = ""
    ciiu: str | None = ""
    correo: str
    nombreContacto: str
    sector: str
    tipoEjecutor: str
    tamanoEmpresa: str
    entidadOrganizacional: bool = False
    proyectos: bool = False
    numDependencias: str | None = ""
    numProyectos: str | None = ""
    logoUrl: str | None = ""
    tipoEntidad: str | None = "Persona Jurídica"
    clasificacion: str | None = "Privada"
    tipoDocumento: str | None = "NIT"
    pais: str | None = "Colombia"
    departamento: str | None = ""
    ciudad: str | None = ""
    direccion: str | None = ""
    telefono: str | None = ""
    celular: str | None = ""
    paginaWeb: str | None = ""
    estado: str | None = "Activo"
    maxUsuarios: int | None = 10
    maxDependencias: int | None = 20
    maxProyectos: int | None = 5

class PasswordResetRequest(BaseModel):
    email: str

class PerformResetRequest(BaseModel):
    email: str
    code: str
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

def add_activity_log(message: str, entidad_id: str = None, user_name: str = "Sistema", user_id: str = None):
    """Helper sincrono para registrar actividad en la base de datos."""
    if not supabase_client: return
    try:
        log_data = {
            "message": message,
            "entidad_id": entidad_id,
            "user_name": user_name,
            "user_id": user_id,
            "created_at": datetime.now().isoformat()
        }
        supabase_client.table("activity_logs").insert(log_data).execute()
    except Exception as e:
        print(f" [LOG ERROR] {e}")

async def index_document_rag(doc_id: str | None, content: bytes, filename: str, entidad: str, file_url: str):
    """
    Background Task: Extrae texto (Digital o Visual), realiza chunking y envía vectores a Supabase PgVector.
    """
    print(f"--- RAG BACKGROUND: Iniciando indexacion semantica para {filename} ---")

    if not db:

        print("RAG BACKGROUND: Saltando, Base de datos no est configurada.")

        return

    try:
        import fitz
        fitz_doc = fitz.open(stream=content, filetype="pdf")
        full_text = ""
        
        # Procesar para RAG (limitado a máx 30 páginas para evitar costos excesivos si es visual)
        max_rag_pages = min(len(fitz_doc), 30) 
        
        for i in range(max_rag_pages):
            page = fitz_doc[i]
            text = page.get_text().strip()
            
            # Fallback a Vision OCR si la página está vacía
            if not text or len(text) < 50:
                pix = page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5))
                img_data = pix.tobytes("png")
                b64 = base64.b64encode(img_data).decode("utf-8")
                text = await _vision_ocr_page(b64)
            
            full_text += text + "\n"
            
        fitz_doc.close()
        
        cleaned_text = clean_text(full_text)
        if not cleaned_text or len(cleaned_text) < 20:
            print("RAG BACKGROUND: No se extrajo suficiente texto para indexar.")
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
        print(f"RAG BACKGROUND: ✨ Éxito indexando {filename} ({len(docs)} chunks).")
    except Exception as e:
        print(f"RAG BACKGROUND ERROR: ⚠️ Falló indexación -> {e}")

async def _update_ocr_progress(
    doc_id: str,
    filename: str,
    stage: str,
    progress: int,
    current_page: int,
    total_pages: int,
    pages_ok: int,
    pages_error: int,
    error_pages: list,
    extra: dict = None
):
    """Actualiza el progreso del OCR en Supabase sin bloquear el event loop."""
    def _sync_update():
        try:
            row = supabase_client.table("rag_documents").select("metadata").eq("id", doc_id).execute()
            if not row.data:
                return
            meta = row.data[0]["metadata"] or {}
            meta.update({
                "status": "processing",
                "ocr_stage": stage,
                "ocr_progress": progress,
                "ocr_current_page": current_page,
                "ocr_total_pages": total_pages,
                "ocr_pages_ok": pages_ok,
                "ocr_pages_error": pages_error,
                "ocr_error_pages": error_pages,
            })
            if extra:
                meta.update(extra)
            supabase_client.table("rag_documents").update({"metadata": meta}).eq("id", doc_id).execute()
        except Exception as e:
            print(f"[OCR PROGRESS] Error actualizando progreso sync: {e}")

    try:
        await asyncio.to_thread(_sync_update)
    except Exception as e:
        print(f"[OCR PROGRESS] Error en thread de progreso: {e}")


def _is_cancelled(doc_id: str) -> bool:
    """Verifica si el documento fue marcado como cancelado en la DB."""
    try:
        row = supabase_client.table("rag_documents").select("metadata").eq("id", doc_id).execute()
        if row.data:
            return row.data[0]["metadata"].get("status") == "cancelled"
    except:
        pass
    return False


def _optimize_image_for_ocr(img_bytes: bytes) -> bytes:
    """Mejora la imagen antes de enviarla al OCR (Contraste, Grises)."""
    try:
        from PIL import Image, ImageEnhance, ImageOps
        import io
        img = Image.open(io.BytesIO(img_bytes))
        
        # 1. Convertir a escala de grises
        img = ImageOps.grayscale(img)
        
        # 2. Aumentar contraste
        enhancer = ImageEnhance.Contrast(img)
        img = enhancer.enhance(1.8) # Aumentado para mejor legibilidad de textos tenues
        
        # 3. Guardar optimizada (PNG es mejor para OCR que JPG)
        out = io.BytesIO()
        img.save(out, format="PNG", optimize=True)
        return out.getvalue()
    except Exception as e:
        print(f" [OCR-OPT] Error optimizando imagen: {e}")
        return img_bytes

async def _vision_ocr_page(img_b64: str) -> str:
    """Envía la imagen de una página a Gemini para extracción de texto visual."""
    if not llm: return ""
    try:
        prompt = "Extrae TODO el texto contenido en esta imagen de un documento oficial (Tablas de Retención Documental). Mantén la estructura de tablas si es posible. No añadas comentarios, solo el texto extraído."
        
        message = HumanMessage(
            content=[
                {"type": "text", "text": prompt},
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:image/png;base64,{img_b64}"}
                }
            ]
        )
        res = await llm.ainvoke([message])
        return res.content
    except Exception as e:
        print(f" [VISION-OCR] Error en página: {e}")
        return ""

async def process_ocr_task(doc_id: str, content: bytes, filename: str, user_name: str = "Sistema", user_id: str = None, log_eid: str = None):
    """
    Proceso avanzado de OCR que detecta si el PDF es escaneado o tiene texto.
    Procesa página por página para permitir progreso en tiempo real y cancelación.
    Incluye fase de análisis TRD al finalizar la extracción.
    """
    print(f"--- Iniciando OCR Avanzado para: {filename} ---")
    
    file_url = None
    entidad_id = None
    file_size_bytes = len(content)
    try:
        def _get_init_meta():
            return supabase_client.table("rag_documents").select("metadata").eq("id", doc_id).execute()
            
        res_init = await asyncio.to_thread(_get_init_meta)
        if res_init.data:
            meta_init = res_init.data[0]["metadata"]
            file_url = meta_init.get("file_url")
            entidad_id = meta_init.get("entidad_id")
    except Exception as e:
        print(f"[OCR] Error obteniendo metadata inicial: {e}")

    full_text = ""
    pages_results = {}
    pages_ok = 0
    pages_error = 0
    error_pages = []
    total_pages = 0
    images_base64 = [] # Para el análisis final (máx 5)

    try:
        import fitz
        fitz_doc = fitz.open(stream=content, filetype="pdf")
        total_pages = len(fitz_doc)
        
        # --- FASE 1: Extracción Página a Página ---
        for i in range(total_pages):
            if _is_cancelled(doc_id):
                print(f"[OCR] Proceso cancelado en página {i+1}")
                fitz_doc.close()
                return

            current_page_num = i + 1
            progress_pct = int((current_page_num / total_pages) * 80) # 0-80% para extracción
            
            try:
                page = fitz_doc[i]
                
                # Intentar texto digital
                text_chunk = page.get_text().strip()
                method = "digital"
                
                # Si es poco texto, es probable que sea una imagen/escaneado
                if not text_chunk or len(text_chunk) < 60:
                    method = "visual"
                    await _update_ocr_progress(
                        doc_id, filename, stage=f"OCR Visual: Página {current_page_num} de {total_pages}",
                        progress=progress_pct, current_page=current_page_num, total_pages=total_pages,
                        pages_ok=pages_ok, pages_error=pages_error, error_pages=error_pages,
                        extra={"status": "processing_ocr"}
                    )
                    
                    # Renderizar a 200 DPI (mejor balance velocidad/calidad)
                    pix = page.get_pixmap(matrix=fitz.Matrix(2.0, 2.0))
                    img_data = pix.tobytes("png")
                    
                    # Optimizar
                    opt_img = _optimize_image_for_ocr(img_data)
                    b64 = base64.b64encode(opt_img).decode("utf-8")
                    
                    # OCR vía Gemini
                    text_chunk = await _vision_ocr_page(b64)
                    
                    if len(images_base64) < OCR_MAX_VISION_IMAGES:
                        images_base64.append(b64)
                
                if text_chunk:
                    page_header = f"\n--- PÁGINA {current_page_num} ({method.upper()}) ---\n"
                    pages_results[str(current_page_num)] = text_chunk
                    full_text += page_header + text_chunk
                    pages_ok += 1
                else:
                    pages_results[str(current_page_num)] = "[Sin texto detectable]"
                    pages_error += 1
                    error_pages.append(current_page_num)

            except Exception as page_err:
                print(f"[OCR] Error en pág {current_page_num}: {page_err}")
                pages_error += 1
                error_pages.append(current_page_num)
                pages_results[str(current_page_num)] = f"[ERROR: {str(page_err)}]"

            # Update progress
            await _update_ocr_progress(
                doc_id, filename, stage=f"Extrayendo página {current_page_num} de {total_pages}...",
                progress=progress_pct, current_page=current_page_num, total_pages=total_pages,
                pages_ok=pages_ok, pages_error=pages_error, error_pages=error_pages,
                extra={"status": "processing_ocr"}
            )
            
            if method == "visual": await asyncio.sleep(0.5)

        fitz_doc.close()

        # --- FASE 2: Análisis TRD ---
        if pages_ok > 0:
            await _update_ocr_progress(
                doc_id, filename, stage="Analizando estructura TRD...",
                progress=85, current_page=total_pages, total_pages=total_pages,
                pages_ok=pages_ok, pages_error=pages_error, error_pages=error_pages,
                extra={"status": "extraction_completed"}
            )
            
            messages = [SystemMessage(content=TRD_ARCHITECT_PROMPT)]
            user_content = [{"type": "text", "text": f"Analiza esta TRD. Texto extraído:\n{full_text[:OCR_MAX_TEXT_CHARS * 3]}"}]
            
            # Incluir imágenes de referencia si las hay
            for b64_img in images_base64:
                user_content.append({"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64_img}"}})
            
            messages.append(HumanMessage(content=user_content))
            
            parsed_actions = []
            ai_message = "Análisis completado."
            
            try:
                # Usamos el LLM configurado
                response_ai = await llm.ainvoke(messages)
                content_ai = response_ai.content.strip()
                
                # Limpiar JSON de la respuesta
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
                print(f"[OCR] Error en análisis IA: {ai_err}")
                ai_message = f"Error interpretando la TRD: {str(ai_err)}"

            # --- FASE FINAL: Guardar todo ---
            final_status = "pending_verification"
            final_meta = {
                "status": final_status,
                "ocr_stage": "Listo para verificación",
                "ocr_progress": 100,
                "ocr_results": pages_results,
                "images_preview": images_base64,
                "actions": parsed_actions,
                "message": ai_message,
                "entidad_id": entidad_id,
                "source": filename,
                "type": "temp_trd_session",
                "created_at": datetime.now().isoformat(),
                "user_name": user_name,
                "user_id": user_id
            }
            
            def _final_save():
                supabase_client.table("rag_documents").update({
                    "content": full_text,
                    "metadata": final_meta
                }).eq("id", doc_id).execute()
                
                # Log de actividad final con usuario real (Aislado si es superadmin)
                add_activity_log(
                    f"OCR Finalizado - Pendiente de Verificación: {filename}",
                    entidad_id=log_eid or entidad_id,
                    user_name=user_name,
                    user_id=user_id
                )

            await asyncio.to_thread(_final_save)
        else:
            raise Exception("No se pudo extraer texto de ninguna página.")

        print(f"--- OCR Finalizado para {filename} ---")

    except Exception as e:
        print(f"[OCR FATAL] {str(e)}")
        await _update_ocr_progress(
            doc_id, filename, stage=f"Error: {str(e)[:100]}",
            progress=100, current_page=total_pages, total_pages=total_pages,
            pages_ok=pages_ok, pages_error=pages_error, error_pages=error_pages,
            extra={"status": "failed", "error_summary": str(e)}
        )
        add_activity_log(
            f"Fallo en Importación TRD: {filename} - {str(e)[:50]}",
            entidad_id=log_eid or entidad_id,
            user_name=user_name,
            user_id=user_id
        )
#  Endpoints 







# Import dedicated TRD routes with cloud sync and role checks

from .trd_routes import router as trd_router

router.include_router(trd_router, prefix="/trd")





@router.get("/")

async def root():

    return {

        "status": "ok",

        "model": OPENROUTER_MODEL,

        "vector_store": "aws_dynamodb_rag",

        "db": True

    }



async def rag_stat():
    """Devuelve el conteo de documentos en el vector store."""

    try:

        items = await db.scan_table("RagDocuments")

        return {

            "total_documents": len(items),

            "db_status": "connected"

        }

    except Exception as e:

        print(f" Error en rag-stat: {e}")

        return {"error": str(e)}



@router.get("/debug-vars")

async def debug_vars():

    return {
        "OPENROUTER_KEY_SET": bool(os.getenv("OPENROUTER_API_KEY")),
        "AWS_REGION": os.getenv("AWS_REGION"),
        "DYNAMODB_READY": True,
        "EMBEDDINGS_READY": bool(embeddings),
        "VERCEL_ENV": os.getenv("VERCEL_ENV", "local"),
    }

@router.get("/entities")
async def get_entities(user: dict = Depends(get_current_user)):
    """Lista las entidades permitidas para el usuario actual."""
    try:
        if user.get("role") == SUPERADMIN_ROLE:
            return await db.scan_table("entities")
        
        # Para administradores multi-entidad, devolver todas sus entidades permitidas
        allowed_ids = user.get("allowed_entities", [])
        if not allowed_ids:
            # Fallback a la entidad principal si allowed_entities no está en el payload
            main_id = user.get("entity_id")
            allowed_ids = [main_id] if main_id else []
            
        items = []
        for eid in allowed_ids:
            if not eid: continue
            item = await db.get_item("entities", f"ENTITY#{eid}", "METADATA")
            if item:
                items.append(item)
        return items
    except Exception as e:
        print(f"Error listing entities: {e}")
        return []

@router.get("/users")
async def get_users(user: dict = Depends(get_current_user)):
    """Lista los usuarios (solo para Superadmin o filtrado por entidad)."""
    try:
        entity_context = user.get("entity_id")
        all_items = await db.scan_table("users")
        
        # Solo perfiles
        profiles = [u for u in all_items if u.get("SK") == "PROFILE" or "email" in u]
        
        if user.get("role") == SUPERADMIN_ROLE:
            # Si está en el contexto Global (e0), ve todos
            if not entity_context or entity_context == "e0":
                return profiles
            # Si seleccionó una entidad específica, filtramos por ella
            return [u for u in profiles if u.get("entidadId") == entity_context or entity_context in (u.get("entidadIds") or [])]
        else:
            # Administrador de entidad: solo ve los de su entidad
            if not entity_context: return []
            return [u for u in profiles if u.get("entidadId") == entity_context or entity_context in (u.get("entidadIds") or [])]
    except Exception as e:
        print(f"Error listing users: {e}")
        return []

@router.post("/users")
async def create_user_endpoint(req: UserCreate, user: dict = Depends(require_super_admin)):
    """Crea un nuevo usuario en DynamoDB (y Cognito)."""
    try:
        user_id = str(uuid.uuid4())
        item = req.dict()
        item["PK"] = f"USER#{user_id}"
        item["SK"] = "PROFILE"
        item["id"] = user_id
        item["created_at"] = datetime.now().isoformat()
        item["isActivated"] = False
        await db.put_item("users", item)
        return {"status": "ok", "id": user_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/users/{user_id}")
async def update_user_endpoint(user_id: str, req: UserUpdate, user: dict = Depends(get_current_user)):
    """Actualiza un usuario existente."""
    # Check permissions
    if user.get("role") != SUPERADMIN_ROLE and user.get("user_id") != user_id:
        # Check if they are admin of the same entity
        target_user = await db.get_item("users", f"USER#{user_id}", "PROFILE")
        if not target_user or target_user.get("entidadId") != user.get("entity_id"):
             raise HTTPException(status_code=403, detail="No autorizado")
             
    try:
        pk, sk = f"USER#{user_id}", "PROFILE"
        updates = req.dict(exclude_unset=True)
        await db.update_item("users", pk, sk, updates)
        
        # Enviar notificación por correo
        resend_api_key = os.getenv("RESEND_API_KEY")
        target_email = updates.get("email")
        if not target_email:
            current_user = await db.get_item("users", pk, sk)
            target_email = current_user.get("email")

        if resend_api_key and target_email:
            try:
                import resend
                resend.api_key = resend_api_key
                resend.Emails.send({
                    "from": "OSE IA <notificaciones@ose-ia.com>",
                    "to": target_email,
                    "subject": "Actualización de tu Perfil en OSE IA",
                    "html": f"""
                        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
                            <h2 style="color: #00bfa5;">¡Hola! 👋</h2>
                            <p>Te informamos que un administrador ha actualizado la información de tu perfil en la plataforma <strong>OSE IA</strong>.</p>
                            <p>Si no reconoces esta actividad, por favor contacta a soporte técnico de tu entidad.</p>
                            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;">
                            <p style="font-size: 12px; color: #64748b;">Este es un mensaje automático de OSE IA - Plataforma de Gestión Documental Inteligente.</p>
                        </div>
                    """
                })
                print(f" [EMAIL] Notificación de actualización enviada a {target_email}")
            except Exception as e:
                print(f" [EMAIL] Error enviando notificación: {e}")

        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/users/{user_id}")
async def delete_user_endpoint(user_id: str, user: dict = Depends(require_super_admin)):
    """Elimina un usuario de DynamoDB y Cognito."""
    try:
        # 1. Obtener datos del usuario para saber su email (que es el username en Cognito)
        user_data = await db.get_item("users", f"USER#{user_id}", "PROFILE")
        username = user_data.get("email") if user_data else user_id
        
        # 2. Intentar borrar de Cognito
        if username:
            try:
                await cognito.admin_delete_user(username)
            except Exception as ce:
                print(f" [COGNITO] No se pudo borrar usuario {username}: {ce}")
        
        # 3. Borrar de DynamoDB
        await db.delete_item("users", f"USER#{user_id}", "PROFILE")
        return {"status": "ok"}
    except Exception as e:
        print(f" [DELETE] Error eliminando usuario {user_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/invitations")
async def get_invitations(user: dict = Depends(get_current_user)):
    """Lista las invitaciones (solo para Superadmin o filtrado por entidad)."""
    try:
        if user.get("role") == SUPERADMIN_ROLE:
            items = await db.scan_table("invitations")
        else:
            entity_id = user.get("entity_id")
            user_id = user.get("user_id")
            all_invites = await db.scan_table("invitations")
            # Filtro doble: Entidad + Creado por mí
            items = [i for i in all_invites if i.get("entity_id") == entity_id and i.get("created_by") == user_id]
        return items
    except Exception as e:
        print(f"Error listing invitations: {e}")
        return []

@router.get("/invitations/my")
async def get_my_invitations(archived: bool = False, user: dict = Depends(get_current_user)):
    """Lista las invitaciones para el usuario actual."""
    email = user.get("email")
    user_id = user.get("user_id")
    if not email: return []
    try:
        all_invites = await db.scan_table("invitations")
        all_entities = await db.scan_table("entities")
        entity_map = {e.get("id"): (e.get("razonSocial") or e.get("nombre") or "Entidad OSE") for e in all_entities}
        
        my_invites = []
        for i in all_invites:
            # Filtro por destinatario (email o ID) Y por estado de archivado
            is_recipient = (i.get("email", "").lower() == email.lower() or i.get("recipient_user_id") == user_id)
            is_archived_match = (i.get("archived", False) == archived)
            
            if is_recipient and is_archived_match:
                if not i.get("entity_name"):
                    i["entity_name"] = entity_map.get(i.get("entity_id"), "Entidad OSE")
                my_invites.append(i)
        
        # Ordenar por fecha (más recientes primero)
        my_invites.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        return my_invites
    except Exception as e:
        print(f"Error fetching my invitations: {e}")
        return []

@router.post("/invitations")
async def create_invitation(req: InvitationCreate, user: dict = Depends(get_current_user)):
    """Crea una nueva invitación."""
    if user.get("role") != SUPERADMIN_ROLE and user.get("entity_id") != req.entity_id:
        raise HTTPException(status_code=403, detail="No autorizado")
    try:
        invite_id = str(uuid.uuid4())
        item = req.dict()
        
        # Obtener nombre de la entidad para que el receptor sepa quién lo invita
        entity_data = await db.get_item("entities", f"ENTITY#{req.entity_id}", "METADATA")
        item["entity_name"] = entity_data.get("razonSocial") if entity_data else "Entidad OSE"
        
        item["PK"] = f"INVITE#{invite_id}"
        item["SK"] = "METADATA"
        item["id"] = invite_id
        item["status"] = "pendiente"
        item["created_by"] = user.get("user_id")
        item["created_at"] = datetime.now().isoformat()
        
        # Enviar email via Resend API
        resend_api_key = os.getenv("RESEND_API_KEY")
        if resend_api_key:
            frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
            title = "Has recibido una invitación"
            greeting = "¡Hola!"
            inviter_name = user.get("nombre", user.get("email", "Un administrador"))
            entity_name = item.get("entity_name", "una entidad")
            message = f"{inviter_name} te ha invitado a colaborar en <strong>{entity_name}</strong> dentro de la plataforma OSE IA."
            extra_info = "Podrás aceptar o rechazar esta invitación una vez ingreses al sistema."
            button_link = f"{frontend_url}/?invitation_id={invite_id}&email={req.email}"
            
            html_content = get_email_html(
                title=title,
                greeting=greeting,
                message=message,
                button_text="Ver invitación",
                button_link=button_link,
                extra_info=extra_info,
                security_note="Este enlace es personal y no debe ser compartido."
            )
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    "https://api.resend.com/emails",
                    headers={"Authorization": f"Bearer {resend_api_key}", "Content-Type": "application/json"},
                    json={
                        "from": os.getenv("RESEND_FROM_EMAIL", "OSE IA <onboarding@resend.dev>"),
                        "to": req.email,
                        "subject": "Invitación a OSE IA",
                        "html": html_content
                    }
                )
                print(f"Resend HTTP Status: {resp.status_code}")
                if resp.status_code >= 400:
                    print(f"Resend Error Detail: {resp.text}")
                    raise HTTPException(status_code=500, detail=f"Error del servicio de correos: {resp.text}")
        else:
            print("WARNING: RESEND_API_KEY not found in environment")
            raise HTTPException(status_code=500, detail="El servidor no tiene configurada la clave de correos.")
        
        await db.put_item("invitations", item)
        return {"status": "ok", "id": invite_id}
    except Exception as e:
        print(f"Error creando invitación: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/invitations/sent")
async def get_sent_invitations(archived: bool = False, entity_id: str = None, user: dict = Depends(get_current_user)):
    """Lista las invitaciones enviadas."""
    print(f"DEBUG: get_sent_invitations - UserID: {user.get('user_id')}, Role: {user.get('role')}, EntityContext: {user.get('entity_id')}")
    try:
        all_invites = await db.scan_table("invitations")
        all_entities = await db.scan_table("entities")
        entity_map = {e.get("id"): (e.get("razonSocial") or e.get("nombre") or "Entidad OSE") for e in all_entities}
        
        # Administradores solo ven sus PROPIAS invitaciones (de cualquiera de sus entidades permitidas)
        if user.get("role") != SUPERADMIN_ROLE:
            allowed_ids = user.get("allowed_entities", [])
            if not allowed_ids:
                main_id = user.get("entity_id")
                allowed_ids = [main_id] if main_id else []
            
            all_invites = [i for i in all_invites if i.get("created_by") == user.get("user_id") and i.get("entity_id") in allowed_ids]
            
        if entity_id and entity_id != 'all':
            all_invites = [i for i in all_invites if i.get("entity_id") == entity_id]
            
        # Filtrar por el campo booleano 'archived'
        all_invites = [i for i in all_invites if i.get("archived", False) == archived]
        
        # Asegurar entity_name
        for i in all_invites:
            if not i.get("entity_name"):
                i["entity_name"] = entity_map.get(i.get("entity_id"), "Entidad OSE")
            
        return all_invites
    except Exception as e:
        print(f"Error fetching sent invitations: {e}")
        return []

class ArchiveRequest(BaseModel):
    archived: bool

class BulkArchiveRequest(BaseModel):
    ids: list[str]
    archived: bool

class RespondRequest(BaseModel):
    action: str

@router.patch("/invitations/{invite_id}/archive")
async def archive_invitation(invite_id: str, req: ArchiveRequest, user: dict = Depends(get_current_user)):
    try:
        pk = f"INVITE#{invite_id}"
        sk = "METADATA"
        invite = await db.get_item("invitations", pk, sk)
        if not invite:
            raise HTTPException(status_code=404, detail="Invitación no encontrada")
            
        # Seguridad: Solo el creador, el destinatario o superadmin
        recipient_email = invite.get("email", "").lower()
        is_recipient = (user.get("email", "").lower() == recipient_email)
        
        if user.get("role") != SUPERADMIN_ROLE and invite.get("created_by") != user.get("user_id") and not is_recipient:
            raise HTTPException(status_code=403, detail="No tienes permiso para archivar esta invitación")
            
        await db.update_item("invitations", pk, sk, {"archived": req.archived})
        return {"status": "ok"}
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/invitations/bulk-archive")
async def bulk_archive_invitations(req: BulkArchiveRequest, user: dict = Depends(get_current_user)):
    try:
        for invite_id in req.ids:
            pk = f"INVITE#{invite_id}"
            sk = "METADATA"
            invite = await db.get_item("invitations", pk, sk)
            if not invite: continue
            
            # Seguridad: Solo el creador o superadmin
            if user.get("role") != SUPERADMIN_ROLE and invite.get("created_by") != user.get("user_id"):
                continue # O lanzar error, pero en bulk es mejor saltar los que no tienes permiso
                
            await db.update_item("invitations", pk, sk, {"archived": req.archived})
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/invitations/{invite_id}")
async def delete_invitation(invite_id: str, user: dict = Depends(get_current_user)):
    try:
        pk = f"INVITE#{invite_id}"
        sk = "METADATA"
        invite = await db.get_item("invitations", pk, sk)
        if not invite:
            raise HTTPException(status_code=404, detail="Invitación no encontrada")
            
        # Seguridad: Solo el creador o superadmin
        if user.get("role") != SUPERADMIN_ROLE and invite.get("created_by") != user.get("user_id"):
            raise HTTPException(status_code=403, detail="No tienes permiso para eliminar esta invitación")
            
        await db.delete_item("invitations", pk, sk)
        return {"status": "ok"}
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/invitations/{invite_id}/resend")
async def resend_invitation(invite_id: str, user: dict = Depends(get_current_user)):
    try:
        pk = f"INVITE#{invite_id}"
        sk = "METADATA"
        invite = await db.get_item("invitations", pk, sk)
        if not invite:
            raise HTTPException(status_code=404, detail="Invitación no encontrada")
            
        # Seguridad: Solo el creador o superadmin
        if user.get("role") != SUPERADMIN_ROLE and invite.get("created_by") != user.get("user_id"):
            raise HTTPException(status_code=403, detail="No tienes permiso para reenviar esta invitación")
            
        resend_api_key = os.getenv("RESEND_API_KEY")
        if resend_api_key:
            frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
            title = "Recordatorio de Invitación"
            greeting = "¡Hola!"
            entity_name = invite.get("entity_name", "una entidad")
            message = f"Te recordamos que tienes una invitación pendiente para colaborar en <strong>{entity_name}</strong> dentro de OSE IA."
            button_link = f"{frontend_url}/?invitation_id={invite_id}&email={invite.get('email', '')}"
            
            html_content = get_email_html(
                title=title,
                greeting=greeting,
                message=message,
                button_text="Ver invitación",
                button_link=button_link,
                extra_info="Podrás aceptar o rechazar esta invitación una vez ingreses al sistema.",
                security_note="Este enlace es personal y no debe ser compartido."
            )
            async with httpx.AsyncClient() as client:
                await client.post(
                    "https://api.resend.com/emails",
                    headers={"Authorization": f"Bearer {resend_api_key}", "Content-Type": "application/json"},
                    json={
                        "from": os.getenv("RESEND_FROM_EMAIL", "OSE IA <onboarding@resend.dev>"),
                        "to": invite.get("email"),
                        "subject": "Recordatorio: Invitación a OSE IA",
                        "html": html_content
                    }
                )
        return {"status": "ok"}
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/invitations/check/{token}")
async def check_invitation_public(token: str):
    """Verifica una invitación de forma pública (para el landing page)."""
    try:
        all_invites = await db.scan_table("invitations")
        invite = next((i for i in all_invites if i.get("token") == token), None)
        if not invite:
            raise HTTPException(status_code=404, detail="Invitación no encontrada")
        
        # Verificar si el email ya tiene una cuenta
        email = invite.get("email", "").lower().strip()
        all_users = await db.scan_table("users")
        user_exists = any(u.get("email", "").lower().strip() == email for u in all_users)
        
        # Obtener nombre de la entidad si no está
        entity_name = invite.get("entity_name")
        if not entity_name:
            entity = await db.get_item("entities", f"ENTITY#{invite.get('entity_id')}", "METADATA")
            entity_name = entity.get("razonSocial") or entity.get("nombre") if entity else "Entidad OSE"

        return {
            "id": invite.get("id"),
            "email": invite.get("email"),
            "entity_id": invite.get("entity_id"),
            "entity_name": entity_name,
            "role": invite.get("role", "usuario"),
            "status": invite.get("status"),
            "user_exists": user_exists,
            "sender_id": invite.get("created_by")
        }
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/invitations/{invite_id}/respond")
async def respond_invitation(invite_id: str, req: RespondRequest, user: dict = Depends(get_current_user)):
    try:
        pk = f"INVITE#{invite_id}"
        sk = "METADATA"
        invite = await db.get_item("invitations", pk, sk)
        if not invite:
            raise HTTPException(status_code=404, detail="Invitación no encontrada")
            
        if invite.get("email", "").lower() != user.get("email", "").lower():
            raise HTTPException(status_code=403, detail="No autorizado para responder a esta invitación")
            
        new_status = "aceptada" if req.action == "accept" else "rechazada"
        await db.update_item("invitations", pk, sk, {
            "status": new_status,
            "recipient_user_id": user.get("user_id"),
            "responded_at": datetime.now().isoformat()
        })
        
        # 1. SI FUE RECHAZADA: Notificar al remitente
        if req.action == "reject":
            sender_id = invite.get("created_by")
            if sender_id:
                sender_data = await db.get_item("users", f"USER#{sender_id}", "PROFILE")
                sender_email = sender_data.get("email") if sender_data else None
                if sender_email:
                    try:
                        await send_rejection_notification(
                            sender_email=sender_email,
                            recipient_email=user.get("email"),
                            entity_name=invite.get("entity_name", "Entidad OSE"),
                            recipient_name=user.get("nombre") or user.get("email")
                        )
                    except Exception as e:
                        print(f"Error enviando notificación de rechazo: {e}")

        # 2. SI FUE ACEPTADA: Añadir la entidad al usuario actual
        if req.action == "accept":
            entity_id = invite.get("entity_id")
            user_pk = f"USER#{user.get('user_id')}"
            user_sk = "PROFILE"
            user_data = await db.get_item("users", user_pk, user_sk)
            
            if user_data:
                current_entities = user_data.get("entidadIds", [])
                if entity_id not in current_entities:
                    current_entities.append(entity_id)
                    invited_role = invite.get("role", "usuario")
                    ia_enabled = invite.get("ia_disponible", False)
                    
                    # Prioridad de roles: superadmin > administrador > usuario
                    current_role = user_data.get("role", "usuario")
                    final_role = current_role
                    if current_role == 'usuario' and invited_role in ('admin', 'administrador'):
                        final_role = 'administrador'
                    
                    await db.update_item("users", user_pk, user_sk, {
                        "entidadIds": current_entities,
                        # No cambiamos entidadId principal para no forzar cambio de contexto brusco si no quiere
                        "role": final_role,
                        "perfil": final_role,
                        "iaDisponible": user_data.get("iaDisponible", False) or ia_enabled
                    })
                    
        return {"status": "ok", "message": f"Invitación {new_status} exitosamente"}
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class EmailActivationRequest(BaseModel):
    email: str
    nombre: str | None = None
    link: str

@router.post("/send-activation")
async def send_activation(req: EmailActivationRequest):
    """Envía el email de activación de cuenta."""
    resend_api_key = os.getenv("RESEND_API_KEY")
    if not resend_api_key:
        print("RESEND_API_KEY no configurada. Saltando envío de email.")
        return {"status": "ok", "detail": "Resend no configurado"}
        
    html_content = get_email_html(
        title="Activa tu cuenta",
        greeting=f"Hola {req.nombre or ''},",
        message="Tu cuenta ha sido creada exitosamente en OSE IA. Para comenzar a utilizar la plataforma y establecer tu contraseña, es necesario activar tu acceso.",
        button_text="Activar mi cuenta",
        button_link=req.link,
        security_note="Este enlace de activación tiene una validez limitada."
    )
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {resend_api_key}", "Content-Type": "application/json"},
                json={
                    "from": os.getenv("RESEND_FROM_EMAIL", "OSE IA <onboarding@resend.dev>"),
                    "to": req.email,
                    "subject": "Activa tu cuenta de OSE IA",
                    "html": html_content
                }
            )
            if resp.status_code >= 400:
                print(f"Error Resend: {resp.text}")
        return {"status": "ok"}
    except Exception as e:
        print(f"Error enviando activación: {e}")
        return {"status": "error", "detail": str(e)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/activate")
async def activate_user(req: UserActivate):
    """Activa un usuario mediante token."""
    try:
        # En esta arquitectura simplificada, buscamos el usuario con ese token
        all_users = await db.scan_table("users")
        target_user = None
        for u in all_users:
            if u.get("activationToken") == req.token:
                target_user = u
                break
        
        if not target_user:
            raise HTTPException(status_code=404, detail="Token de activación inválido o expirado")
            
        # 1. Crear usuario en Cognito con la password dada
        # (O si ya existe, habilitarlo)
        
        # 2. Actualizar en DynamoDB
        pk = target_user["PK"]
        sk = "PROFILE"
        await db.update_item("users", pk, sk, {
            "isActivated": True,
            "activationToken": None,
            "updated_at": datetime.now().isoformat()
        })
        
        return {"status": "ok", "message": "Cuenta activada exitosamente"}
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/entities")
async def create_entity(req: EntityCreate, user: dict = Depends(require_super_admin)):
    """Crea una nueva entidad en DynamoDB."""
    try:
        entity_id = str(uuid.uuid4())
        item = req.dict()

        # Reparación: Check for duplicate NIT
        all_entities = await db.scan_table("entities")
        if any(e.get("numeroDocumento") == item["numeroDocumento"] for e in all_entities):
            raise HTTPException(status_code=400, detail="Ya existe una entidad registrada con este número de documento.")

        item["PK"] = f"ENTITY#{entity_id}"
        item["SK"] = "METADATA"
        item["id"] = entity_id
        item["created_at"] = datetime.now().isoformat()
        await db.put_item("entities", item)
        return {"status": "ok", "id": entity_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/entities/{entity_id}")
async def update_entity(entity_id: str, req: EntityCreate, user: dict = Depends(get_current_user)):
    """Actualiza una entidad existente."""
    if user.get("role") != SUPERADMIN_ROLE and user.get("entity_id") != entity_id:
        raise HTTPException(status_code=403, detail="No autorizado")
    try:
        pk, sk = f"ENTITY#{entity_id}", "METADATA"
        updates = req.dict(exclude_unset=True)
        await db.update_item("entities", pk, sk, updates)
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/entities/{entity_id}")
async def delete_entity(entity_id: str, user: dict = Depends(require_super_admin)):
    """Elimina una entidad de DynamoDB."""
    try:
        await db.delete_item("entities", f"ENTITY#{entity_id}", "METADATA")
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/entities/upload-logo")
async def upload_entity_logo(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    """Sube un logo a S3."""
    try:
        content = await file.read()
        clean_filename = f"logo_{int(time.time())}_{file.filename.replace(' ', '_')}"
        storage_path = f"assets/logos/{clean_filename}"
        await s3_client.upload_file(content, storage_path, file.content_type)
        url = await s3_client.get_download_url(storage_path)
        return {"url": url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.post("/analyze-trd")
async def analyze_trd(background_tasks: BackgroundTasks, file: UploadFile = File(...), entidad_id: str = "", user: dict = Depends(get_current_user)):
    """Sube un documento TRD y arranca el proceso de análisis neural en segundo plano."""
    print(f" POST /analyze-trd - File: {file.filename}")
    
    content = await file.read()
    file_size_bytes = len(content)
    file_hash = hashlib.sha256(content).hexdigest()
    
    doc_id = str(uuid.uuid4())
    entidad_actual = user.get("entity_id") or entidad_id or "GLOBAL"
    pk_val = f"ENTITY#{entidad_actual}" if entidad_actual else "ENTITY#GLOBAL"

    # --- Deduplication check por hash y entidad (AWS/DynamoDB) ---

    try:
        items = await db.query_by_entity("RagDocuments", pk_val)
        active_session = None
        for item in (items or []):
            meta = item.get("metadata", {})
            if meta.get("file_hash") == file_hash and meta.get("status") in ("analyzing", "processing_ocr", "pending_verification"):
                active_session = item
                break
        
        if active_session:
            print(f" [INFO] Reusando sesión activa DynamoDB: {active_session['id']} para hash {file_hash}")
            return {"import_id": active_session["id"], "status": active_session.get("metadata", {}).get("status", "analyzing")}
    except Exception as dup_err:
        print(f" Error en chequeo de duplicados DynamoDB: {dup_err}")

    # 1. Crear registro inicial en RagDocuments
    item = {
        "PK": pk_val,
        "SK": f"IMPORT#{doc_id}",
        "id": doc_id,
        "filename": file.filename,
        "metadata": {
            "source": file.filename,
            "status": "analyzing",
            "type": "trd_import_session",
            "entidad_id": entidad_actual,
            "user_id": user.get("user_id"),
            "file_size_bytes": file_size_bytes,
            "file_hash": file_hash,
            "created_at": datetime.now().isoformat()
        }
    }
    
    await db.put_item("RagDocuments", item)
    
    # 2. Arrancar tarea de fondo
    background_tasks.add_task(process_ocr_task, doc_id, content, file.filename, entidad_actual, user.get("user_id"))
    
    return {"import_id": doc_id, "status": "analyzing"}


@router.post("/upload")
async def upload_pdf(background_tasks: BackgroundTasks, file: UploadFile = File(...), entidad_id: str = "", user: dict = Depends(get_current_user)):
    """
    Sube un PDF, extrae texto, genera embeddings y los guarda en DynamoDB.
    Vision AI desactivada para evitar timeout de Vercel.
    """

    if not db:

        raise HTTPException(status_code=503, detail="La base de datos DynamoDB no est configurada.")

    if embeddings is None:

        raise HTTPException(status_code=503, detail="El motor de embeddings no est disponible.")



    print(f" POST /upload - File: {file.filename} - Type: {file.content_type}")



    #  Deduplication check (opcional en DynamoDB, por ahora saltamos para agilizar)

    try:

        # En una arquitectura real, consultaramos un ndice GSI de RagDocuments

        pass

    except Exception as dup_err:

        print(f" Error en chequeo de duplicados: {dup_err}")



    content = await file.read()

    print(f" Tamao recibido: {len(content) / (1024*1024):.2f} MB")



    # 1. Guardar el archivo original en AWS S3

    file_url = None

    try:

        clean_filename = f"{int(time.time())}_{file.filename.replace(' ', '_')}"

        entidad_path = user.get("entity_id", "global")

        storage_path = f"{entidad_path}/rag-uploads/{clean_filename}"

        

        await s3_client.upload_file(content, storage_path, "application/pdf")

        file_url = await s3_client.get_download_url(storage_path)

        print(f"  PDF subido a S3: {file_url}")

    except Exception as e:

        print(f"  Error subiendo PDF a S3: {e}")



    # Determinar entidad para el documento

    entidad_final = user.get("entity_id") if user.get("role") == ADMIN_ROLE else entidad_id



    # En lugar de bloquear, lo delegamos a una tarea de fondo

    background_tasks.add_task(index_document_rag, None, content, file.filename, entidad_final, file_url)



    return {

        "message": f"PDF '{file.filename}' recibido. Se esta indexando en segundo plano.",

        "status": "indexing"

    }



@router.post("/chat")
async def chat(request: ChatRequest, user: dict = Depends(get_current_user)):
    if not user.get("iaDisponible"):
        raise HTTPException(status_code=403, detail="No tienes permisos para utilizar las funciones de IA. Contacta a un administrador.")

    print(f"\n --- CONSULTA DOCUMENCIO (AWS Serverless) ---")

    if not db:

        raise HTTPException(status_code=503, detail="La base de datos no esta configurada.")

    if not llm:

        return {"answer": "Lo siento, el servicio de IA no esta configurado.", "sources": []}



    try:

        entidad_actual = user.get("entity_id") or "GLOBAL"

        

        # 1. Recuperar contexto de DynamoDB

        chunks = await db.query_by_entity("RagDocuments", entidad_actual)

        

        if not chunks:

            # Reintento con GLOBAL

            chunks = await db.query_by_entity("RagDocuments", "GLOBAL")



        context_texts = [c.get("content", "") for c in chunks]

        

        # 2. Query RAG usando OpenRouter

        answer = await ai.rag_query(request.query, context_texts, entidad_actual)

        

        # Extraer fuentes nicas

        sources = list(set([c.get("metadata", {}).get("source", "Desconocido") for c in chunks]))

        

        return {

            "answer": answer,

            "sources": sources[:5]

        }

    except Exception as e:

        print(f" Error en Chat RAG: {e}")

        return {"answer": "Lo siento, hubo un error procesando tu consulta en el motor AWS.", "sources": []}



@router.get("/rag-documents")
async def get_rag_documents(entidad_id: str | None = None, type: str | None = None, user: dict = Depends(get_current_user)):
    """
    Lista los documentos en el RAG. 
    Soporta filtrado por entidad y por tipo (ej: 'temp_trd_session').
    """
    if not supabase_client: raise HTTPException(503)
    
    try:
        query = supabase_client.table("rag_documents").select("id, metadata, created_at, content")
        
        # 1. Filtro de Seguridad por Entidad
        allowed_entities = user.get("allowed_entities", [])
        if user.get("role") == "superadmin":
            entidad_final = entidad_id if entidad_id and entidad_id != "null" else user.get("entity_id")
        else:
            # Admin/Usuario: si pide una específica, verificar permiso. Si no pide, usar la del contexto.
            if entidad_id:
                entidad_final = entidad_id if entidad_id in allowed_entities else user.get("entity_id")
            else:
                entidad_final = user.get("entity_id")
        
        if entidad_final:
            query = query.filter("metadata->>entidad_id", "eq", entidad_final)

        # 2. Filtro por Tipo (Opcional)
        if type:
            query = query.filter("metadata->>type", "eq", type)
        else:
            # Si no hay tipo específico, excluimos los chunks de RAG internos si queremos una lista de 'archivos'
            # Pero para TRD Import View, a veces queremos sesiones específicas.
            # Por ahora, dejamos que el frontend decida o devolvemos todo lo de la entidad.
            pass

        res = query.execute()
        if not res.data: return []

        # 3. Ordenar por creación descendente para ver lo más reciente primero
        res.data.sort(key=lambda x: x.get("created_at", ""), reverse=True)

        # Agrupar por source para evitar duplicados masivos. 
        # Prioridad absoluta a las sesiones de importación (TRD) sobre los chunks RAG.
        processed_data = []
        sources_handled = set()
        
        # 1. Primero recolectamos todas las sesiones activas/pendientes (Solo la más reciente por fuente)
        for item in res.data:
            meta = item.get("metadata", {})
            doc_type = meta.get("type")
            source = meta.get("source") or meta.get("filename")
            
            if doc_type in ('temp_trd_session', 'trd_upload'):
                if source and source in sources_handled:
                    continue # Ya incluimos la versión más reciente (gracias al sort previo)
                
                processed_data.append(item)
                if source: sources_handled.add(source)

        # 2. Luego recolectamos los archivos RAG generales que no tengan una sesión activa
        for item in res.data:
            meta = item.get("metadata", {})
            doc_type = meta.get("type")
            source = meta.get("source") or meta.get("filename")
            
            if doc_type not in ('temp_trd_session', 'trd_upload'):
                if not source or source not in sources_handled:
                    processed_data.append(item)
                    if source: sources_handled.add(source)

        return processed_data


    except Exception as e:
        print(f" Error listando documentos RAG: {str(e)}")
        return []



@router.put("/rag-documents/{doc_id}")
async def update_rag_document(doc_id: str, payload: dict, user: dict = Depends(get_current_user)):
    """
    Actualiza el estado o metadata de un documento RAG o sesión de importación.
    Si se marca como 'success', se realiza una verificación de integridad.
    """
    if not supabase_client: raise HTTPException(503)
    
    # 1. Buscar documento/sesión
    res = supabase_client.table("rag_documents").select("id, metadata").eq("id", doc_id).execute()
    if not res.data:
        raise HTTPException(404, "Documento no encontrado")
        
    doc = res.data[0]
    meta = doc.get("metadata") or {}
    source = meta.get("source")
    entidad_id = meta.get("entidad_id")
    
    # 2. Validar permisos: Superadmin puede todo. Admin solo su entidad.
    user_role = user.get("role", "user")
    user_entity = user.get("entity_id")
    
    if user_role != SUPERADMIN_ROLE:
        if entidad_id and str(entidad_id) != str(user_entity):
            raise HTTPException(403, "No tienes permiso para modificar documentos de otra entidad")

    # 3. Aplicar cambios de estado y metadata
    new_status = payload.get("status")
    incoming_meta = payload.get("metadata", {})
    
    # Combinar metadata existente con la nueva (si viene)
    final_meta = {**meta, **incoming_meta}
    
    if new_status:
        final_meta["status"] = new_status
        if new_status == "success":
            final_meta["type"] = "trd_upload"
            final_meta["integrated_at"] = datetime.now().isoformat()
            final_meta["integrated_by"] = user.get("nombre", "Usuario")
            
            # --- VERIFICACIÓN DE INTEGRIDAD ---
            # Verificamos si realmente hay datos en las tablas TRD para esta entidad
            try:
                # Comprobamos si hay registros en trd_records o dependencias (mínimo indicio de éxito)
                trd_check = supabase_client.table("trd_records").select("id", count="exact").eq("entidad_id", entidad_id).limit(1).execute()
                if not trd_check.data:
                    # Si no hay registros en trd_records, comprobamos dependencias
                    dep_check = supabase_client.table("dependencias").select("id").eq("entidad_id", entidad_id).limit(1).execute()
                    if not dep_check.data:
                        print(f" [WARN] Verificación fallida para {doc_id}: No se encontraron datos integrados.")
                        # No bloqueamos el éxito, pero guardamos la advertencia
                        final_meta["verification_warning"] = "No se detectaron registros nuevos en la DB."

            except Exception as v_err:
                print(f" [ERR] Fallo en verificación de integración: {v_err}")
        elif new_status == "pending_verification":
            final_meta["type"] = "temp_trd_session"

    # Asegurar que no perdemos la entidad original
    if entidad_id and not final_meta.get("entidad_id"):
        final_meta["entidad_id"] = entidad_id

    # 4. Actualizar metadata (y opcionalmente otros campos si vienen en el payload)
    update_data = {"metadata": final_meta}
    if "content" in payload: update_data["content"] = payload["content"]

    try:
        # Actualización principal
        supabase_client.table("rag_documents").update(update_data).eq("id", doc_id).execute()
        
        # Si tiene 'source', actualizamos todos los chunks relacionados para mantener consistencia
        if source:
            # Buscamos todos los chunks por source
            supabase_client.table("rag_documents").update({"metadata": final_meta}).eq("metadata->>source", source).execute()
            
        return {"status": "success", "new_status": final_meta.get("status")}
    except Exception as e:
        print(f" [ERR] update_rag_document: {e}")
        raise HTTPException(500, f"Error actualizando documento: {str(e)}")

        meta = item.get("metadata", {})
        new_status = payload.get("status")
        incoming_meta = payload.get("metadata", {})
        
        final_meta = {**meta, **incoming_meta}
        if new_status:
            final_meta["status"] = new_status
            if new_status == "success":
                final_meta["type"] = "trd_upload"
                final_meta["integrated_at"] = datetime.now().isoformat()
                final_meta["integrated_by"] = user.get("nombre", "Usuario")
            elif new_status == "pending_verification":
                final_meta["type"] = "trd_import_session"

        # 2. Actualizar metadata en DynamoDB
        await db.update_item("RagDocuments", pk, current_sk, {"metadata": final_meta})
        
        return {"status": "success", "new_status": final_meta.get("status")}
    except Exception as e:
        print(f" Error actualizando documento RAG (AWS): {e}")
        raise HTTPException(500, str(e))
@router.delete("/rag-documents/{doc_id}")
async def delete_rag_document(doc_id: str, user: dict = Depends(get_current_user)):
    """Elimina un documento, sus vectores asociados y el archivo físico en storage."""
    if not supabase_client: raise HTTPException(503)
    
    # 1. Buscar el documento principal para obtener metadata
    res = supabase_client.table("rag_documents").select("id, metadata").eq("id", doc_id).execute()
    if not res.data:
        # Quizás ya se borró
        return {"status": "success", "message": "Documento ya eliminado."}
        
    meta = res.data[0].get("metadata", {})
    entidad_id = meta.get("entidad_id")
    source = meta.get("source")
    file_url = meta.get("file_url")
    
    # 2. Validar permisos
    user_role = user.get("role", "user")
    user_entity = user.get("entity_id")
    
    if user_role != SUPERADMIN_ROLE:
        if entidad_id and str(entidad_id) != str(user_entity):
            raise HTTPException(403, "No tienes permiso para eliminar documentos de otra entidad")

    try:
        # 3. Eliminar archivo de Storage si existe
        if file_url and "rag-uploads/" in file_url:
            try:
                filename_storage = file_url.split("rag-uploads/")[-1]
                supabase_client.storage.from_("rag-uploads").remove([filename_storage])
            except Exception as st_err:
                print(f" [WARN] No se pudo borrar de storage: {st_err}")

        # 4. Borrado en cascada en la DB
        if source:
            # Borrar todos los chunks relacionados por source y entidad
            if entidad_id:
                supabase_client.table("rag_documents").delete().eq("metadata->>source", source).eq("metadata->>entidad_id", entidad_id).execute()
            else:
                supabase_client.table("rag_documents").delete().eq("metadata->>source", source).execute()
        else:
            # Borrado simple por ID
            supabase_client.table("rag_documents").delete().eq("id", doc_id).execute()
            
        return {"status": "success", "message": f"Documento {source or doc_id} eliminado correctamente."}
    except Exception as e:
        print(f" [ERR] delete_rag_document: {e}")
        raise HTTPException(500, f"Error al eliminar: {str(e)}")



@router.post("/generate-dependencias")

async def generate_dependencias(request: GenerateDepsRequest):
    system_prompt = """Eres un experto en gestion organizacional y diseño de estructuras administrativas. 
El usuario te dara una instruccion para crear dependencias. Debes extraer los nombres de las dependencias solicitadas, mantener EXACTAMENTE el orden en que las pidio, y rellenar la informacion faltante con datos simulados pero realistas y corporativos.

INSTRUCCIONES DE FORMATO:
Debes responder ESTRICTAMENTE con un arreglo de objetos JSON en el que cada objeto tenga esta estructura exacta (sin texto extra):
[
  {
    "nombre": "Nombre de la dependencia",
    "sigla": "Sigla en mayusculas (2 a 4 letras)",
    "codigo": "Un numero o codigo alfanumerico unico",
    "pais": "Colombia",
    "departamento": "Cundinamarca",
    "ciudad": "Bogota",
    "direccion": "Direccion realista en la ciudad",
    "telefono": "Numero de telefono ficticio realista",
    "dependeDe": "ninguna"
  }
]

Asegurate de generar un objeto por cada dependencia solicitada en el prompt del usuario.
IMPORTANTE: RESPONDE SOLO CON EL JSON VALIDO. NO incluyas markdown (```json), etiquetas, saludos, explicaciones ni texto adicional."""



    try:

        messages = [

            SystemMessage(content=system_prompt),

            HumanMessage(content=request.prompt)

        ]
        response = await llm.ainvoke(messages)
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
async def agent_action(request: AgentActionRequest, user: dict = Depends(get_current_user)):
    if not user.get("iaDisponible"):
        raise HTTPException(status_code=403, detail="No tienes permisos para utilizar las funciones de IA. Contacta a un administrador.")

    from langchain_core.messages import AIMessage



    deps = [{"id": d.get("id"), "nombre": d.get("nombre")} for d in request.context.dependencias]

    series = [{"id": s.get("id"), "nombre": s.get("nombre"), "dependenciaId": s.get("dependenciaId")} for s in request.context.series]

    subs = [{"id": s.get("id"), "nombre": s.get("nombre"), "serieId": s.get("serieId")} for s in request.context.subseries]

    trds = [{"id": t.get("id"), "dependencia_id": t.get("dependenciaId"), "serie_id": t.get("serieId")} for t in request.context.trdRecords]

    ents = [{"id": e.get("id"), "nombre": e.get("nombre") or e.get("razonSocial")} for e in request.context.entidades]



    system_prompt = f"""Eres Orianna, la Arquitecta TRD de OSE IA, una inteligencia artificial experta en la gestion y automatizacion de Tablas de Retencion Documental (TRD) bajo los estandares del AGN (Archivo General de la Nacion) y la Ley 594 de 2000 de Colombia.

TU MISION:
Debes actuar como la autoridad maxima en la estructura documental de la entidad. Tu objetivo es interpretar la intencion del usuario para realizar:
1. CONSULTAS ESTRUCTURALES: Analizar y responder sobre dependencias, series, subseries y registros existentes.
2. OPERACIONES ESTRATEGICAS (CRUD): Crear, editar o eliminar elementos manteniendo la integridad jerarquica del sistema.

CONOCIMIENTO DEL ENTORNO (Contexto Real):
- Entidades vinculadas: {json.dumps(ents, ensure_ascii=False)}
- Dependencias (Oficinas): {json.dumps(deps, ensure_ascii=False)}
- Series Documentales: {json.dumps(series, ensure_ascii=False)}
- Subseries Documentales: {json.dumps(subs, ensure_ascii=False)}
- Registros TRD (Valoracion): {json.dumps(trds, ensure_ascii=False)}

REGLAS DE ORO DE ORIANNA:
1. INTEGRIDAD DE NOMBRES: Los nombres de dependencias o series NUNCA deben ser abreviados ni resumidos por ti. Usa el nombre oficial completo (ej: "Secretaria de Hacienda y Credito Publico").
2. VALIDACION ESTRUCTURAL (CRITICO):
   - PARA CREAR SERIES: Es obligatorio conocer la Dependencia productora y el Codigo. Si falta algo, pregunta con autoridad: "Para que dependencia es la serie y que codigo oficial le asignaremos?"
   - PARA CREAR SUBSERIES: Requiere Dependencia, Serie y Codigo propio (el cual puede ser un entero simple independiente como 1, 2, 3 o el formato que pida el usuario, sin obligar a usar prefijos o decimales de la serie). Si hay ambiguedad, solicita los datos faltantes antes de generar cualquier accion.
3. DETECCION DE INTENCION PROACTIVA:
   - Si el usuario pregunta "Que series hay...", responde con un listado estructurado y profesional basado en el contexto.
   - Si el usuario ordena cambios, genera el objeto 'actions' con precision quirurgica.
4. JERARQUIA AUTOMATICA: Si se solicita una estructura compleja, genera multiples acciones CREATE usando IDs temporales (t1, t2...) para enlazar los niveles de forma coherente.
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
#

    try:

        messages_llm = [SystemMessage(content=system_prompt)]

        for h in request.history[-6:]:

            if h.role == "user":

                messages_llm.append(HumanMessage(content=h.content))

            elif h.role == "agent":

                messages_llm.append(AIMessage(content=h.content))

        messages_llm.append(HumanMessage(content=request.prompt))

        response = await llm.ainvoke(messages_llm)
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
async def get_chat_history(assistant: str, entidad_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    if not user.get("iaDisponible"):
        return {"messages": []}
    """Recupera el historial de chat privado para un usuario, asistente y entidad especifica."""

    user_id = user.get("user_id")
    if not user_id: raise HTTPException(status_code=401, detail="No user ID found in token")

    try:
        # Usar la entidad proporcionada en el query param o un fallback global
        sk = f"CHAT#{assistant}"
        if entidad_id:
            sk = f"CHAT#{assistant}#ENTITY#{entidad_id}"
            
        item = await db.get_item("chat_sessions", f"USER#{user_id}", sk)
        if item:
            return {"messages": item.get("messages", [])}
        return {"messages": []}
    except Exception as e:
        print(f" Error recuperando historial ({assistant}): {e}")
        return {"messages": []}



@router.post("/chat-history/{assistant}")
async def save_chat_history(assistant: str, payload: ChatHistoryUpdate, entidad_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    if not user.get("iaDisponible"):
        raise HTTPException(status_code=403, detail="No tienes permisos de IA")
    """Guarda o actualiza el historial de chat privado. Limita a los últimos 50 mensajes."""

    if not db: raise HTTPException(status_code=503)

    user_id = user.get("user_id")
    if not user_id: raise HTTPException(status_code=401, detail="No user ID found in token")

    # Limitar a los últimos 50 mensajes para optimizar almacenamiento
    limited_messages = payload.messages[-50:]
    
    # Usar la entidad proporcionada en el query param o en el payload
    target_entity = entidad_id or payload.dict().get("entidad_id")
    
    sk = f"CHAT#{assistant}"
    if target_entity:
        sk = f"CHAT#{assistant}#ENTITY#{target_entity}"

    try:
        item = {
            "PK": f"USER#{user_id}",
            "SK": sk,
            "user_id": user_id,
            "assistant": assistant,
            "entidad_id": target_entity,
            "messages": limited_messages,
            "updated_at": datetime.now().isoformat()
        }
        await db.put_item("chat_sessions", item)
        return {"status": "ok"}
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

@router.post("/request-reset")
async def request_reset(request: PasswordResetRequest):
    """Genera un token de reseteo y envÃƒÂ­a el correo"""
    if not supabase_client: raise HTTPException(500, "Base de datos desconectada")
    
    target_email = request.email.strip().lower()
    
    # 1. Verificar si el usuario existe
    user_res = supabase_client.table("profiles").select("id, nombre").eq("email", target_email).execute()
    if not user_res.data:
        # Por seguridad no revelamos si existe o no, pero retornamos ÃƒÂ©xito simulado si no existe
        return {"status": "ok", "message": "Si el correo está registrado, recibirás un enlace de recuperación."}
    
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
            "is_activated": True,
            "estado": "Activo",
            "activation_token": None,
            "token_expiry": None
        }).eq("id", user_data["id"]).execute()
        
        return {"status": "success", "message": "Cuenta activada correctamente."}
    except Exception as e:
        print(f" Error activando usuario: {e}")
        raise HTTPException(500, f"Error interno: {str(e)}")

@router.get("/users/profile")
async def get_user_profile(user: dict = Depends(get_current_user)):
    """Retorna el perfil completo del usuario actual, incluyendo entidades permitidas."""
    if not supabase_client: raise HTTPException(500, "Base de datos desconectada")
    user_id = user.get("user_id")
    res = supabase_client.table("profiles").select("*").eq("id", user_id).execute()
    if not res.data:
        raise HTTPException(404, "Perfil no encontrado")
    
    user_data = res.data[0]
    entities_res = supabase_client.table("profile_entities").select("entity_id").eq("profile_id", user_id).execute()
    entidad_ids = [e["entity_id"] for e in entities_res.data]
    
    return {
        "id": user_data["id"],
        "nombre": user_data["nombre"],
        "email": user_data["email"],
        "role": user_data["perfil"],
        "entidadId": user_data.get("entidad_id"),
        "entidadIds": entidad_ids,
        "iaDisponible": user_data.get("ia_disponible", True)
    }

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
        "role": active_role,
        "entidadId": user_data.get("entidad_id"),
        "entidadIds": entidad_ids,
        "iaDisponible": user_data.get("ia_disponible", False),
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
    active_entity_id = str(user_data.get("entidad_id") or (entidad_ids[0] if entidad_ids else "e0"))
    
    role_res = supabase_client.table("profile_entities").select("role").eq("profile_id", user_data["id"]).eq("entity_id", active_entity_id).execute()
    entity_role = (role_res.data[0]["role"] if role_res.data else user_data["perfil"]) or "usuario"
    
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
        "role": active_role,
        "entidadId": active_entity_id,
        "entidadIds": entidad_ids,
        "token": token,
        "isNew": is_new
    }

@router.get("/users")
async def get_users(entidad_id: str | None = None, user: dict = Depends(get_current_user)):
    if not supabase_client: return []
    query = supabase_client.table("profiles").select("*")
    role = user.get("role")
    
    # Contexto activo procesado por get_current_user (header x-entity-context)
    active_entity_id = user.get("entity_id") or entidad_id
    
    if role == ADMIN_ROLE:
        # Administradores: filtrado estricto por la entidad del contexto actual
        if active_entity_id:
             query = query.eq("entidad_id", active_entity_id)
        else:
             return []
    elif role == SUPERADMIN_ROLE:
        # Superadmin: si está en contexto global (e0) ve todos, si no, filtra
        if active_entity_id and active_entity_id != "e0":
             query = query.eq("entidad_id", active_entity_id)
             
    res = query.execute()
    rel_res = supabase_client.table("profile_entities").select("*").execute()
    rels = {}
    roles = {}
    entity_roles = {}
    for r in rel_res.data:
        p_id = r["profile_id"]
        if p_id not in rels: 
            rels[p_id] = []
            entity_roles[p_id] = {}
        rels[p_id].append(r["entity_id"])
        entity_roles[p_id][r["entity_id"]] = r["role"]
        if r["entity_id"] == active_entity_id:
            roles[p_id] = r["role"]
            
    mapped = []
    for u in res.data:
        context_role = roles.get(u["id"], u["perfil"])
        display_perfil = context_role if u["perfil"] != SUPERADMIN_ROLE else SUPERADMIN_ROLE
        mapped.append({
            "id": u["id"], "nombre": u["nombre"], "apellido": u["apellido"], "email": u["email"],
            "username": u["username"], "perfil": display_perfil, "estado": u["estado"],
            "isActivated": u["is_activated"], "entidadId": u["entidad_id"],
            "entidadIds": rels.get(u["id"], []),
            "entityRoles": entity_roles.get(u["id"], {}),
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
    
    # Asegurar que nuevos usuarios no se creen con roles altos globales
    final_perfil = DEFAULT_ROLE
    if user.perfil == SUPERADMIN_ROLE and current_user.get("role") == SUPERADMIN_ROLE:
        final_perfil = SUPERADMIN_ROLE

    data = {
        "nombre": user.nombre, "apellido": user.apellido, "email": user.email, "username": user.username,
        "perfil": final_perfil, "entidad_id": user.entidadId, "activation_token": user.activationToken,
        "token_expiry": user.tokenExpiry, "ia_disponible": user.iaDisponible or False
    }
    res = supabase_client.table("profiles").insert(data).execute()
    new_user = res.data[0]
    
    entity_role = user.perfil if user.perfil in (ADMIN_ROLE, DEFAULT_ROLE, "admin", "usuario") else DEFAULT_ROLE
    
    if user.entidadIds:
        rels = [{"profile_id": new_user["id"], "entity_id": e_id, "role": entity_role} for e_id in user.entidadIds]
        supabase_client.table("profile_entities").insert(rels).execute()
    elif user.entidadId:
        supabase_client.table("profile_entities").insert({"profile_id": new_user["id"], "entity_id": user.entidadId, "role": entity_role}).execute()
        
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
    
    # SEGURIDAD: Solo modificar el rol global del perfil cuando se promueve a superadmin.
    # Los cambios de rol admin/usuario se aplican ÚNICAMENTE en profile_entities (contexto de entidad)
    # para no degradar roles de otras entidades del mismo usuario.
    if user.perfil is not None:
        if current_user.get("role") == SUPERADMIN_ROLE and user.perfil == SUPERADMIN_ROLE:
            # Única razón para tocar el campo 'perfil' global: promoción a superadmin
            data["perfil"] = SUPERADMIN_ROLE
        elif user.perfil in (ADMIN_ROLE, DEFAULT_ROLE, "admin", "usuario", "administrador"):
            # Cambio de rol contextual: solo actualizar la relación entidad-usuario
            new_entity_role = user.perfil if user.perfil in (ADMIN_ROLE, DEFAULT_ROLE, "admin", "usuario", "administrador") else DEFAULT_ROLE
            if target_entity_id:
                supabase_client.table("profile_entities").update({"role": new_entity_role}).eq("profile_id", user_id).eq("entity_id", target_entity_id).execute()
        # IMPORTANTE: No tocar data["perfil"] si no es una promoción a superadmin
        # Esto evita que el rol global se sobreescriba al actualizar permisos de IA

    if user.entidadId is not None: data["entidad_id"] = user.entidadId
    if user.isActivated is not None: data["is_activated"] = user.isActivated
    if user.iaDisponible is not None: data["ia_disponible"] = user.iaDisponible
    if user.password is not None: data["password"] = user.password
    if user.username is not None: data["username"] = user.username
    # user.celular removed as it's not present in the profiles table schema
    # if user.celular is not None: data["celular"] = user.celular
    
    # Si 'data' solo iba a actualizar el perfil contextual, podrÃ­a estar vacÃ­o para perfiles, asÃ­ que chequeamos
    res_data = target_res.data[0]
    if data:
        res = supabase_client.table("profiles").update(data).eq("id", user_id).execute()
        res_data = res.data[0]
    
    if user.entidadIds is not None and current_user.get("role") == SUPERADMIN_ROLE:
        if user.entidadIds:
            # Obtener los roles actuales para preservarlos al reasignar entidades
            existing_roles_res = supabase_client.table("profile_entities").select("entity_id", "role").eq("profile_id", user_id).execute()
            existing_roles = {r["entity_id"]: r["role"] for r in (existing_roles_res.data or [])}
            
            supabase_client.table("profile_entities").delete().eq("profile_id", user_id).execute()
            # Preservar el rol anterior si ya existía en esa entidad; usar DEFAULT_ROLE si es nueva
            rels = [{"profile_id": user_id, "entity_id": e_id, "role": existing_roles.get(e_id, DEFAULT_ROLE)} for e_id in user.entidadIds]
            supabase_client.table("profile_entities").insert(rels).execute()
        else:
            # Si entidadIds vacío, no borrar todo automáticamente (protección accidental)
            pass
            
    return res_data

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
             raise HTTPException(500, "No se pudo confirmar la eliminaciÃ³n del usuario")
             
    except Exception as e:
        print(f" Error eliminando perfil {user_id}: {str(e)}")
        raise HTTPException(500, f"Error de base de datos al eliminar perfil: {str(e)}")
        
    return {"status": "success", "message": "Usuario y sus relaciones eliminados correctamente"}

@router.get("/entities")
async def get_entities(user: dict = Depends(get_current_user)):
    """Lista las entidades permitidas para el usuario actual."""
    if not supabase_client: return []
    
    role = user.get('role')
    if role == 'superadmin':
        res = supabase_client.table("entities").select("*").execute()
        return res.data or []
    
    # Para administradores multi-entidad
    allowed_ids = user.get("allowed_entities", [])
    if not allowed_ids:
        # Fallback
        eid = user.get("entity_id")
        allowed_ids = [eid] if eid else []
        
    if not allowed_ids: return []
    
    res = supabase_client.table("entities").select("*").in_("id", allowed_ids).execute()
    return res.data or []

@router.post("/entities/upload-logo")
async def upload_entity_logo(file: UploadFile = File(...)):
    if not supabase_client: raise HTTPException(503, "Supabase disconnected")
    content = await file.read()
    ext = file.filename.split('.')[-1]
    filename = f"logo_{int(datetime.now().timestamp())}.{ext}"
    
    # Upload to 'logos' bucket
    try:
        supabase_client.storage.from_("logos").upload(filename, content, {"content-type": file.content_type})
        url = supabase_client.storage.from_("logos").get_public_url(filename)
        return {"url": url}
    except Exception as e:
        raise HTTPException(500, f"Upload failed: {str(e)}")

@router.post("/entities")
async def create_entity(entity: EntityCreate):
    if not supabase_client: raise HTTPException(500, "DB disconnected")
    data = {
        "razon_social": entity.razonSocial,
        "nit": entity.numeroDocumento,
        "dv": entity.dv,
        "ciiu": entity.ciiu,
        "email": entity.correo,
        "nombre_contacto": entity.nombreContacto,
        "sector": entity.sector,
        "tipo_ejecutor": entity.tipoEjecutor,
        "tamano_empresa": entity.tamanoEmpresa,
        "entidad_organizacional": entity.entidadOrganizacional,
        "proyectos": entity.proyectos,
        "num_dependencias": entity.numDependencias,
        "num_proyectos": entity.numProyectos,
        "logo_url": entity.logoUrl,
        "tipo_entidad": entity.tipoEntidad,
        "clasificacion": entity.clasificacion,
        "tipo_documento": entity.tipoDocumento,
        "pais": entity.pais,
        "departamento": entity.departamento,
        "ciudad": entity.ciudad,
        "direccion": entity.direccion,
        "telefono": entity.telefono,
        "celular": entity.celular,
        "pagina_web": entity.paginaWeb,
        "estado": entity.estado,
        "max_usuarios": entity.maxUsuarios,
        "max_dependencias": entity.maxDependencias,
        "max_proyectos": entity.maxProyectos
    }
    res = supabase_client.table("entities").insert(data).execute()
    if not res.data: raise HTTPException(500, "Error al crear entidad")
    return {"id": res.data[0]["id"]}

@router.put("/entities/{entity_id}")
async def update_entity(entity_id: str, entity: EntityCreate):
    if not supabase_client: raise HTTPException(500, "DB disconnected")
    data = {
        "razon_social": entity.razonSocial,
        "nit": entity.numeroDocumento,
        "dv": entity.dv,
        "ciiu": entity.ciiu,
        "email": entity.correo,
        "nombre_contacto": entity.nombreContacto,
        "sector": entity.sector,
        "tipo_ejecutor": entity.tipoEjecutor,
        "tamano_empresa": entity.tamanoEmpresa,
        "entidad_organizacional": entity.entidadOrganizacional,
        "proyectos": entity.proyectos,
        "num_dependencias": entity.numDependencias,
        "num_proyectos": entity.numProyectos,
        "logo_url": entity.logoUrl,
        "tipo_entidad": entity.tipoEntidad,
        "clasificacion": entity.clasificacion,
        "tipo_documento": entity.tipoDocumento,
        "pais": entity.pais,
        "departamento": entity.departamento,
        "ciudad": entity.ciudad,
        "direccion": entity.direccion,
        "telefono": entity.telefono,
        "celular": entity.celular,
        "pagina_web": entity.paginaWeb,
        "estado": entity.estado,
        "max_usuarios": entity.maxUsuarios,
        "max_dependencias": entity.maxDependencias,
        "max_proyectos": entity.maxProyectos
    }
    # Remove none values
    data = {k: v for k, v in data.items() if v is not None}
    
    try:
        res = supabase_client.table("entities").update(data).eq("id", entity_id).execute()
        if not res.data: raise HTTPException(404, "Entidad no encontrada")
        return {"id": res.data[0]["id"]}
    except postgrest.exceptions.APIError as e:
        if e.code == "23505":  # Unique violation
            raise HTTPException(409, f"El NIT {entity.numeroDocumento} ya está registrado para otra entidad.")
        raise HTTPException(500, f"Error de base de datos: {str(e)}")

@router.delete("/entities/{entity_id}")
async def delete_entity(entity_id: str):
    if not supabase_client: raise HTTPException(500, "DB disconnected")
    supabase_client.table("entities").delete().eq("id", entity_id).execute()
    return {"status": "success"}

@router.post("/analyze-trd")
async def analyze_trd(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    entidad_id: str = Form(""),
    user: dict = Depends(get_current_user)
):
    if not supabase_client: raise HTTPException(503)

    content = await file.read()
    file_size_bytes = len(content)
    file_hash = hashlib.sha256(content).hexdigest()

    # --- Validación de tamaño ---
    max_bytes = MAX_OCR_FILE_SIZE_MB * 1024 * 1024
    if file_size_bytes > max_bytes:
        size_mb = file_size_bytes / (1024 * 1024)
        raise HTTPException(
            status_code=413,
            detail=(
                f"Este archivo es demasiado pesado para procesarse ({size_mb:.1f} MB). "
                f"El límite permitido es {MAX_OCR_FILE_SIZE_MB} MB. "
                "Intenta reducir su tamaño o dividirlo en varios archivos."
            )
        )

    # Asegurar que el filename sea seguro para Storage
    safe_name = file.filename.replace(' ', '_').replace('/', '_')
    filename_clean = f"{int(datetime.now().timestamp())}_{safe_name}"

    file_url = None
    try:
        supabase_client.storage.from_("trd-uploads").upload(filename_clean, content, {"content-type": "application/pdf"})
        file_url = supabase_client.storage.from_("trd-uploads").get_public_url(filename_clean)
    except Exception as storage_err:
        print(f"[analyze-trd] Error subiendo a Storage: {storage_err}")

    # Lógica de entidad: estricta para administrador, flexible para superadmin
    allowed_entities = user.get("allowed_entities", [])
    if user.get("role") == "superadmin":
        entidad_final = entidad_id if entidad_id and entidad_id != "null" and entidad_id != "" else user.get("entity_id")
    else:
        # Si es admin, puede elegir una de sus entidades permitidas si la envía en el form
        if entidad_id and entidad_id in allowed_entities:
            entidad_final = entidad_id
        else:
            # Fallback a la entidad del contexto/JWT
            entidad_final = user.get("entity_id")

    if not entidad_final or entidad_final == "null" or entidad_final == "e0":
        # Bloquear importación si no hay entidad activa (o si es la global e0 que no debe tener TRDs directas)
        raise HTTPException(
            status_code=400, 
            detail="No hay entidad activa seleccionada. Selecciona una entidad antes de importar una TRD."
        )

    # --- Deduplication check por hash y entidad ---
    active_session = None
    try:
        dup_check = (
            supabase_client
            .table("rag_documents")
            .select("id, metadata")
            .eq("metadata->>file_hash", file_hash)
            .eq("metadata->>entidad_id", entidad_final)
            .in_("metadata->>status", ["uploaded", "processing_ocr", "extraction_completed", "pending_verification"])
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        if dup_check.data:
            active_session = dup_check.data[0]
            print(f" [INFO] Reusando sesión activa encontrada: {active_session['id']} para hash {file_hash}")
    except Exception as dup_err:
        print(f" Error en chequeo de duplicados TRD: {dup_err}")

    if active_session:
        doc_id = active_session["id"]
        # Opcional: Actualizar el filename si cambió
        # supabase_client.table("rag_documents").update({"metadata": {**active_session["metadata"], "source": file.filename}}).eq("id", doc_id).execute()
    else:
        res = supabase_client.table("rag_documents").insert({
            "content": f"Import Session Snapshot: {file.filename}",
            "metadata": {
                "source": file.filename,
                "status": "uploaded",
                "ocr_stage": "Archivo recibido",
                "ocr_progress": 0,
                "ocr_current_page": 0,
                "ocr_total_pages": 0,
                "ocr_pages_ok": 0,
                "ocr_pages_error": 0,
                "ocr_error_pages": [],
                "file_url": file_url,
                "file_size_bytes": file_size_bytes,
                "file_hash": file_hash,
                "entidad_id": entidad_final,
                "type": "temp_trd_session",
                "created_at": datetime.now().isoformat()
            }
        }).execute()

        if not res.data:
            raise HTTPException(500, detail="No se pudo crear la sesión de importación")
        
        doc_id = res.data[0]["id"]

    user_name = user.get("nombre", "Superadministrador" if user.get("role") == "superadmin" else "Administrador")
    user_id = user.get("user_id")

    print(f"[analyze-trd] Sesión creada: {doc_id} | Archivo: {file.filename} | Entidad: {entidad_final} | Usuario: {user_name}")

    # Log de inicio (Aislar de administradores locales si es superadmin)
    log_eid = 'e0' if user.get("role") == "superadmin" else entidad_final
    add_activity_log(
        f"Iniciando Importación TRD: {file.filename} (Entidad: {entidad_final})",
        entidad_id=log_eid,
        user_name=user_name,
        user_id=user_id
    )

    # 1. OCR por lotes en segundo plano (prioridad máxima)
    background_tasks.add_task(process_ocr_task, doc_id, content, file.filename, user_name, user_id, log_eid)

    # 2. RAG Indexing en background (proceso secundario)
    background_tasks.add_task(index_document_rag, doc_id, content, file.filename, entidad_final, file_url)

    return {"id": doc_id, "status": "processing", "import_id": doc_id}


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
        "expires_at": expires_at,
        "ia_disponible": req.ia_disponible
    }
    
    res = supabase_client.table("invitations").insert(new_inv).execute()
    if not res.data:
        raise HTTPException(500, "No se pudo crear la invitaciÃƒÂ³n")
    
    invitation = res.data[0]
    
    # Asignar IA disponible si el usuario ya existe y se concedio en la invitacion
    if check_profile.data and req.ia_disponible:
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
                        "from": RESEND_FROM_EMAIL,
                        "to": [target_email],
                        "subject": f"Invitacion a {entity_name} - OSE IA",
                        "html": html_content
                    }
                )
                print(f"DEBUG Email Invitation status: {res_email.status_code} - {res_email.text[:200]}")
        except Exception as e:
            print(f"Error enviando mail de invitacion: {e}")
    return {"status": "success", "message": "Invitación enviada", "invitation": invitation}

@router.get("/invitations/my")
async def get_my_invitations(archived: bool = False, current_user: dict = Depends(get_current_user)):
    """Lista las invitaciones recibidas por el usuario logueado"""
    if not supabase_client: return []
    email = current_user.get("email", "").lower()
    if not email: return []
    
    # Filtrar por email y estado de archivado
    query = supabase_client.table("invitations")\
        .select("*, entities(razon_social, sigla), profiles(nombre, apellido)")\
        .eq("email", email)\
        .eq("archived", archived)
        
    res = query.execute()
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
async def get_sent_invitations(entity_id: str | None = None, archived: bool = False, current_user: dict = Depends(get_current_user)):
    """Lista las invitaciones enviadas (Vista Administrador)"""
    if not supabase_client: return []
    if current_user.get("role") not in (SUPERADMIN_ROLE, ADMIN_ROLE, "admin"):
        raise HTTPException(403, "Permisos insuficientes")
    query = supabase_client.table("invitations").select("*, entities(razon_social, sigla), profiles(nombre, apellido)")
    
    # Aplicar filtro de archivado
    query = query.eq("archived", archived)

    if current_user.get("role") == SUPERADMIN_ROLE:
        if entity_id:
            query = query.eq("entity_id", entity_id)
    else:
        # Para administradores multi-entidad, permitir ver lo que enviaron en CUALQUIERA de sus entidades
        allowed_ids = current_user.get("allowed_entities", [])
        if not allowed_ids:
            allowed_ids = [current_user.get("entity_id")]
            
        query = query.in_("entity_id", allowed_ids).eq("inviter_id", current_user.get("user_id"))
    res = query.order("created_at", desc=True).execute()
    return [{
        "id": inv["id"],
        "email": inv["email"],
        "entity_id": inv["entity_id"],
        "entity_name": inv.get("entities", {}).get("razon_social", "Entidad"),
        "role": inv.get("role_invited", "usuario"),
        "status": inv["status"],
        "archived": inv.get("archived", False),
        "created_at": inv["created_at"],
        "expires_at": inv["expires_at"],
        "inviter": f"{inv.get('profiles', {}).get('nombre', 'Admin')} {inv.get('profiles', {}).get('apellido', '')}"
    } for inv in res.data]

@router.delete("/invitations/{inv_id}")
async def cancel_invitation(inv_id: str, current_user: dict = Depends(get_current_user)):
    if not supabase_client: raise HTTPException(503)
    inv_res = supabase_client.table("invitations").select("entity_id", "inviter_id").eq("id", inv_id).execute()
    if not inv_res.data: raise HTTPException(404, "No encontrada")
    inv = inv_res.data[0]
    if current_user.get("role") != SUPERADMIN_ROLE:
        if inv.get("inviter_id") != current_user.get("user_id"):
            raise HTTPException(403, "No tienes permisos para cancelar esta invitaciÃ³n (no eres el creador)")
    supabase_client.table("invitations").update({"status": "cancelada"}).eq("id", inv_id).execute()
    return {"status": "success", "message": "Invitacion cancelada"}

@router.post("/invitations/{inv_id}/resend")
async def resend_invitation(inv_id: str, current_user: dict = Depends(get_current_user)):
    if not supabase_client: raise HTTPException(503)
    inv_res = supabase_client.table("invitations").select("*").eq("id", inv_id).execute()
    if not inv_res.data: raise HTTPException(404, "Invitacion no encontrada")
    inv = inv_res.data[0]
    if current_user.get("role") != SUPERADMIN_ROLE:
        if inv.get("inviter_id") != current_user.get("user_id"):
            raise HTTPException(403, "No tienes permisos para reenviar esta invitaciÃ³n (no eres el creador)")
    new_expiry = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
    supabase_client.table("invitations").update({"expires_at": new_expiry, "status": "pendiente"}).eq("id", inv_id).execute()
    return {"status": "success", "message": "Invitacion reenviada correctamente"}

@router.get("/invitations/check/{token}")
async def check_invitation_public(token: str):
    """Verifica una invitación de forma pública (para el landing page) usando el id como token."""
    if not supabase_client: raise HTTPException(500)
    res = supabase_client.table("invitations").select("*, entities(razon_social)").eq("id", token).execute()
    if not res.data:
        raise HTTPException(404, "InvitaciÃ³n no encontrada")
    
    inv = res.data[0]
    email = inv.get("email", "").lower().strip()
    
    # Verificar si el email ya tiene cuenta en profiles
    check_user = supabase_client.table("profiles").select("id").eq("email", email).execute()
    user_exists = len(check_user.data) > 0
    
    return {
        "id": inv["id"],
        "email": inv["email"],
        "entity_id": inv["entity_id"],
        "entity_name": inv.get("entities", {}).get("razon_social", "Entidad OSE"),
        "role": inv.get("role_invited", "usuario"),
        "status": inv["status"],
        "user_exists": user_exists,
        "sender_id": inv.get("inviter_id")
    }

@router.post("/invitations/{inv_id}/respond")
async def respond_invitation(inv_id: str, resp: InvitationRespond, current_user: dict = Depends(get_current_user)):
    if not supabase_client: raise HTTPException(500)
    res = supabase_client.table("invitations").select("*").eq("id", inv_id).execute()
    if not res.data: raise HTTPException(404, "Invitacion no encontrada")
    invitation = res.data[0]
    
    # Obtener el email real del usuario actual
    user_id = current_user.get("user_id")
    prof_res = supabase_client.table("profiles").select("email").eq("id", user_id).execute()
    user_email = prof_res.data[0]["email"] if prof_res.data else ""
    
    if invitation["email"].lower() != user_email.lower():
        raise HTTPException(403, "Esta invitacion no es para ti")
        
    if invitation["status"] == "aceptada":
        return {"status": "success", "message": "Invitacion aceptada exitosamente (ya estaba aceptada)"}
    elif invitation["status"] != "pendiente":
        raise HTTPException(400, f"Esta invitacion ya ha sido {invitation['status']}")
        
    if resp.action == "accept":
        try:
            # 1. Vincular en profile_entities
            supabase_client.table("profile_entities").upsert({
                "profile_id": user_id,
                "entity_id": invitation["entity_id"],
                "role": invitation.get("role_invited", "usuario")
            }).execute()
            
            # 2. Actualizar perfil principal (rol y IA)
            update_data = {}
            if invitation.get("ia_disponible"):
                update_data["ia_disponible"] = True
            
            # Si no tiene entidad principal asignada, la asignamos
            current_profile = supabase_client.table("profiles").select("perfil", "entidad_id").eq("id", current_user.get("user_id")).execute()
            if current_profile.data and not current_profile.data[0].get("entidad_id"):
                update_data["entidad_id"] = invitation["entity_id"]
            
            if update_data:
                supabase_client.table("profiles").update(update_data).eq("id", current_user.get("user_id")).execute()
            
            # 3. Marcar invitacion como aceptada
            supabase_client.table("invitations").update({"status": "aceptada"}).eq("id", inv_id).execute()
            return {"status": "success", "message": "Invitación aceptada"}
        except Exception as e:
            raise HTTPException(500, f"Error al vincular entidad: {str(e)}")
    else:
        supabase_client.table("invitations").update({"status": "rechazada"}).eq("id", inv_id).execute()
        
        # Notificar al remitente
        sender_id = invitation.get("inviter_id")
        if sender_id:
            sender_res = supabase_client.table("profiles").select("email").eq("id", sender_id).execute()
            if sender_res.data and sender_res.data[0].get("email"):
                sender_email = sender_res.data[0]["email"]
                entity_name = invitation.get("entities", {}).get("razon_social", "Entidad OSE") if "entities" in invitation else "Entidad OSE"
                try:
                    await send_rejection_notification(
                        sender_email=sender_email,
                        recipient_email=current_user.get("email"),
                        entity_name=entity_name,
                        recipient_name=current_user.get("nombre", current_user.get("email"))
                    )
                except Exception as e:
                    print(f"Error enviando notificación de rechazo: {e}")
                    
        return {"status": "success", "message": "Invitación rechazada."}

async def send_rejection_notification(sender_email, recipient_email, entity_name, recipient_name):
    resend_api_key = os.getenv("RESEND_API_KEY")
    if not resend_api_key: return
    
    try:
        async with httpx.AsyncClient() as client:
            await client.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {resend_api_key}", "Content-Type": "application/json"},
                json={
                    "from": os.getenv("RESEND_FROM_EMAIL", "OSE IA <notificaciones@ose-ia.com>"),
                    "to": sender_email,
                    "subject": f"Invitación rechazada - {entity_name}",
                    "html": f"""
                        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                            <h2 style="color: #e53e3e;">Invitación Rechazada</h2>
                            <p>El usuario <strong>{recipient_name}</strong> ({recipient_email}) ha rechazado la invitación para unirse a la entidad <strong>{entity_name}</strong>.</p>
                            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
                            <p style="font-size: 12px; color: #666;">Este es un mensaje automático de OSE IA.</p>
                        </div>
                    """
                }
            )
    except Exception as e:
        print(f"Error in send_rejection_notification: {e}")

@router.post("/activity-logs")
async def create_activity_log(req: ActivityLogCreate, current_user: dict = Depends(get_current_user)):
    if not supabase_client: raise HTTPException(500, "Base de datos desconectada")
    
    # Priorizar entidad del request, si no usar la del usuario activo
    eid = req.entidad_id or current_user.get("entity_id")
    
    log_data = {
        "user_name": req.user_name, 
        "message": req.message,
        "entidad_id": eid,
        "user_id": current_user.get("user_id")
    }
    
    res = supabase_client.table("activity_logs").insert(log_data).execute()
    return res.data

@router.patch("/invitations/{inv_id}/archive")
async def archive_invitation(inv_id: str, req: InvitationArchive, current_user: dict = Depends(get_current_user)):
    """Archiva o desarchiva una invitación específica."""
    if not supabase_client: raise HTTPException(500, "Base de datos desconectada")
    
    # Verificar permiso sobre la invitación
    inv_res = supabase_client.table("invitations").select("entity_id").eq("id", inv_id).execute()
    if not inv_res.data:
        raise HTTPException(404, "Invitación no encontrada")
    
    inv = inv_res.data[0]
    recipient_email = inv.get("email", "").lower()
    is_recipient = (current_user.get("email", "").lower() == recipient_email)

    if current_user.get("role") != SUPERADMIN_ROLE:
        if inv.get("inviter_id") != current_user.get("user_id") and not is_recipient:
            raise HTTPException(403, "No tienes permisos para archivar esta invitación")

    res = supabase_client.table("invitations").update({"archived": req.archived}).eq("id", inv_id).execute()
    return {"status": "ok", "archived": req.archived}

@router.post("/invitations/bulk-archive")
async def bulk_archive_invitations(req: InvitationBulkArchive, current_user: dict = Depends(get_current_user)):
    """Archiva múltiples invitaciones a la vez."""
    if not supabase_client: raise HTTPException(500, "Base de datos desconectada")
    if not req.ids:
        return {"status": "ok", "count": 0}

    # Si no es superadmin, verificar permisos para cada invitación (seguridad estricta)
    if current_user.get("role") != SUPERADMIN_ROLE:
        invs = supabase_client.table("invitations").select("entity_id").in_("id", req.ids).execute()
        if not invs.data:
            return {"status": "ok", "count": 0}
            
        entities_involved = set(i["entity_id"] for i in invs.data)
        for eid in entities_involved:
            admin_check = supabase_client.table("profile_entities").select("role").eq("profile_id", current_user.get("user_id")).eq("entity_id", eid).execute()
            if not admin_check.data or admin_check.data[0]["role"] not in (ADMIN_ROLE, "admin", "superadmin"):
                raise HTTPException(403, f"No tienes permisos sobre la entidad {eid}")

    res = supabase_client.table("invitations").update({"archived": req.archived}).in_("id", req.ids).execute()
    return {"status": "ok", "count": len(res.data or [])}

@router.get("/activity-logs")
async def get_activity_logs(user: dict = Depends(get_current_user)):
    """Lista los registros de actividad para la entidad del usuario o todos si es superadmin."""
    try:
        supabase_client.table("activity_logs").delete().lt("created_at", first_day_current_month).execute()
    except Exception as e:
        print(f"Error cleaning up old logs: {e}")

    # 2. Fetch logs with filtering
    query = supabase_client.table("activity_logs").select("*").gte("created_at", first_day_current_month)
    
    # Si no es superadmin, filtrar por entidad
    if current_user.get("role") != SUPERADMIN_ROLE:
        eid = current_user.get("entity_id")
        if eid:
            query = query.eq("entidad_id", eid)
        else:
            # Si no tiene entidad, no debería ver nada o solo sus propios logs
            query = query.eq("user_id", current_user.get("user_id"))
            
    res = query.order("created_at", desc=True).execute()
    return res.data or []

@router.get("/activity-logs/export")
async def export_activity_logs(
    start_date: str, 
    end_date: str, 
    current_user: dict = Depends(get_current_user)
):
    """Returns activity logs within a specific date range for Excel export."""
    if not supabase_client: raise HTTPException(500, "Base de datos desconectada")
    
    # Simple validation: ensure end_date is at the end of the day
    # if dates are YYYY-MM-DD, we should query gte start and lte end + 'T23:59:59'
    query_start = f"{start_date}T00:00:00"
    query_end = f"{end_date}T23:59:59"
    
    query = supabase_client.table("activity_logs").select("*").gte("created_at", query_start).lte("created_at", query_end)
    
    # Filtro de entidad para no superadmins
    if current_user.get("role") != SUPERADMIN_ROLE:
        eid = current_user.get("entity_id")
        if eid:
            query = query.eq("entidad_id", eid)
        else:
            query = query.eq("user_id", current_user.get("user_id"))
            
    res = query.order("created_at", desc=True).execute()
        
    if not res.data:
        raise HTTPException(status_code=404, detail="No se encontraron registros en el rango seleccionado")
    return filtered

@router.post("/auth/signup")
async def signup(req: UserSignUp):
    # Crea un nuevo usuario en AWS Cognito y DynamoDB
    email = req.email.strip().lower()
    
    # 1. Registrar en Cognito
    cognito_id = None
    try:
        resp = await cognito.sign_up(
            username=req.username,
            password=req.password,
            email=email,
            name=req.nombre,
            family_name=req.apellido,
            phone=req.phone
        )
        cognito_id = resp.get("UserSub")
    except Exception as e:
        # SI EL USUARIO YA EXISTE EN COGNITO:
        # Es posible que sea un usuario "huérfano" (borrado de DB pero no de Cognito)
        err_str = str(e)
        if "UsernameExistsException" in err_str or "already exists" in err_str.lower():
            print(f" [AUTH] Usuario {req.username} ya existe en Cognito. Intentando auto-limpieza...")
            await cognito.force_cleanup_user(req.username)
            # Re-intentar el registro
            try:
                resp = await cognito.sign_up(
                    username=req.username,
                    password=req.password,
                    email=email,
                    name=req.nombre,
                    family_name=req.apellido,
                    phone=req.phone
                )
                cognito_id = resp.get("UserSub")
            except Exception as retry_e:
                raise HTTPException(status_code=400, detail=f"El usuario ya existe y no se pudo limpiar: {str(retry_e)}")
        else:
            if hasattr(e, "status_code"): raise e
            raise HTTPException(status_code=400, detail=str(e))

    # 2. Guardar perfil en DynamoDB (Sincronizado con el ID de Cognito)
    new_user = {
        "PK": f"USER#{cognito_id}",
        "SK": "PROFILE",
        "id": cognito_id,
        "nombre": req.nombre,
        "apellido": req.apellido,
        "username": req.username,
        "email": email,
        "username": username,
        "password": req.password,
        "perfil": DEFAULT_ROLE,
        "estado": "Activo" if invitation else "Inactivo",
        "is_activated": True if invitation else False,
        "entidad_id": invitation["entity_id"] if invitation else None,
        "ia_disponible": invitation.get("ia_disponible", False) if invitation else False
    }
    prof_insert = supabase_client.table("profiles").insert(new_profile).execute()
    if not prof_insert.data:
        raise HTTPException(500, "Error al crear el perfil.")
    user_id = prof_insert.data[0]["id"]
    user_entidades = []
    active_role = DEFAULT_ROLE
    if invitation:
        active_role = invitation.get("role_invited", DEFAULT_ROLE)
        supabase_client.table("profile_entities").insert({
            "profile_id": user_id,
            "entity_id": invitation["entity_id"],
            "role": active_role
        }).execute()
        supabase_client.table("invitations").update({"status": "aceptada"}).eq("id", invitation["id"]).execute()
        user_entidades.append(invitation["entity_id"])
    return {
        "id": user_id,
        "nombre": req.nombre,
        "apellido": req.apellido,
        "email": email,
        "username": username,
        "perfil": DEFAULT_ROLE,
        "role": active_role,
        "estado": new_profile["estado"],
        "isActivated": new_profile["is_activated"],
        "entidadId": invitation["entity_id"] if invitation else None,
        "entidadIds": user_entidades,
        "token": jwt.encode({
            "user_id": str(user_id),
            "role": active_role,
            "entity_id": invitation["entity_id"] if invitation else None
        }, JWT_SECRET, algorithm=JWT_ALGORITHM)
    }
    await db.put_item("users", new_user)
    return {"status": "ok", "message": "Usuario registrado exitosamente en AWS"}

@router.post("/request-reset")
async def request_reset(req: PasswordResetRequest):
    await cognito.forgot_password(req.email.strip().lower())
    
    # Enviar email personalizado vía Resend (opcional pero solicitado por diseño)
    resend_api_key = os.getenv("RESEND_API_KEY")
    if resend_api_key:
        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
        html_content = get_email_html(
            title="Restablece tu contraseña",
            greeting="Hola,",
            message="Hemos recibido una solicitud para restablecer la contraseña de tu cuenta en OSE IA.",
            button_text="Cambiar contraseña",
            button_link=f"{frontend_url}/?view=reset-password&email={req.email}",
            extra_info="Recibirás un segundo correo oficial con el código de verificación necesario para completar este proceso.",
            security_note="Si no solicitaste este cambio, puedes ignorar este correo de forma segura."
        )
        try:
            async with httpx.AsyncClient() as client:
                await client.post(
                    "https://api.resend.com/emails",
                    headers={"Authorization": f"Bearer {resend_api_key}", "Content-Type": "application/json"},
                    json={
                        "from": os.getenv("RESEND_FROM_EMAIL", "OSE IA <onboarding@resend.dev>"),
                        "to": req.email,
                        "subject": "Restablece tu contraseña - OSE IA",
                        "html": html_content
                    }
                )
        except Exception as e:
            print(f"Error enviando correo de recuperación: {e}")

    return {"message": "Si el correo existe, se ha enviado un código de recuperación."}

@router.post("/perform-reset")
async def perform_reset(req: PerformResetRequest):
    await cognito.confirm_forgot_password(
        req.email.strip().lower(),
        req.code.strip(),
        req.new_password
    )
    return {"message": "Contraseña actualizada exitosamente."}

@router.get("/health-check")
async def health_check():
    return {"status": "ok", "message": "OSE Backend AWS Serverless ready"}

app.include_router(router)

handler = Mangum(app)

@app.get("/")
async def root_main():
    return {"message": "OSE IA API Gateway is running"}

if __name__ == '__main__':
    uvicorn.run(app, host='0.0.0.0', port=8000)
@app.get("/api/debug-auth")
async def debug_auth(user: dict = Depends(get_current_user)):
    whitelist_raw = os.getenv("SUPERADMIN_EMAILS", "superadmin@ose.com,ivandchaves@gmail.com")
    current_whitelist = [e.strip().lower() for e in whitelist_raw.split(",") if e.strip()]
    return {
        "user_claims": user,
        "superadmin_whitelist": current_whitelist,
        "is_in_whitelist": user.get("email", "").lower().strip() in current_whitelist,
        "final_role_assigned": user.get("role"),
        "dynamo_prefix": db.prefix
    }
