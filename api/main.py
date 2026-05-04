import os

import re
from typing import List, Optional, Dict, Any

import base64
import boto3
from boto3.dynamodb.conditions import Attr, Key

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



import json

import uuid

from datetime import datetime, timedelta, timezone

#  Configuracin 



#  Inicializar Servicios compartidos (AWS DynamoDB, LLM, Embeddings)
from .db import db, llm, embeddings

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

    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],

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



async def index_document_rag(doc_id: str | None, content: bytes, filename: str, entidad: str, file_url: str):
    """
    Background Task: Extrae texto, realiza chunking.
    """
    print(f"--- RAG BACKGROUND: Iniciando indexacion semantica para {filename} ---")

    if not db:

        print("RAG BACKGROUND: Saltando, Base de datos no est configurada.")

        return



    try:

        cleaned_text = await ai.extract_text_from_pdf(content)

        if not cleaned_text:

            print("RAG BACKGROUND: No se extrajo texto til.")

            return

            

        text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)

        docs = text_splitter.create_documents([cleaned_text])

        

        for i, doc in enumerate(docs):

            item = {

                "PK": f"ENTITY#{entidad}" if entidad else "ENTITY#GLOBAL",

                "SK": f"RAG#{filename}#{i}",

                "content": doc.page_content,

                "metadata": {

                    "source": filename,

                    "chunk": i,

                    "entidad_id": entidad or "",

                    "file_url": file_url or "",

                    "status": "success",

                    "type": "rag_chunk",

                    "created_at": datetime.now().isoformat()

                }

            }

            await db.put_item("RagDocuments", item)

            

        print(f"RAG BACKGROUND:  xito indexando {filename} en DynamoDB.")

    except Exception as e:

        print(f"RAG BACKGROUND ERROR: Fallo indexacion -> {e}")



async def process_ocr_task(doc_id: str, content: bytes, filename: str, entidad_id: str, user_id: str = None):
    """
    Proceso de segundo plano para extraer texto e imagenes para Vision IA.
    Actualiza el estado a 'reviewing' al terminar para que el usuario pueda aprobar.
    """
    pk_val = f"ENTITY#{entidad_id}" if entidad_id else "ENTITY#GLOBAL"
    sk_val = f"IMPORT#{doc_id}"
    
    print(f"--- Iniciando OCR NATIVO (Vision) para: {filename} (PK: {pk_val}) ---")


    

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

                extracted_text += f"\n--- PGINA {i+1} ---\n" + text_chunk

            

            pix = page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5))

            img_data = pix.tobytes("png")

            b64 = base64.b64encode(img_data).decode("utf-8")

            images_base64.append(b64)

            

        fitz_doc.close()

    except Exception as e:

        print(f"Error procesando PDF: {e}")



    # Obtener el file_url actual de la sesión
    file_url = None
    try:
        row = await db.get_item("RagDocuments", pk_val, sk_val)
        if row:
            file_url = row.get("metadata", {}).get("file_url")
    except Exception as e:
        print(f"Error recuperando metadata inicial: {e}")




    try:

        print(f"Solicitando Anlisis Visual TRD para: {filename}")

        

        messages = [

            SystemMessage(content=TRD_ARCHITECT_PROMPT),

        ]

        

        user_content = [

            {"type": "text", "text": f"Analiza esta TRD. Texto extrado: \n{extracted_text[:4000]}"}

        ]

        

        for b64_img in images_base64[:5]:

            user_content.append({

                "type": "image_url",

                "image_url": {"url": f"data:image/png;base64,{b64_img}"}

            })

            

        messages.append(HumanMessage(content=user_content))

        

        parsed_actions = []

        ai_message = "Mdulo de Visin complet el anlisis."

        

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
            "user_id": user_id,
            "status": "reviewing",

            "actions": parsed_actions,

            "message": ai_message,

            "created_at": datetime.now().isoformat()

        }

        

        # --- VERIFICACIÓN DE CANCELACIÓN ---
        # Antes de guardar, verificamos si el usuario canceló la sesión en el interín
        try:
            current_row = await db.get_item("RagDocuments", pk_val, sk_val)
            if not current_row:
                print(f"⚠️ El registro {sk_val} ya no existe. Abortando guardado.")
                return
            
            current_status = current_row.get("metadata", {}).get("status")
            if current_status == "cancelled":
                print(f"🚫 La sesión {sk_val} fue cancelada. No se guardarán los resultados del OCR.")
                return
        except Exception as check_err:
            print(f"Error verificando estado de cancelación: {check_err}")

        await db.update_item("RagDocuments", pk_val, sk_val, {"metadata": doc_metadata})

        

        print(f"OK: Proceso terminado para: {filename}")

        

    except Exception as e:

        print(f"Error crtico: {e}")

        try:

            await db.update_item("RagDocuments", pk_val, sk_val, {
                "metadata": {
                    "source": filename, "status": "error", "message": str(e),
                    "type": "trd_import_session", "created_at": datetime.now().isoformat()
                }
            })

        except: pass









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
    doc_id = str(uuid.uuid4())
    entidad_actual = user.get("entity_id") or entidad_id or "GLOBAL"
    pk_val = f"ENTITY#{entidad_actual}" if entidad_actual else "ENTITY#GLOBAL"
    
    # 1. Crear registro inicial en RagDocuments (para que el frontend lo vea en 'analyzing')
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

