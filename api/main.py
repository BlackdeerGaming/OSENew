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

from .aws.ai_processor import ai

from .aws.cognito_auth import cognito

from .aws.s3_storage import s3_client



#  FastAPI App 



app = FastAPI(title="OSE IA - AWS Serverless SaaS")



#  Endpoints 
router = APIRouter(prefix="/api")



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
        # Recargar lista de superadmins del entorno para asegurar que refleje cambios en .env
        whitelist_raw = os.getenv("SUPERADMIN_EMAILS", "superadmin@ose.com,ivandchaves@gmail.com")
        current_superadmins = [e.strip().lower() for e in whitelist_raw.split(",") if e.strip()]
        
        print(f"DEBUG LOGIN: Identifier={identifier}")
        print(f"DEBUG LOGIN: SuperAdmin Whitelist={current_superadmins}")
        is_superadmin = identifier in current_superadmins
        print(f"DEBUG LOGIN: IsSuperAdmin={is_superadmin}")
        
        user_profile = None
        # Escaneamos la tabla users para encontrar el email
        users = await db.scan_table("users")
        for u in users:
            if u.get("email", "").lower() == identifier:
                user_profile = u
                break
        
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

    estado: str | None = None

    perfil: str | None = None

    entidadId: str | None = None

    entidadIds: list[str] | None = None

    isActivated: bool | None = None

    iaDisponible: bool | None = None



class UserSignUp(BaseModel):
    nombre: str
    email: str
    password: str

class UserActivate(BaseModel):
    token: str
    password: str

class InvitationCreate(BaseModel):
    email: str
    entity_id: str
    role: str = "usuario"

class ActivityLogCreate(BaseModel):
    message: str
    user_name: str

    apellido: str | None = ""

    email: str

    username: str

    password: str

    phone: str | None = ""



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

                "PK": entidad or "GLOBAL",

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



async def process_ocr_task(doc_id: str, content: bytes, filename: str):
    """
    Proceso de segundo plano para extraer texto e imagenes para Vision IA.
    Actualiza el estado a 'reviewing' al terminar para que el usuario pueda aprobar.
    """
    print(f"--- Iniciando OCR NATIVO (Vision) para: {filename} ---")

    

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



    # Obtener el file_url y entidad_id actuales de la sesin

    file_url = None

    entidad_id = None

    try:

        row = await db.get_item("RagDocuments", doc_id)

        if row:

            file_url = row.data[0]["metadata"].get("file_url")

            entidad_id = row.data[0]["metadata"].get("entidad_id")

    except: pass



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

            "status": "reviewing",

            "actions": parsed_actions,

            "message": ai_message,

            "created_at": datetime.now().isoformat()

        }

        

        await db.update_item("RagDocuments", doc_id, None, {"metadata": doc_metadata})

        

        print(f"OK: Proceso terminado para: {filename}")

        

    except Exception as e:

        print(f"Error crtico: {e}")

        try:

            await db.update_item("RagDocuments", doc_id, None, {

                "metadata": {

                    "source": filename, "status": "error", "message": str(e),

                    "type": "temp_trd_session", "created_at": datetime.now().isoformat()

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
    """Lista todas las entidades (solo para Superadmin o filtrado por entidad)."""
    try:
        if user.get("role") == SUPERADMIN_ROLE:
            items = await db.scan_table("entities")
        else:
            entity_id = user.get("entity_id")
            item = await db.get_item("entities", f"ENTITY#{entity_id}", "METADATA")
            items = [item] if item else []
        return items
    except Exception as e:
        print(f"Error listing entities: {e}")
        return []

@router.get("/users")
async def get_users(user: dict = Depends(get_current_user)):
    """Lista los usuarios (solo para Superadmin o filtrado por entidad)."""
    try:
        if user.get("role") == SUPERADMIN_ROLE:
            items = await db.scan_table("users")
        else:
            entity_id = user.get("entity_id")
            # Query users by GSI if available, or scan and filter
            all_users = await db.scan_table("users")
            items = [u for u in all_users if u.get("entidadId") == entity_id or entity_id in (u.get("entidadIds") or [])]
        return items
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
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/users/{user_id}")
async def delete_user_endpoint(user_id: str, user: dict = Depends(require_super_admin)):
    """Elimina un usuario de DynamoDB."""
    try:
        await db.delete_item("users", f"USER#{user_id}", "PROFILE")
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/invitations")
async def get_invitations(user: dict = Depends(get_current_user)):
    """Lista las invitaciones (solo para Superadmin o filtrado por entidad)."""
    try:
        if user.get("role") == SUPERADMIN_ROLE:
            items = await db.scan_table("invitations")
        else:
            entity_id = user.get("entity_id")
            all_invites = await db.scan_table("invitations")
            items = [i for i in all_invites if i.get("entity_id") == entity_id]
        return items
    except Exception as e:
        print(f"Error listing invitations: {e}")
        return []

@router.get("/invitations/my")
async def get_my_invitations(user: dict = Depends(get_current_user)):
    """Lista las invitaciones pendientes para el usuario actual."""
    email = user.get("email")
    if not email: return []
    try:
        all_invites = await db.scan_table("invitations")
        return [i for i in all_invites if i.get("email", "").lower() == email.lower() and i.get("status") == "pending"]
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
        item["PK"] = f"INVITE#{invite_id}"
        item["SK"] = "METADATA"
        item["id"] = invite_id
        item["status"] = "pending"
        item["created_at"] = datetime.now().isoformat()
        await db.put_item("invitations", item)
        return {"status": "ok", "id": invite_id}
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

        entidad = user.get("entity_id") or "GLOBAL"

        # Actualizar el item principal (suponiendo que doc_id es el SK)

        await db.update_item("RagDocuments", entidad, f"RAG#{doc_id}", payload)

        return {"status": "success"}

    except Exception as e:

        raise HTTPException(500, str(e))



@router.delete("/rag-documents/{doc_id}")

async def delete_rag_document(doc_id: str, user: dict = Depends(get_current_user)):
    """Elimina un documento de DynamoDB y S3."""

    try:

        entidad = user.get("entity_id") or "GLOBAL"

        sk = f"RAG#{doc_id}"

        

        # 1. Obtener para borrar de S3 si aplica

        item = await db.get_item("RagDocuments", entidad, sk)

        if item and item.get("metadata", {}).get("file_url"):

            file_url = item["metadata"]["file_url"]

            # Extraer path de presigned URL o guardado

            # Por ahora simplificamos, pero se debera borrar de S3

            pass

            

        await db.delete_item("RagDocuments", entidad, sk)

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

async def agent_action(request: AgentActionRequest):

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

async def get_chat_history(assistant: str, user: dict = Depends(get_current_user)):
    """Recupera el historial de chat privado para un usuario y asistente especifico."""

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

    ###Guarda o actualiza el historial de chat privado. Limita a los ltimos 50 mensajes.###

    if not db: raise HTTPException(status_code=503)

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
        item = {
            "PK": f"USER#{user_id}",
            "SK": f"HISTORY#{assistant}",
            "messages": [m for m in payload.messages[-50:]],
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

@router.post("/request-reset")
async def request_reset(req: PasswordResetRequest):
    await cognito.forgot_password(req.email.strip().lower())
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