async def get_rag_documents(entidad_id: str | None = None, user: dict = Depends(get_current_user)):
    """Lista los documentos unicos en el RAG (agrupados por source)."""

    try:

        entidad_actual = user.get("entity_id") or entidad_id or "GLOBAL"

        if user.get("role") == SUPERADMIN_ROLE and entidad_id:

            entidad_actual = entidad_id

            

        items = await db.query_by_entity("RagDocuments", entidad_actual)

        

        # Agrupar por source para no repetir chunks

        seen_sources = {}

        unique_docs = []

        

        for item in items:

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
    """Actualiza la metadata de un documento en DynamoDB."""

    try:

        entidad_raw = user.get("entity_id") or "GLOBAL"
        pk = f"ENTITY#{entidad_raw}" if entidad_raw != "GLOBAL" else "ENTITY#GLOBAL"
        
        # Si el payload contiene solo 'status', lo metemos en metadata
        if "status" in payload and len(payload) == 1:
            # Primero obtenemos el item para no perder el resto de metadata
            sk_options = [f"IMPORT#{doc_id}", f"RAG#{doc_id}"]
            for sk in sk_options:
                item = await db.get_item("RagDocuments", pk, sk)
                if item:
                    meta = item.get("metadata", {})
                    meta["status"] = payload["status"]
                    await db.update_item("RagDocuments", pk, sk, {"metadata": meta})
                    return {"status": "success"}
        
        # Fallback genérico
        try:
            await db.update_item("RagDocuments", pk, f"RAG#{doc_id}", payload)
        except:
            await db.update_item("RagDocuments", pk, f"IMPORT#{doc_id}", payload)
            
        return {"status": "success"}

    except Exception as e:

        raise HTTPException(500, str(e))



@router.delete("/rag-documents/{doc_id}")

async def delete_rag_document(doc_id: str, user: dict = Depends(get_current_user)):
    """Elimina un documento de DynamoDB y S3."""

    try:

        entidad_raw = user.get("entity_id") or "GLOBAL"
        pk = f"ENTITY#{entidad_raw}" if entidad_raw != "GLOBAL" else "ENTITY#GLOBAL"
        
        # 1. Identificar si es RAG o IMPORT
        sk = f"RAG#{doc_id}"
        item = await db.get_item("RagDocuments", pk, sk)
        if not item:
            sk = f"IMPORT#{doc_id}"
            item = await db.get_item("RagDocuments", pk, sk)

        

        # 1. Obtener para borrar de S3 si aplica

        item = await db.get_item("RagDocuments", pk, sk)

        if item and item.get("metadata", {}).get("file_url"):

            file_url = item["metadata"]["file_url"]

            # Extraer path de presigned URL o guardado

            # Por ahora simplificamos, pero se debera borrar de S3

            pass

            

        # 3. Borrar de DynamoDB
        await db.delete_item("RagDocuments", pk, sk)

        return {"status": "success"}

    except Exception as e:

        raise HTTPException(500, str(e))



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
   - PARA CREAR SUBSERIES: Requiere Dependencia, Serie y Codigo propio. Si hay ambiguedad, solicita los datos faltantes antes de generar cualquier accion.
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
        return {"status": "error", "message": str(e)}

@router.get("/activity-logs")
async def get_activity_logs(user: dict = Depends(get_current_user)):
    """Lista los registros de actividad para la entidad del usuario o todos si es superadmin."""
    try:
        if user.get("role") == SUPERADMIN_ROLE:
            # Para superadmin, podemos escanear toda la tabla o filtrar por alguna lógica
            items = await db.scan_table("activity_logs")
        else:
            entity_id = user.get("entity_id")
            if not entity_id:
                return []
            items = await db.query_by_entity("activity_logs", entity_id, sk_prefix="LOG#")
        
        # Ordenar por fecha descendente
        items.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        return items[:50] # Limitar a los últimos 50 para el dashboard
    except Exception as e:
        print(f"Error fetching logs: {e}")
        return []

@router.post("/activity-logs")
async def create_activity_log(req: ActivityLogCreate, user: dict = Depends(get_current_user)):
    """Crea un nuevo registro de actividad."""
    try:
        entity_id = user.get("entity_id") or "GLOBAL"
        log_id = str(uuid.uuid4())
        item = {
            "PK": entity_id,
            "SK": f"LOG#{log_id}",
            "id": log_id,
            "entity_id": entity_id,
            "message": req.message,
            "user_name": req.user_name,
            "created_at": datetime.now().isoformat()
        }
        await db.put_item("activity_logs", item)
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/activity-logs/export")
async def export_activity_logs(
    start_date: str, 
    end_date: str, 
    current_user: dict = Depends(get_current_user)
):
    # Returns activity logs within a specific date range for Excel export
    entity_id = current_user.get("entity_id")
    items = await db.query_by_entity("activity_logs", entity_id, sk_prefix="LOG#")
    filtered = [i for i in items if start_date <= i.get("created_at", "") <= end_date]
    if not filtered:
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
        "phone": req.phone,
        "role": "usuario",
        "created_at": datetime.now().isoformat()
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
