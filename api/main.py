import os
import random
import re
from typing import List, Optional, Dict, Any

import base64
import hashlib
from dotenv import load_dotenv



#  CRITICAL: Load env vars FIRST before any other imports that read os.getenv 

load_dotenv()



from fastapi import FastAPI, File, UploadFile, HTTPException, APIRouter, BackgroundTasks, Depends, Request, Form
from fastapi.responses import Response

from fastapi.middleware.cors import CORSMiddleware


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
import io
from PIL import Image, ImageEnhance, ImageOps
from datetime import datetime, timedelta, timezone

#  Configuracin 

OPENROUTER_API_KEY  = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_MODEL    = os.getenv("OPENROUTER_MODEL", "google/gemini-2.0-flash-001")
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


def get_reset_code_email_html(nombre: str, code: str) -> str:
    """Genera el HTML del email de recuperación de contraseña con el código de verificación."""
    digits = list(code)
    def digit_cell(d: str, is_last: bool) -> str:
        spacer = "" if is_last else '<td style="width:10px;"></td>'
        return f"""
        <td style="vertical-align:middle;">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="width:52px;height:64px;background-color:#0F1F3A;border:2px solid #09C8A2;border-radius:10px;text-align:center;vertical-align:middle;box-shadow:0 0 12px rgba(9,200,162,0.15);">
              <span style="font-family:'Courier New',Courier,monospace;font-size:30px;font-weight:800;color:#09C8A2;line-height:64px;">{d}</span>
            </td>
          </tr></table>
        </td>{spacer}"""

    digit_cells = "".join(digit_cell(d, i == len(digits) - 1) for i, d in enumerate(digits))
    saludo = f"Hola{', ' + nombre if nombre else ''},"

    return f"""<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Código de Recuperación – OSE IA</title>
</head>
<body style="margin:0;padding:0;background-color:#EEF2F7;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">

<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#EEF2F7;padding:48px 20px;">
  <tr><td align="center">

    <!-- CARD -->
    <table role="presentation" cellpadding="0" cellspacing="0" width="560" style="max-width:560px;width:100%;background-color:#FFFFFF;border-radius:20px;overflow:hidden;box-shadow:0 24px 64px rgba(4,13,27,0.10);">

      <!-- HEADER -->
      <tr>
        <td style="background-color:#040D1B;padding:44px 48px 36px;text-align:center;">
          <table cellpadding="0" cellspacing="0" width="100%"><tr><td align="center">
            <table cellpadding="0" cellspacing="0"><tr>
              <td style="width:52px;height:52px;background:linear-gradient(135deg,#09C8A2 0%,#06A889 100%);border-radius:14px;text-align:center;vertical-align:middle;">
                <span style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:22px;font-weight:900;color:#040D1B;line-height:52px;letter-spacing:-1px;">O</span>
              </td>
              <td style="padding-left:14px;text-align:left;vertical-align:middle;">
                <p style="margin:0;font-size:22px;font-weight:800;color:#FFFFFF;letter-spacing:-0.4px;line-height:1.1;">OSE IA</p>
                <p style="margin:2px 0 0;font-size:11px;color:#09C8A2;letter-spacing:2px;text-transform:uppercase;font-weight:600;">Inteligencia Archivística</p>
              </td>
            </tr></table>
          </td></tr></table>
        </td>
      </tr>

      <!-- ACCENT BAR -->
      <tr>
        <td style="height:3px;background:linear-gradient(90deg,#09C8A2 0%,#06E5BE 60%,#09C8A2 100%);"></td>
      </tr>

      <!-- BODY -->
      <tr>
        <td style="padding:44px 48px 32px;">

          <!-- Badge -->
          <table cellpadding="0" cellspacing="0" width="100%"><tr><td align="center" style="padding-bottom:28px;">
            <span style="display:inline-block;background-color:#F0FBF8;border:1px solid #B8EFE3;color:#0A8F72;font-size:10px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;padding:6px 16px;border-radius:100px;">Recuperación de Contraseña</span>
          </td></tr></table>

          <!-- Title & greeting -->
          <p style="margin:0 0 6px;font-size:24px;font-weight:800;color:#0C1A2E;text-align:center;letter-spacing:-0.4px;">{saludo}</p>
          <p style="margin:0 0 32px;font-size:15px;color:#64748B;text-align:center;line-height:1.65;">
            Recibiste este correo porque solicitaste restablecer la contraseña de tu cuenta en <strong style="color:#0C1A2E;">OSE IA</strong>. Usa el código a continuación.
          </p>

          <!-- CODE BOX -->
          <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:28px;">
            <tr><td align="center">
              <table cellpadding="0" cellspacing="0" style="background-color:#040D1B;border-radius:16px;width:100%;">
                <tr><td align="center" style="padding:32px 32px 16px;">
                  <p style="margin:0 0 20px;font-size:11px;color:#4A6580;letter-spacing:2px;text-transform:uppercase;font-weight:600;">Tu código de verificación</p>
                  <table cellpadding="0" cellspacing="0"><tr>{digit_cells}</tr></table>
                </td></tr>
                <tr><td align="center" style="padding:16px 32px 28px;">
                  <table cellpadding="0" cellspacing="0"><tr>
                    <td style="background-color:#1A2A3A;border-radius:8px;padding:8px 18px;">
                      <p style="margin:0;font-size:12px;color:#F59E0B;font-weight:700;letter-spacing:0.3px;">&#9203; Expira en 15 minutos</p>
                    </td>
                  </tr></table>
                </td></tr>
              </table>
            </td></tr>
          </table>

          <!-- Instructions box -->
          <table cellpadding="0" cellspacing="0" width="100%" style="background-color:#F8FAFC;border-radius:12px;border:1px solid #E2E8F0;margin-bottom:32px;">
            <tr><td style="padding:20px 24px;">
              <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#334155;">¿Cómo usar este código?</p>
              <p style="margin:0;font-size:13px;color:#64748B;line-height:1.65;">Ingresa estos 6 dígitos en la pantalla de recuperación junto con tu nueva contraseña. Actúa antes de que expire para completar el proceso.</p>
            </td></tr>
          </table>

        </td>
      </tr>

      <!-- SECURITY NOTE -->
      <tr>
        <td style="padding:0 48px 40px;">
          <table cellpadding="0" cellspacing="0" width="100%">
            <tr><td style="border-top:1px solid #F1F5F9;padding-top:24px;">
              <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#94A3B8;text-transform:uppercase;letter-spacing:1.2px;">Aviso de seguridad</p>
              <p style="margin:0;font-size:13px;color:#94A3B8;line-height:1.7;">Si no solicitaste este cambio, ignora este mensaje. Tu contraseña no se modificará. <strong>Nunca compartas este código</strong> con nadie — OSE IA jamás te lo pedirá.</p>
            </td></tr>
          </table>
        </td>
      </tr>

      <!-- FOOTER -->
      <tr>
        <td style="background-color:#040D1B;padding:28px 48px;text-align:center;border-radius:0 0 20px 20px;">
          <p style="margin:0 0 4px;font-size:14px;font-weight:800;color:#FFFFFF;letter-spacing:-0.2px;">OSE IA</p>
          <p style="margin:0 0 16px;font-size:11px;color:#4A6580;letter-spacing:1px;text-transform:uppercase;">Gestión Documental Inteligente</p>
          <p style="margin:0;font-size:11px;color:#2A3D50;">© 2025 OSE IA. Todos los derechos reservados.</p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>

</body>
</html>"""


from .aws.ai_processor import ai
from .trd_import_agent import trd_import_agent

from .aws.cognito_auth import cognito

from .aws.s3_storage import s3_client

from .quota import (
    check_storage_quota,
    increment_storage_used,
    get_quota_status,
    recalculate_dependency_count,
    recalculate_storage_used,
)



#  FastAPI App 



app = FastAPI(title="OSE IA - AWS Serverless SaaS")



#  Endpoints 
router = APIRouter(prefix="/api")



_cors_origins = [
    "http://localhost:5173", "http://127.0.0.1:5173",
    "http://localhost:5174", "http://127.0.0.1:5174",
    "http://localhost:5175", "http://127.0.0.1:5175",
]
_extra_origin = os.getenv("FRONTEND_URL", "")
if _extra_origin and _extra_origin not in _cors_origins:
    _cors_origins.append(_extra_origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
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

TRD_ARCHITECT_PROMPT = """Eres el Arquitecto Archivistico de OSE IA, experto en digitalizacion y extraccion de Tablas de Retencion Documental (TRD) segun la Ley 594 de 2000 de Colombia.

OBJETIVO:
Se te proporciona texto extraido por OCR de un documento TRD y opcionalmente imagenes de sus paginas. Debes analizar el contenido y extraer TODOS los registros de la tabla de retencion documental.

REGLAS DE EXTRACCION:

1. CODIGOS:
   - Dependencia/Seccion: codigo de 2-3 digitos (ej: 100, 200, 110).
   - Serie documental: codigo compuesto (ej: 100.1, 200-70, 1.1).
   - Subserie: extension del codigo de serie (ej: 100.1.01, 1.1.1).

2. RETENCION (en anios enteros):
   - Gestion (AG): anios en archivo de oficina. Si no aparece, usa 2.
   - Central (AC): anios en archivo central. Si no aparece, usa 10.

3. DISPOSICION FINAL (usa EXACTAMENTE una de estas):
   - "CT" = Conservacion Total
   - "E"  = Eliminacion
   - "S"  = Seleccion
   - "MT" = Medio Tecnico / Microfilmacion

4. COMPORTAMIENTO:
   - Extrae CADA fila de la tabla como un action separado.
   - Si una subserie existe, usala en subserieNombre; si no, dejala como cadena vacia "".
   - NO inventes datos. Si un campo no esta claro, usa un valor razonable basado en contexto.
   - Si el documento tiene multiples dependencias, extrae TODAS sus series y subseries.
   - El campo "codigo" debe ser el codigo de la SERIE o SUBSERIE (no de la dependencia).

FORMATO DE SALIDA - RESPONDE UNICAMENTE CON ESTE JSON (sin texto extra, sin markdown):
{
  "message": "Descripcion breve de lo encontrado.",
  "actions": [
    {
      "type": "CREATE",
      "entity": "trd_records",
      "payload": {
        "dependenciaNombre": "NOMBRE DE LA DEPENDENCIA EN MAYUSCULAS",
        "dependenciaCodigo": "100",
        "serieNombre": "NOMBRE DE LA SERIE",
        "subserieNombre": "NOMBRE DE LA SUBSERIE O CADENA VACIA",
        "codigo": "100.1",
        "retencionGestion": 2,
        "retencionCentral": 8,
        "disposicion": "CT",
        "procedimiento": "Descripcion del procedimiento archivistico."
      }
    }
  ]
}
"""

# Prompt compacto para extracción por secciones (menor overhead de tokens)
TRD_CHUNK_PROMPT = """Eres un archivista experto en TRD colombianas (Ley 594/2000). Extrae TODOS los registros TRD del siguiente fragmento.
Responde SOLO con JSON válido, sin texto adicional ni markdown:
{"actions":[{"type":"CREATE","entity":"trd_records","payload":{"dependenciaNombre":"","dependenciaCodigo":"","serieNombre":"","subserieNombre":"","codigo":"","retencionGestion":2,"retencionCentral":8,"disposicion":"CT","procedimiento":""}}]}
Reglas: disposicion solo "CT","E","S","MT" | retenciones en números enteros | subserieNombre="" si no aplica | si no hay registros TRD retorna {"actions":[]}

FRAGMENTO:
"""

# Marcadores de sección para detectar límites de dependencias en texto TRD
_TRD_SECTION_MARKERS = (
    "DEPENDENCIA", "SECCIÓN", "SECCION", "OFICINA", "DESPACHO",
    "DIVISIÓN", "DIVISION", "ÁREA", "AREA", "UNIDAD",
    "SUBGERENCIA", "GERENCIA", "DIRECCIÓN", "DIRECCION", "SUBDIRECCIÓN"
)





#  Helpers 



class ChatRequest(BaseModel):

    query: str

    entidadId: str | None = None

    history: list[dict] = []



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
        # 1. Resolver el email real del usuario desde DynamoDB
        # Cognito siempre usa el email como username; el identifier puede ser email o username de DynamoDB
        cognito_username = identifier  # fallback: intentar con el identifier directamente
        users_table = db.get_table("users")
        lookup_resp = users_table.scan(
            FilterExpression=Attr('email').eq(identifier) | Attr('username').eq(identifier)
        )
        lookup_items = lookup_resp.get('Items', [])
        if lookup_items:
            cognito_username = lookup_items[0].get('email', identifier).strip().lower()

        # 2. Autenticar en Cognito usando el email como username
        auth_result = await cognito.authenticate(cognito_username, req.password)
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
        
        # Reuse the DynamoDB lookup from step 1; fall back to verified_email if needed
        items = lookup_items
        if not items and verified_email:
            fb = users_table.scan(FilterExpression=Attr('email').eq(verified_email))
            items = fb.get('Items', [])

        user_profile = items[0] if items else None
        
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


class UserSignUp(BaseModel):
    nombre: str
    apellido: Optional[str] = None
    username: str
    email: str
    password: str
    phone: Optional[str] = None

@router.post("/auth/signup")
async def signup(req: UserSignUp):
    """Crea un nuevo usuario en Cognito y DynamoDB, luego retorna un token de sesión."""
    email = req.email.strip().lower()
    username = (req.username or "").strip() or email.split('@')[0]

    # 1. Verificar si el correo ya existe en DynamoDB
    all_users = await db.scan_table("users")
    if any(u.get("email", "").lower().strip() == email for u in all_users):
        raise HTTPException(status_code=409, detail="Ya existe una cuenta registrada con este correo. Por favor inicia sesión.")

    # 2. Crear en Cognito
    cognito_result = None
    try:
        cognito_result = await cognito.sign_up(
            username=email,
            password=req.password,
            email=email,
            name=req.nombre,
            family_name=req.apellido or "",
            phone=req.phone
        )
    except HTTPException as e:
        detail = str(e.detail)
        if "UsernameExistsException" in detail:
            raise HTTPException(status_code=409, detail="Ya existe una cuenta registrada con este correo. Por favor inicia sesión.")
        if "InvalidPasswordException" in detail or "PasswordPolicyViolationException" in detail:
            raise HTTPException(status_code=400, detail="La contraseña no cumple los requisitos: mínimo 8 caracteres, incluyendo mayúsculas, minúsculas, números y caracteres especiales.")
        raise HTTPException(status_code=400, detail=f"Error al crear la cuenta: {detail}")

    # 3. Crear perfil en DynamoDB
    # Use the Cognito UserSub as the user_id so that get_current_user (which decodes
    # the Cognito JWT sub claim) always finds the correct DynamoDB record.
    user_sub = (cognito_result.get("UserSub") if isinstance(cognito_result, dict) else None)
    user_id = user_sub or str(uuid.uuid4())
    item = {
        "PK": f"USER#{user_id}",
        "SK": "PROFILE",
        "id": user_id,
        "nombre": req.nombre,
        "apellido": req.apellido or "",
        "email": email,
        "username": username,
        "role": DEFAULT_ROLE,
        "perfil": DEFAULT_ROLE,
        "isActivated": True,
        "created_at": datetime.now().isoformat(),
        "iaDisponible": False
    }
    await db.put_item("users", item)

    # 4. Auto-login para obtener el token de sesión
    token = None
    try:
        auth_result = await cognito.authenticate(email, req.password)
        token = auth_result.get("IdToken")
    except Exception as auth_err:
        print(f"[SIGNUP] Auto-login fallido tras registro: {auth_err}")

    user_data = {
        "id": user_id,
        "nombre": req.nombre,
        "apellido": req.apellido or "",
        "email": email,
        "role": DEFAULT_ROLE,
        "entidadId": None,
        "entidadIds": [],
        "iaDisponible": False
    }
    return {"user": user_data, "token": token, "entities": []}


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
    logoKey: str | None = ""   # clave S3 para regenerar la URL cuando expire
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
    # Quota system
    quota_enabled: bool = False
    quota_type: str = "unlimited"          # "storage" | "dependencies" | "both" | "unlimited"
    storage_limit_bytes: int | None = None
    storage_used_bytes: int | None = 0
    dependency_limit: int | None = None    # overrides maxDependencias when set
    dependency_count: int | None = 0
    plan_name: str | None = "Free"

class PasswordResetRequest(BaseModel):
    email: str

class PerformResetRequest(BaseModel):
    email: str
    code: Optional[str] = None
    token: Optional[str] = None
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
    """Helper síncrono para registrar actividad en DynamoDB."""
    try:
        now = datetime.now().isoformat()
        log_id = str(uuid.uuid4())[:8]
        pk = f"ENTITY#{entidad_id}" if entidad_id else "GLOBAL"
        sk = f"LOG#{now}#{log_id}"
        table = db.get_table("activity_logs")
        table.put_item(Item={
            "PK": pk,
            "SK": sk,
            "id": log_id,
            "message": message,
            "user_name": user_name,
            "user_id": user_id,
            "entidad_id": entidad_id,
            "created_at": now,
        })
    except Exception as e:
        print(f" [LOG ERROR] {e}")

async def index_document_rag(doc_id: str | None, content: bytes, filename: str, entidad: str, file_url: str, file_size_bytes: int = 0):
    """
    Background Task: Extrae texto (Digital o Visual), realiza chunking y guarda en DynamoDB (entity-partitioned).
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

        rag_doc_id = doc_id or str(uuid.uuid4())
        entity_pk = f"ENTITY#{entidad}" if entidad and not entidad.startswith("ENTITY#") else (entidad or "GLOBAL")
        now_iso = datetime.now().isoformat()

        # Store each chunk as a separate DynamoDB item for granular retrieval
        for i, doc in enumerate(docs):
            await db.put_item("RagDocuments", {
                "PK": entity_pk,
                "SK": f"CHUNK#{rag_doc_id}#{i:04d}",
                "id": f"{rag_doc_id}#{i:04d}",
                "doc_id": rag_doc_id,
                "chunk_index": i,
                "content": doc.page_content,
                "metadata": {
                    "source": filename,
                    "chunk": i,
                    "entidad_id": entidad or "",
                    "file_url": file_url or "",
                    "type": "rag_chunk",
                    "created_at": now_iso,
                }
            })

        # Store metadata record (no full content — chunks hold the text)
        await db.put_item("RagDocuments", {
            "PK": entity_pk,
            "SK": f"UPLOAD#{rag_doc_id}",
            "id": rag_doc_id,
            "filename": filename,
            "file_size_bytes": file_size_bytes,
            "chunk_count": len(docs),
            "created_at": now_iso,
            "metadata": {
                "source": filename,
                "entidad_id": entidad or "",
                "file_url": file_url or "",
                "status": "success",
                "type": "rag_document",
                "chunk_count": len(docs),
                "file_size_bytes": file_size_bytes,
                "created_at": now_iso,
            }
        })
        print(f"RAG BACKGROUND: Indexado {filename} — {len(docs)} chunks en DynamoDB.")
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
    """Log-only progress tracker — pipeline is synchronous, no polling needed."""
    status = (extra or {}).get("status", "processing_ocr")
    print(f"[OCR] {filename}: {stage} ({progress}%) page {current_page}/{total_pages} [{status}]")


def _is_cancelled(doc_id: str) -> bool:
    """Cancellation not supported in synchronous mode."""
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


def _split_trd_text_into_chunks(text: str, max_chars: int = 14000) -> list:
    """
    Divide el texto de una TRD en secciones procesables.
    Intenta cortar en límites de dependencias; si no los detecta, corta por tamaño.
    """
    lines = text.splitlines()
    chunks, current, current_len = [], [], 0

    for line in lines:
        upper = line.strip().upper()
        is_section = (
            any(upper.startswith(m) for m in _TRD_SECTION_MARKERS)
            and len(line.strip()) < 120
        )
        if is_section and current_len > 3000:
            chunks.append("\n".join(current))
            current, current_len = [line], len(line)
        else:
            current.append(line)
            current_len += len(line)
            if current_len >= max_chars:
                chunks.append("\n".join(current))
                current, current_len = [], 0

    if current:
        chunks.append("\n".join(current))

    return [c for c in chunks if c.strip()]


def _parse_json_actions(raw: str) -> list:
    """Extrae la lista 'actions' de una respuesta LLM, manejando markdown y texto extra."""
    text = raw.strip()
    # Quitar cercas markdown
    if "```" in text:
        for part in text.split("```"):
            part = part.strip().lstrip("json").strip()
            if part.startswith("{"):
                text = part
                break
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end <= start:
        return []
    data = json.loads(text[start:end + 1])
    return data.get("actions", [])


async def _analyze_trd_ai_smart(full_text: str, images: list, llm_instance) -> tuple:
    """
    Extracción TRD multi-sección: divide el documento en fragmentos y los procesa
    de forma independiente, luego consolida y deduplica los resultados.
    Evita el límite de tokens de salida procesando sección por sección.
    """
    if not llm_instance:
        return [], "LLM no disponible — verifica OPENROUTER_API_KEY."

    chunks = _split_trd_text_into_chunks(full_text)
    if not chunks:
        return [], "No se encontró texto para analizar."

    print(f"[TRD-AI] Documento dividido en {len(chunks)} sección(es).")

    all_actions, errors = [], 0

    for i, chunk in enumerate(chunks):
        # Imágenes solo en el primer fragmento para contexto visual del encabezado
        chunk_images = images[:3] if i == 0 else []

        user_content = [{"type": "text", "text": TRD_CHUNK_PROMPT + chunk}]
        for b64 in chunk_images:
            user_content.append({"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64}"}})

        try:
            resp = await llm_instance.ainvoke([HumanMessage(content=user_content)])
            actions = _parse_json_actions(resp.content)
            all_actions.extend(actions)
            print(f"[TRD-AI] Sección {i+1}/{len(chunks)}: {len(actions)} registros extraídos.")
        except json.JSONDecodeError as e:
            print(f"[TRD-AI] Sección {i+1}: JSON inválido — {e}")
            errors += 1
        except Exception as e:
            err_str = str(e)
            print(f"[TRD-AI] Sección {i+1}: Error — {type(e).__name__}: {e}")
            # Si el modelo configurado no existe en OpenRouter, avisar claramente
            if "not a valid model ID" in err_str or "No endpoints found" in err_str:
                print(f"[TRD-AI] ⚠️  El modelo '{llm_instance.model_name}' no está disponible en OpenRouter. "
                      f"Actualiza OPENROUTER_MODEL en el .env con un ID válido (ej: openai/gpt-4o-mini).")
            errors += 1

    # Deduplicar por (dependenciaCodigo, codigo, subserieNombre)
    seen, unique = set(), []
    for action in all_actions:
        p = action.get("payload", {})
        key = (p.get("dependenciaCodigo", ""), p.get("codigo", ""), p.get("subserieNombre", ""))
        if key not in seen:
            seen.add(key)
            unique.append(action)

    msg = f"Extraídos {len(unique)} registros TRD en {len(chunks)} sección(es)."
    if errors:
        msg += f" ({errors} sección(es) con errores parciales)."
    if not unique:
        msg = "El análisis finalizó pero no se extrajeron registros. Verifica que el documento sea una TRD válida."

    return unique, msg

async def process_ocr_task(doc_id: str, content: bytes, filename: str, user_name: str = "Sistema", user_id: str = None, log_eid: str = None):
    """
    Proceso avanzado de OCR que detecta si el PDF es escaneado o tiene texto.
    Procesa página por página para permitir progreso en tiempo real y cancelación.
    Incluye fase de análisis TRD al finalizar la extracción.
    """
    print(f"--- Iniciando OCR Avanzado para: {filename} ---")
    
    file_url = None
    entidad_id = log_eid  # passed directly — no Supabase lookup needed
    file_size_bytes = len(content)

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

        # --- FASE 2: Análisis TRD con IA ---
        if pages_ok > 0:
            await _update_ocr_progress(
                doc_id, filename, stage="Analizando estructura TRD con IA...",
                progress=85, current_page=total_pages, total_pages=total_pages,
                pages_ok=pages_ok, pages_error=pages_error, error_pages=error_pages,
                extra={"status": "extraction_completed"}
            )

            print(f"[OCR-AI] Iniciando extracción TRD — {len(full_text)} chars, {len(images_base64)} imágenes — {filename}")
            try:
                parsed_actions, ai_message = await trd_import_agent.analyze(full_text, images_base64, filename)
            except Exception as agent_err:
                print(f"[OCR-AI] TRDImportAgent falló ({agent_err}), usando fallback Gemini")
                parsed_actions, ai_message = await _analyze_trd_ai_smart(full_text, images_base64, llm)
            print(f"[OCR-AI] Resultado final: {len(parsed_actions)} registros — {filename}")

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
            
            pk_val = f"ENTITY#{log_eid or entidad_id or 'GLOBAL'}"
            sk_val = f"IMPORT#{doc_id}"
            await db.update_item("RagDocuments", pk_val, sk_val, {
                "content": full_text,
                "metadata": final_meta
            })
            add_activity_log(
                f"OCR Finalizado - Pendiente de Verificación: {filename}",
                entidad_id=log_eid or entidad_id,
                user_name=user_name,
                user_id=user_id
            )
        else:
            raise Exception("No se pudo extraer texto de ninguna página.")

        print(f"--- OCR Finalizado para {filename} ---")

    except Exception as e:
        print(f"[OCR FATAL] {str(e)}")
        try:
            pk_val = f"ENTITY#{log_eid or entidad_id or 'GLOBAL'}"
            sk_val = f"IMPORT#{doc_id}"
            await db.update_item("RagDocuments", pk_val, sk_val, {
                "metadata": {
                    "status": "failed",
                    "ocr_stage": f"Error: {str(e)[:100]}",
                    "ocr_progress": 100,
                    "error_summary": str(e),
                    "entidad_id": log_eid or entidad_id,
                    "source": filename,
                }
            })
        except Exception as save_err:
            print(f"[OCR FATAL] No se pudo guardar error en DynamoDB: {save_err}")
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

def _normalize_entity_id(raw_id: str) -> str:
    """Strip the ENTITY# prefix so callers always get a plain UUID."""
    return raw_id.replace("ENTITY#", "", 1) if raw_id.startswith("ENTITY#") else raw_id

def _ensure_entity_id(item: dict) -> dict:
    """Guarantee the item has an `id` field that is a plain UUID (no ENTITY# prefix)."""
    if not item.get("id"):
        pk = item.get("PK", "")
        item["id"] = _normalize_entity_id(pk)
    else:
        item["id"] = _normalize_entity_id(str(item["id"]))
    return item

_S3_KEY_RE = re.compile(r"/((?:entities/[^/]+/)?logos/[^?#]+)")

async def _refresh_entity_logo(entity: dict) -> dict:
    """Devuelve la URL del logo a través del proxy del backend para evitar CORS de S3.

    Estrategia de resolución de la clave S3 (orden de prioridad):
    1. logoKey  — campo explícito guardado junto al logo
    2. logo_key — alias alternativo
    3. Parse de la logoUrl existente — para entidades antiguas sin logoKey
    """
    key = entity.get("logoKey") or entity.get("logo_key")

    # Fallback: extraer la clave del bucket desde una URL presignada de S3 existente
    if not key:
        existing_url = entity.get("logoUrl") or entity.get("logo_url") or ""
        if "amazonaws.com" in existing_url or (s3_client.bucket_name and s3_client.bucket_name in existing_url):
            m = _S3_KEY_RE.search(existing_url)
            if m:
                key = m.group(1)  # e.g. "logos/logo_1780592863.png"
                entity["logoKey"] = key  # normalizar para próximas lecturas

    if key:
        frontend_url = os.getenv("FRONTEND_URL", "").rstrip("/")
        if frontend_url:
            # Proxy URL — mismo origen que el frontend → sin problema de CORS
            entity["logoUrl"] = f"{frontend_url}/api/entities/logo-proxy?key={key}"
        else:
            # Fallback para desarrollo local: presigned URL (24 h)
            try:
                entity["logoUrl"] = await s3_client.get_download_url(key, expires_in=86400)
            except Exception as e:
                print(f" [logo-refresh] No se pudo refrescar URL para key={key}: {e}")
    return entity

@router.get("/entities")
async def get_entities(user: dict = Depends(get_current_user)):
    """Lista las entidades permitidas para el usuario actual."""
    try:
        if user.get("role") == SUPERADMIN_ROLE:
            items = await db.scan_table("entities")
            results = [_ensure_entity_id(i) for i in items]
            for item in results:
                await _refresh_entity_logo(item)
            return results

        # Para administradores multi-entidad, devolver todas sus entidades permitidas
        allowed_ids = user.get("allowed_entities", [])
        if not allowed_ids:
            main_id = user.get("entity_id")
            allowed_ids = [main_id] if main_id else []

        items = []
        for eid in allowed_ids:
            if not eid: continue
            clean_eid = _normalize_entity_id(str(eid))
            item = await db.get_item("entities", f"ENTITY#{clean_eid}", "METADATA")
            if item:
                ent = _ensure_entity_id(item)
                await _refresh_entity_logo(ent)
                items.append(ent)
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

        # Only PROFILE items
        profiles = [u for u in all_items if u.get("SK") == "PROFILE" or "email" in u]

        # Guarantee every item has an 'id' field that matches the PK suffix so the
        # frontend can use it as the update key without guessing at the PK format.
        for item in profiles:
            if not item.get("id"):
                pk_raw = str(item.get("PK", ""))
                item["id"] = pk_raw.replace("USER#", "") if pk_raw.startswith("USER#") else pk_raw

        if user.get("role") == SUPERADMIN_ROLE:
            if not entity_context or entity_context == "e0":
                return profiles
            return [u for u in profiles if u.get("entidadId") == entity_context or entity_context in (u.get("entidadIds") or [])]
        else:
            if not entity_context: return []
            return [u for u in profiles if u.get("entidadId") == entity_context or entity_context in (u.get("entidadIds") or [])]
    except Exception as e:
        print(f"Error listing users: {e}")
        return []

def _normalize_role(raw: str) -> str:
    """Canonical role string used by all permission checks."""
    r = (raw or "").lower().strip()
    if r == "superadmin":
        return "superadmin"
    if r in ("admin", "administrador", "administración", "administracion"):
        return "administrador"
    return "usuario"

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
        # Keep 'role' and 'perfil' in sync so every permission check finds the right value
        item["role"] = _normalize_role(item.get("perfil", ""))
        await db.put_item("users", item)
        return {"status": "ok", "id": user_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/users/{user_id}")
async def update_user_endpoint(user_id: str, req: UserUpdate, user: dict = Depends(get_current_user)):
    """Actualiza un usuario existente."""
    if user.get("role") != SUPERADMIN_ROLE and user.get("user_id") != user_id:
        target_user = await db.get_item("users", f"USER#{user_id}", "PROFILE")
        if not target_user or target_user.get("entidadId") != user.get("entity_id"):
            raise HTTPException(status_code=403, detail="No autorizado")

    try:
        sk = "PROFILE"

        # --- Resolve the actual DynamoDB primary key ---
        # The frontend passes `user.id` which should equal the PK suffix, but legacy
        # records (or records without an explicit `id` field) may have a different
        # format. We try the canonical key first; if nothing is found we scan by id/PK
        # to locate the real record and use its stored PK.
        pk = f"USER#{user_id}"
        existing = await db.get_item("users", pk, sk)
        if not existing:
            print(f" [UPDATE_USER] Direct key {pk} not found — scanning for id={user_id}")
            all_users = await db.scan_table("users")
            found = next(
                (u for u in all_users
                 if u.get("id") == user_id
                 or str(u.get("PK", "")).replace("USER#", "") == user_id),
                None
            )
            if found:
                pk = found.get("PK", pk)
                print(f" [UPDATE_USER] Resolved key via scan: {pk}")
            else:
                raise HTTPException(status_code=404, detail="Usuario no encontrado")

        # --- Build the update payload ---
        updates = {k: v for k, v in req.dict(exclude_unset=True).items()
                   if k != "id"}   # strip stray 'id' sent by the frontend
        if "perfil" in updates:
            updates["role"] = _normalize_role(updates["perfil"])

        await db.update_item("users", pk, sk, updates)

    except HTTPException:
        raise
    except Exception as e:
        print(f" [UPDATE_USER] Error al actualizar {user_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

    # --- Email notification (isolated so failures here never roll back the save) ---
    try:
        resend_api_key = os.getenv("RESEND_API_KEY")
        if resend_api_key:
            target_email = updates.get("email") or (existing or {}).get("email")
            if target_email:
                import resend
                resend.api_key = resend_api_key
                resend.Emails.send({
                    "from": "OSE IA <notificaciones@ose-ia.com>",
                    "to": target_email,
                    "subject": "Actualización de tu Perfil en OSE IA",
                    "html": (
                        '<div style="font-family:sans-serif;max-width:600px;margin:0 auto;'
                        'padding:20px;border:1px solid #e2e8f0;border-radius:12px;">'
                        "<h2 style=\"color:#00bfa5;\">¡Hola! 👋</h2>"
                        "<p>Un administrador actualizó tu perfil en <strong>OSE IA</strong>.</p>"
                        "<p>Si no reconoces esta actividad contacta al soporte de tu entidad.</p>"
                        "</div>"
                    )
                })
                print(f" [EMAIL] Notificación enviada a {target_email}")
    except Exception as email_err:
        print(f" [EMAIL] Fallo al enviar notificación (el cambio SÍ fue guardado): {email_err}")

    return {"status": "ok"}

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
    """Lista las invitaciones — usa GSI entity-status-index para no hacer full-scan."""
    try:
        if user.get("role") == SUPERADMIN_ROLE:
            items = await db.scan_table("invitations")
        else:
            entity_id = user.get("entity_id")
            user_id = user.get("user_id")
            if not entity_id:
                return []
            # Query GSI instead of full-scan — returns only this entity's invitations
            all_invites = await db.query_by_gsi(
                "invitations", "entity-status-index", "entity_id", entity_id
            )
            items = [i for i in all_invites if i.get("created_by") == user_id]
        return items
    except Exception as e:
        print(f"Error listing invitations: {e}")
        return []

@router.get("/invitations/my")
async def get_my_invitations(archived: bool = False, user: dict = Depends(get_current_user)):
    """Lista las invitaciones para el usuario actual — usa GSI email-created_at-index."""
    email = user.get("email")
    user_id = user.get("user_id")
    if not email: return []
    try:
        # Query GSI instead of full-scan — returns only invitations for this email
        all_invites = await db.query_by_gsi(
            "invitations", "email-created_at-index", "email", email
        )
        all_entities = await db.scan_table("entities")
        entity_map = {e.get("id"): (e.get("razonSocial") or e.get("nombre") or "Entidad OSE") for e in all_entities}

        my_invites = []
        for i in all_invites:
            is_recipient = (i.get("email", "").lower() == email.lower() or i.get("recipient_user_id") == user_id)
            is_archived_match = (i.get("archived", False) == archived)

            if is_recipient and is_archived_match:
                if not i.get("entity_name"):
                    i["entity_name"] = entity_map.get(i.get("entity_id"), "Entidad OSE")
                my_invites.append(i)

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
    """Lista las invitaciones enviadas — usa GSI entity-status-index para admins."""
    try:
        if user.get("role") == SUPERADMIN_ROLE:
            if entity_id and entity_id != "all":
                all_invites = await db.query_by_gsi(
                    "invitations", "entity-status-index", "entity_id", entity_id
                )
            else:
                all_invites = await db.scan_table("invitations")
        else:
            # Admins: query each of their allowed entities via GSI and merge
            allowed_ids = list(user.get("allowed_entities") or [])
            active = user.get("entity_id")
            if active and active not in allowed_ids:
                allowed_ids.insert(0, active)
            filter_ids = [entity_id] if (entity_id and entity_id != "all") else allowed_ids
            if not filter_ids:
                return []
            all_invites = []
            for eid in filter_ids:
                batch = await db.query_by_gsi(
                    "invitations", "entity-status-index", "entity_id", eid
                )
                all_invites.extend(batch)
            # Keep only invitations created by this user
            user_id = user.get("user_id")
            all_invites = [i for i in all_invites if i.get("created_by") == user_id]

        all_invites = [i for i in all_invites if i.get("archived", False) == archived]

        all_entities = await db.scan_table("entities")
        entity_map = {e.get("id"): (e.get("razonSocial") or e.get("nombre") or "Entidad OSE") for e in all_entities}
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

@router.get("/invitations/{invite_id}/public")
async def get_invitation_public_by_id(invite_id: str):
    """Verifica una invitación por ID para el landing page (sin autenticación)."""
    try:
        invite = await db.get_item("invitations", f"INVITE#{invite_id}", "METADATA")
        if not invite:
            raise HTTPException(status_code=404, detail="Invitación no encontrada")

        email = invite.get("email", "").lower().strip()
        all_users = await db.scan_table("users")
        user_exists = any(u.get("email", "").lower().strip() == email for u in all_users)

        entity_name = invite.get("entity_name")
        if not entity_name:
            entity = await db.get_item("entities", f"ENTITY#{invite.get('entity_id')}", "METADATA")
            entity_name = (entity.get("razonSocial") or entity.get("nombre") if entity else None) or "Entidad OSE"

        return {
            "id": invite.get("id"),
            "email": invite.get("email"),
            "entity_id": invite.get("entity_id"),
            "entity_name": entity_name,
            "role": invite.get("role", "usuario"),
            "status": invite.get("status"),
            "user_exists": user_exists
        }
    except HTTPException as e:
        raise e
    except Exception as e:
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

        # 2. SI FUE ACEPTADA: Añadir la entidad al usuario y aplicar rol e IA de la invitación
        if req.action == "accept":
            entity_id = invite.get("entity_id")
            user_pk = f"USER#{user.get('user_id')}"
            user_sk = "PROFILE"
            user_data = await db.get_item("users", user_pk, user_sk)

            # Fallback: find by email when the user_id from the token doesn't match
            # any DynamoDB record (can happen for accounts created before the Cognito
            # sub alignment fix).
            if not user_data:
                invite_email = invite.get("email", "").lower().strip()
                if invite_email:
                    all_users = await db.scan_table("users")
                    matched = [u for u in all_users if u.get("email", "").lower().strip() == invite_email]
                    if matched:
                        user_data = matched[0]
                        user_pk = user_data.get("PK", user_pk)

            # Last resort: create a minimal profile so the entity assignment doesn't
            # get silently dropped for users who authenticated via Cognito but whose
            # DynamoDB record was never created (e.g. external identity provider paths).
            if not user_data:
                print(f"[INVITE_ACCEPT] No DynamoDB profile for {user.get('user_id')} — creating one on-the-fly")
                user_data = {
                    "PK": user_pk,
                    "SK": user_sk,
                    "id": user.get("user_id"),
                    "email": user.get("email", ""),
                    "nombre": user.get("name", user.get("given_name", "")),
                    "apellido": user.get("family_name", ""),
                    "role": "usuario",
                    "perfil": "usuario",
                    "isActivated": True,
                    "iaDisponible": False,
                    "created_at": datetime.now().isoformat(),
                }
                await db.put_item("users", user_data)

            # Ensure entity is in the user's allowed list
            current_entities = list(user_data.get("entidadIds", []))
            if entity_id and entity_id not in current_entities:
                current_entities.append(entity_id)

            invited_role = invite.get("role", "usuario")
            ia_enabled = invite.get("ia_disponible", False)

            # Role priority: superadmin > administrador > usuario.
            # Apply invited role when it is equal or higher than current role;
            # never downgrade an already-elevated role.
            role_rank = {"usuario": 0, "administrador": 1, "admin": 1, "superadmin": 2}
            current_role = user_data.get("role", "usuario")
            if role_rank.get(invited_role, 0) >= role_rank.get(current_role, 0):
                final_role = "administrador" if invited_role in ("admin", "administrador") else "usuario"
            else:
                final_role = current_role

            # Set primary entidadId when the user doesn't have one yet
            primary_entity = user_data.get("entidadId") or entity_id

            await db.update_item("users", user_pk, user_sk, {
                "entidadIds": current_entities,
                "entidadId": primary_entity,
                "role": final_role,
                "perfil": final_role,
                "iaDisponible": user_data.get("iaDisponible", False) or ia_enabled
            })
            print(f"[INVITE_ACCEPT] User {user_pk} assigned to entity {entity_id} with role {final_role}")
                    
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

@router.get("/activation-info/{token}")
async def get_activation_info(token: str):
    """Obtiene los datos del usuario para la página de activación (DynamoDB)."""
    try:
        all_users = await db.scan_table("users")
        target_user = next((u for u in all_users if u.get("activationToken") == token), None)
        if not target_user:
            raise HTTPException(status_code=404, detail="El código de activación no es válido o ya ha sido utilizado.")
        return {
            "email": target_user.get("email", ""),
            "nombre": target_user.get("nombre", ""),
            "apellido": target_user.get("apellido", "")
        }
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/activate")
async def activate_user(req: UserActivate):
    """Activa un usuario: crea su cuenta en Cognito y la marca como activada en DynamoDB."""
    try:
        all_users = await db.scan_table("users")
        target_user = next((u for u in all_users if u.get("activationToken") == req.token), None)

        if not target_user:
            raise HTTPException(status_code=404, detail="Token de activación inválido o expirado.")

        email = target_user.get("email", "").strip().lower()
        nombre = target_user.get("nombre", "Usuario")
        apellido = target_user.get("apellido", "")

        if not email:
            raise HTTPException(status_code=400, detail="No se encontró un correo asociado a este token.")

        # Crear / confirmar usuario en Cognito con la contraseña elegida
        try:
            await cognito.admin_create_and_confirm(email, req.password, nombre, apellido)
        except HTTPException as ce:
            detail = str(ce.detail)
            if "InvalidPasswordException" in detail or "PasswordPolicyViolationException" in detail:
                raise HTTPException(status_code=400, detail="La contraseña no cumple los requisitos de seguridad de Cognito.")
            print(f"[ACTIVATE] Advertencia Cognito (no fatal): {detail}")

        # Marcar como activado en DynamoDB
        await db.update_item("users", target_user["PK"], "PROFILE", {
            "isActivated": True,
            "activationToken": None,
            "updated_at": datetime.now().isoformat()
        })

        return {"status": "ok", "message": "Cuenta activada exitosamente. Ya puedes iniciar sesión."}
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/entities")
async def create_entity(req: EntityCreate, user: dict = Depends(require_super_admin)):
    """Crea una nueva entidad en DynamoDB."""
    entity_id = str(uuid.uuid4())
    item = req.dict()

    all_entities = await db.scan_table("entities")
    if any(e.get("numeroDocumento") == item["numeroDocumento"] for e in all_entities):
        raise HTTPException(status_code=400, detail="Ya existe una entidad registrada con este número de documento.")

    item["PK"] = f"ENTITY#{entity_id}"
    item["SK"] = "METADATA"
    item["id"] = entity_id
    item["created_at"] = datetime.now().isoformat()
    try:
        await db.put_item("entities", item)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {"status": "ok", "id": entity_id}

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

class QuotaUpdate(BaseModel):
    quota_enabled: bool | None = None
    quota_type: str | None = None          # "storage" | "dependencies" | "both" | "unlimited"
    storage_limit_bytes: int | None = None
    dependency_limit: int | None = None
    plan_name: str | None = None

@router.get("/entities/{entity_id}/quota")
async def get_entity_quota_endpoint(entity_id: str, user: dict = Depends(get_current_user)):
    """Returns current quota usage and limits for an entity."""
    if user.get("role") != SUPERADMIN_ROLE:
        allowed = (user.get("allowed_entities") or []) + [user.get("entity_id")]
        if entity_id not in allowed:
            raise HTTPException(status_code=403, detail="No autorizado")
    return await get_quota_status(entity_id)

@router.put("/admin/entities/{entity_id}/quota")
async def set_entity_quota(entity_id: str, req: QuotaUpdate, user: dict = Depends(require_super_admin)):
    """Superadmin sets quota configuration for an entity."""
    updates = {k: v for k, v in req.dict().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No hay campos para actualizar")
    await db.update_item("entities", f"ENTITY#{entity_id}", "METADATA", updates)
    return await get_quota_status(entity_id)

@router.post("/admin/entities/{entity_id}/quota/recalculate")
async def recalculate_entity_quota(entity_id: str, user: dict = Depends(require_super_admin)):
    """Recount dependency_count and storage_used_bytes from live DynamoDB records.
    Use to repair counters that became inconsistent."""
    dep_count  = await recalculate_dependency_count(entity_id)
    stor_bytes = await recalculate_storage_used(entity_id)
    return {
        "status": "ok",
        "entity_id": entity_id,
        "dependency_count": dep_count,
        "storage_used_bytes": stor_bytes,
        "message": f"Recalculado: {dep_count} dependencias, {stor_bytes} bytes de almacenamiento.",
    }

@router.post("/entities/upload-logo")
async def upload_entity_logo(
    file: UploadFile = File(...),
    entity_id: str = Form(""),
    user: dict = Depends(get_current_user),
):
    """Sube un logo a S3 y devuelve URL presignada (24 h) + key para renovar.
    Si entity_id está presente, el logo se guarda en entities/{entity_id}/logos/.
    Si no (entidad nueva aún sin ID), se usa el prefijo plano logos/."""
    try:
        content = await file.read()
        ext = (file.filename or "logo.png").rsplit(".", 1)[-1].lower()
        clean_entity_id = entity_id.strip() if entity_id else ""
        if clean_entity_id:
            key = f"entities/{clean_entity_id}/logos/logo_{int(time.time())}.{ext}"
        else:
            key = f"logos/logo_{int(time.time())}.{ext}"
        await s3_client.upload_file(content, key, file.content_type or "image/png")
        # Devolver URL del proxy (sin CORS) en lugar de presigned URL directa a S3
        frontend_url = os.getenv("FRONTEND_URL", "").rstrip("/")
        if frontend_url:
            url = f"{frontend_url}/api/entities/logo-proxy?key={key}"
        else:
            url = await s3_client.get_download_url(key, expires_in=86400)
        return {"url": url, "key": key}
    except Exception as e:
        print(f" [upload-logo] Error S3: {e}")
        raise HTTPException(status_code=500, detail=str(e))


_LOGO_KEY_RE = re.compile(r"^(?:logos/|entities/[0-9a-f\-]{36}/logos/)[^/\s][^?#]*$")

@router.get("/entities/logo-proxy")
async def logo_proxy(key: str):
    """Sirve logos desde S3 a través del backend para evitar errores CORS en el browser.
    No requiere autenticación — los logos son activos visuales públicos de la entidad.
    Seguridad: solo permite claves bajo logos/ o entities/{uuid}/logos/."""
    if not key or not _LOGO_KEY_RE.match(key):
        raise HTTPException(status_code=400, detail="Clave de logo inválida")
    try:
        content, content_type = await s3_client.get_object_bytes(key)
        return Response(
            content=content,
            media_type=content_type or "image/png",
            headers={"Cache-Control": "public, max-age=86400"}
        )
    except Exception as e:
        print(f" [logo-proxy] No se encontró logo key={key}: {e}")
        raise HTTPException(status_code=404, detail="Logo no encontrado")


@router.post("/analyze-trd")
async def analyze_trd(
    request: Request,
    file: UploadFile = File(...),
    entidad_id: str = Form(""),   # multipart form field sent by the frontend
    user: dict = Depends(get_current_user),
):
    """Sube un documento TRD, procesa OCR + análisis IA sincrónicamente y retorna el resultado completo."""
    print(f" POST /analyze-trd - File: {file.filename}")

    content = await file.read()
    file_size_bytes = len(content)
    file_hash = hashlib.sha256(content).hexdigest()

    doc_id = str(uuid.uuid4())

    # Priority: Form field > x-entity-context header > JWT entity_id
    entity_from_header = request.headers.get("x-entity-context", "")
    entidad_actual = entidad_id or entity_from_header or user.get("entity_id") or "GLOBAL"

    # Block import if there is no valid entity
    if not entidad_actual or entidad_actual in ("GLOBAL", "null", "e0"):
        raise HTTPException(
            status_code=400,
            detail="No hay entidad activa seleccionada. Selecciona una entidad antes de importar una TRD."
        )

    # Validate the caller is allowed to import into this entity
    if user.get("role") != SUPERADMIN_ROLE:
        allowed_ents = user.get("allowed_entities") or []
        active_ent = user.get("entity_id")
        if entidad_actual not in ([active_ent] + list(allowed_ents)):
            raise HTTPException(
                status_code=403,
                detail="No tienes permiso para importar datos en esta entidad."
            )

    # Storage quota check — TRD files are processed in memory (not stored in S3),
    # but we still validate the file size to detect oversized uploads early.
    # The file does NOT count toward storage_used_bytes since nothing is written to S3.
    await check_storage_quota(entidad_actual, 0)  # only checks if entity is over limit already

    user_id = user.get("user_id")
    user_name = user.get("nombre", "Sistema")
    pk_val = f"ENTITY#{entidad_actual}"

    # Deduplication: reuse an active DynamoDB session for the same file+entity
    try:
        existing = await db.query_by_entity("RagDocuments", pk_val, sk_prefix="IMPORT#")
        for item in (existing or []):
            meta = item.get("metadata", {})
            if meta.get("file_hash") == file_hash and meta.get("status") in ("processing_ocr", "pending_verification"):
                # No reutilizar si está en pending_verification sin acciones: significa que
                # la extracción anterior falló y debe reprocesarse con el nuevo código.
                if meta.get("status") == "pending_verification" and not meta.get("actions"):
                    print(f" [INFO] Sesión previa vacía encontrada — forzando reprocesamiento: {item['id']}")
                    continue
                print(f" [INFO] Reusando sesión activa DynamoDB: {item['id']}")
                return {
                    "import_id": item["id"],
                    "status": meta.get("status"),
                    "filename": file.filename,
                    "file_size_bytes": file_size_bytes,
                    "actions": meta.get("actions", []),
                    "message": meta.get("message", ""),
                    "ocr_progress": meta.get("ocr_progress", 0),
                    "ocr_stage": meta.get("ocr_stage", ""),
                    "entidad_id": entidad_actual,
                }
    except Exception as dup_err:
        print(f" Error en chequeo de duplicados DynamoDB: {dup_err}")

    # Create initial record in DynamoDB
    await db.put_item("RagDocuments", {
        "PK": pk_val,
        "SK": f"IMPORT#{doc_id}",
        "id": doc_id,
        "filename": file.filename,
        "content": "",
        "created_at": datetime.now().isoformat(),
        "metadata": {
            "source": file.filename,
            "status": "processing_ocr",
            "type": "trd_import_session",
            "entidad_id": entidad_actual,
            "user_id": user_id,
            "file_size_bytes": file_size_bytes,
            "file_hash": file_hash,
            "created_at": datetime.now().isoformat(),
            "ocr_stage": "Iniciando procesamiento...",
            "ocr_progress": 0,
        }
    })

    # Run the full OCR + AI pipeline synchronously (Vercel kills background tasks)
    await process_ocr_task(doc_id, content, file.filename, user_name, user_id, entidad_actual)

    # Fetch the completed result from DynamoDB and return it directly
    try:
        result_item = await db.get_item("RagDocuments", pk_val, f"IMPORT#{doc_id}")
        if result_item:
            meta = result_item.get("metadata", {})
            return {
                "import_id": doc_id,
                "status": meta.get("status", "pending_verification"),
                "filename": file.filename,
                "file_size_bytes": file_size_bytes,
                "actions": meta.get("actions", []),
                "message": meta.get("message", ""),
                "ocr_progress": meta.get("ocr_progress", 100),
                "ocr_stage": meta.get("ocr_stage", "Listo para verificación"),
                "entidad_id": entidad_actual,
                "pages_ok": meta.get("ocr_pages_ok", 0),
                "total_pages": meta.get("ocr_total_pages", 0),
            }
    except Exception as e:
        print(f"[ANALYZE] Error obteniendo resultado final: {e}")

    return {"import_id": doc_id, "status": "pending_verification", "filename": file.filename,
            "file_size_bytes": file_size_bytes, "actions": [], "message": "", "entidad_id": entidad_actual}


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
    file_size_bytes = len(content)
    print(f" Tamaño recibido: {file_size_bytes / (1024*1024):.2f} MB")

    # Determine and validate entity BEFORE doing any S3 work
    user_role = user.get("role")
    user_entity = user.get("entity_id")
    allowed_entities = user.get("allowed_entities") or []

    if user_role == SUPERADMIN_ROLE:
        entidad_final = entidad_id or user_entity
    else:
        entidad_final = entidad_id or user_entity
        if entidad_final and entidad_final not in ([user_entity] + list(allowed_entities)):
            raise HTTPException(status_code=403, detail="No tienes permiso para subir documentos a esta entidad")
        if not entidad_final:
            raise HTTPException(status_code=400, detail="No hay entidad activa seleccionada")

    # Storage quota check — before any S3 upload
    await check_storage_quota(entidad_final, file_size_bytes)

    # 1. Guardar el archivo original en AWS S3 (entity-scoped path)
    file_url = None
    doc_id = str(uuid.uuid4())
    try:
        clean_filename = f"{int(time.time())}_{file.filename.replace(' ', '_')}"
        storage_path = f"entities/{entidad_final}/documents/{doc_id}/{clean_filename}"
        await s3_client.upload_file(content, storage_path, "application/pdf")
        file_url = await s3_client.get_download_url(storage_path)
        print(f"  PDF subido a S3: {storage_path}")
        # Increment storage counter synchronously so the next upload sees the correct usage
        await increment_storage_used(entidad_final, file_size_bytes)
    except Exception as e:
        print(f"  Error subiendo PDF a S3: {e}")

    # Pass file_size and doc_id to the background indexer so it can store them in DynamoDB
    background_tasks.add_task(
        index_document_rag, doc_id, content, file.filename, entidad_final, file_url, file_size_bytes
    )

    return {
        "message": f"PDF '{file.filename}' recibido. Se está indexando en segundo plano.",
        "status": "indexing",
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



    # Spanish stopwords for keyword scoring
    _STOPWORDS = {
        'de','la','el','en','y','a','que','es','se','los','las','un','una','con',
        'por','para','como','del','al','este','esta','su','sus','lo','mas','pero',
        'si','no','o','le','me','mi','te','tu','nos','fue','son','han','hay','ser',
        'estar','tiene','tienen','cada','todo','todos','cual','cuales','como','donde',
    }

    def _score(item: dict, q: str) -> float:
        content = (item.get("content") or "").lower()
        words = {w for w in re.sub(r'[^\w\s]', '', q.lower()).split() if w not in _STOPWORDS and len(w) > 2}
        if not words:
            return 1.0
        return sum(1 for w in words if w in content) / len(words)

    try:

        entidad_actual = user.get("entity_id") or "GLOBAL"

        # 1. Retrieve all RAG items for entity (CHUNK# from new docs, UPLOAD# legacy with content)
        all_items = await db.query_by_entity("RagDocuments", entidad_actual)

        if not all_items:
            all_items = await db.query_by_entity("RagDocuments", "GLOBAL")

        # Keep only actual document content items (not TRD imports or metadata-only records)
        content_items = [
            item for item in all_items
            if item.get("content") and len(item.get("content", "")) > 50
            and item.get("SK", "").startswith(("CHUNK#", "UPLOAD#"))
        ]

        # 2. Score by keyword relevance, take top 15
        scored = sorted(content_items, key=lambda x: _score(x, request.query), reverse=True)
        top_items = scored[:15] if scored else []

        # If all scores are zero (generic question), take first 10 by recency
        if not any(_score(i, request.query) > 0 for i in top_items):
            top_items = sorted(content_items, key=lambda x: x.get("metadata", {}).get("created_at", ""), reverse=True)[:10]

        # 3. Build context_docs for rag_query (cap each chunk at 1400 chars)
        context_docs = [
            {
                "content": item.get("content", "")[:1400],
                "source": (item.get("metadata") or {}).get("source") or item.get("filename") or "Documento",
                "chunk": item.get("chunk_index", (item.get("metadata") or {}).get("chunk", "")),
            }
            for item in top_items
        ]

        # 4. Query with history
        answer = await ai.rag_query(request.query, context_docs, entidad_actual, request.history)

        sources = list(dict.fromkeys(d["source"] for d in context_docs if d["source"]))

        return {
            "answer": answer,
            "sources": sources[:5],
        }

    except Exception as e:

        print(f" Error en Chat RAG: {e}")

        return {"answer": "Lo siento, hubo un error procesando tu consulta en el motor AWS.", "sources": []}



@router.get("/rag-documents")
async def get_rag_documents(entidad_id: str | None = None, type: str | None = None, user: dict = Depends(get_current_user)):
    """Lista los documentos de importación almacenados en DynamoDB."""
    try:
        allowed_entities = user.get("allowed_entities", [])
        if user.get("role") == "superadmin":
            entidad_final = entidad_id if entidad_id and entidad_id != "null" else user.get("entity_id")
        else:
            if entidad_id:
                entidad_final = entidad_id if entidad_id in allowed_entities else user.get("entity_id")
            else:
                entidad_final = user.get("entity_id")

        pk_val = f"ENTITY#{entidad_final}" if entidad_final else None
        if not pk_val:
            return []

        items = await db.query_by_entity("RagDocuments", pk_val, sk_prefix="IMPORT#")

        if type:
            items = [i for i in items if (i.get("metadata") or {}).get("type") == type]

        items.sort(key=lambda x: x.get("created_at", ""), reverse=True)

        # Statuses that must never be returned to the frontend
        HIDDEN_STATUSES = {"cancelled", "dismissed", "closed"}

        processed_data = []
        sources_handled = set()

        for item in items:
            meta = item.get("metadata") or {}
            # Skip permanently-dismissed sessions before anything else
            if meta.get("status") in HIDDEN_STATUSES:
                continue
            doc_type = meta.get("type")
            source = meta.get("source") or meta.get("filename")
            if doc_type in ("temp_trd_session", "trd_upload", "trd_import_session"):
                if source and source in sources_handled:
                    continue
                processed_data.append(item)
                if source:
                    sources_handled.add(source)

        for item in items:
            meta = item.get("metadata") or {}
            if meta.get("status") in HIDDEN_STATUSES:
                continue
            doc_type = meta.get("type")
            source = meta.get("source") or meta.get("filename")
            if doc_type not in ("temp_trd_session", "trd_upload", "trd_import_session"):
                if not source or source not in sources_handled:
                    processed_data.append(item)
                    if source:
                        sources_handled.add(source)

        return processed_data

    except Exception as e:
        print(f" Error listando documentos RAG: {str(e)}")
        return []



@router.put("/rag-documents/{doc_id}")
async def update_rag_document(doc_id: str, payload: dict, user: dict = Depends(get_current_user)):
    """Actualiza el estado o metadata de un documento de importación en DynamoDB."""
    try:
        table = db.get_table("RagDocuments")
        scan_resp = table.scan(FilterExpression=Attr("id").eq(doc_id))
        items_found = scan_resp.get("Items", [])
        if not items_found:
            raise HTTPException(404, "Documento no encontrado")

        item = items_found[0]
        pk = item["PK"]
        sk = item["SK"]
        meta = item.get("metadata") or {}
        entidad_id = meta.get("entidad_id")

        user_role = user.get("role", "user")
        user_entity = user.get("entity_id")
        if user_role != SUPERADMIN_ROLE:
            if entidad_id and str(entidad_id) != str(user_entity):
                raise HTTPException(403, "No tienes permiso para modificar documentos de otra entidad")

        new_status = payload.get("status")
        incoming_meta = payload.get("metadata") or {}
        final_meta = {**meta, **incoming_meta}

        if new_status:
            # cancelled/dismissed/closed → hard delete immediately so it never resurfaces
            if new_status in ("cancelled", "dismissed", "closed"):
                source = meta.get("source")
                effective_entity = entidad_id or meta.get("entidad_id")
                if source and effective_entity:
                    pk_all = f"ENTITY#{effective_entity}"
                    all_items = await db.query_by_entity("RagDocuments", pk_all, sk_prefix="IMPORT#")
                    related = [i for i in all_items if (i.get("metadata") or {}).get("source") == source]
                    tbl = db.get_table("RagDocuments")
                    for rel in related:
                        tbl.delete_item(Key={"PK": rel["PK"], "SK": rel["SK"]})
                else:
                    tbl = db.get_table("RagDocuments")
                    tbl.delete_item(Key={"PK": pk, "SK": sk})
                print(f"[PUT] Hard-deleted session {item['id']} on status={new_status}")
                return {"status": "success", "new_status": new_status, "deleted": True}

            final_meta["status"] = new_status
            if new_status == "success":
                final_meta["type"] = "trd_upload"
                final_meta["integrated_at"] = datetime.now().isoformat()
                final_meta["integrated_by"] = user.get("nombre", "Usuario")
            elif new_status == "pending_verification":
                final_meta["type"] = "trd_import_session"

        if entidad_id and not final_meta.get("entidad_id"):
            final_meta["entidad_id"] = entidad_id

        update_fields = {"metadata": final_meta}
        if "content" in payload:
            update_fields["content"] = payload["content"]

        await db.update_item("RagDocuments", pk, sk, update_fields)
        return {"status": "success", "new_status": final_meta.get("status")}

    except HTTPException:
        raise
    except Exception as e:
        print(f" Error actualizando documento RAG: {e}")
        raise HTTPException(500, str(e))
@router.delete("/rag-documents/{doc_id}")
async def delete_rag_document(
    doc_id: str,
    entidad_id: str | None = None,
    user: dict = Depends(get_current_user)
):
    """Elimina un documento de importación de DynamoDB.

    Intenta primero lookup directo por PK/SK (O(1)) usando entidad_id.
    Si no se provee entidad_id, hace scan de respaldo.
    """
    try:
        table = db.get_table("RagDocuments")
        user_role = user.get("role", "user")
        user_entity = user.get("entity_id")

        item = None

        # ── Intento 1: lookup directo con PK/SK — prueba IMPORT# luego UPLOAD# ──
        entity_hint = entidad_id or user_entity
        if entity_hint:
            pk_hint = f"ENTITY#{entity_hint}"
            for sk_prefix in (f"IMPORT#{doc_id}", f"UPLOAD#{doc_id}"):
                try:
                    item = await db.get_item("RagDocuments", pk_hint, sk_prefix)
                    if item:
                        break
                except Exception:
                    pass

        # ── Intento 2: scan completo como respaldo ────────────────────────────
        if not item:
            scan_resp = table.scan(FilterExpression=Attr("id").eq(doc_id))
            items_found = scan_resp.get("Items", [])
            if items_found:
                item = items_found[0]

        if not item:
            return {"status": "success", "message": "Documento ya eliminado o no encontrado."}

        meta = item.get("metadata") or {}
        item_entidad_id = meta.get("entidad_id") or (str(item.get("PK", "")).replace("ENTITY#", "") or None)
        source = meta.get("source")
        is_upload_record = str(item.get("SK", "")).startswith("UPLOAD#")

        if user_role != SUPERADMIN_ROLE:
            if item_entidad_id and str(item_entidad_id) != str(user_entity):
                raise HTTPException(403, "No tienes permiso para eliminar documentos de otra entidad")

        # ── Calcular bytes que se liberarán (solo para UPLOAD# records) ───────
        freed_bytes = 0
        if is_upload_record:
            size = item.get("file_size_bytes") or meta.get("file_size_bytes") or 0
            freed_bytes = int(size)

        # ── Eliminar el ítem y todos los relacionados por source ──────────────
        effective_entity = item_entidad_id or entity_hint
        sk_prefix_for_query = "UPLOAD#" if is_upload_record else "IMPORT#"
        if source and effective_entity:
            pk_val = f"ENTITY#{effective_entity}"
            all_items = await db.query_by_entity("RagDocuments", pk_val, sk_prefix=sk_prefix_for_query)
            related = [i for i in all_items if (i.get("metadata") or {}).get("source") == source]
            for rel in related:
                table.delete_item(Key={"PK": rel["PK"], "SK": rel["SK"]})
                if is_upload_record:
                    extra_size = rel.get("file_size_bytes") or (rel.get("metadata") or {}).get("file_size_bytes") or 0
                    if rel.get("id") != item.get("id"):  # don't double-count the primary item
                        freed_bytes += int(extra_size)
            print(f"[DELETE] Eliminados {len(related)} ítem(s) con source='{source}' en entidad {effective_entity}")
        else:
            table.delete_item(Key={"PK": item["PK"], "SK": item["SK"]})
            print(f"[DELETE] Eliminado ítem individual: {item.get('PK')}/{item.get('SK')}")

        # ── Decrementar contador de almacenamiento ────────────────────────────
        if freed_bytes > 0 and effective_entity:
            try:
                await increment_storage_used(effective_entity, -freed_bytes)
                print(f"[DELETE] Liberados {freed_bytes} bytes de almacenamiento para entidad {effective_entity}")
            except Exception as e:
                print(f"[DELETE] Error actualizando contador de almacenamiento: {e}")

        return {"status": "success", "message": f"Documento {source or doc_id} eliminado correctamente."}

    except HTTPException:
        raise
    except Exception as e:
        print(f" Error eliminando documento RAG: {e}")
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



    system_prompt = f"""Eres Orianna, la Arquitecta TRD de OSE IA. Eres una inteligencia artificial experta en gestion y automatizacion de Tablas de Retencion Documental (TRD) bajo los estandares del AGN (Archivo General de la Nacion) y la Ley 594 de 2000 de Colombia.

Tu personalidad: profesional, clara, directa y amable. Hablas en espanol formal colombiano. Nunca dices "no puedo" — siempre encuentras la manera de ayudar o pides exactamente lo que necesitas.

== CONOCIMIENTO DEL ENTORNO (contexto real de la entidad activa) ==
- Entidades vinculadas: {json.dumps(ents, ensure_ascii=False)}
- Dependencias existentes: {json.dumps(deps, ensure_ascii=False)}
- Series Documentales existentes: {json.dumps(series, ensure_ascii=False)}
- Subseries Documentales existentes: {json.dumps(subs, ensure_ascii=False)}
- Registros TRD (Valoracion): {json.dumps(trds, ensure_ascii=False)}

== CAMPOS POR ENTIDAD ==
Dependencia
  Obligatorios: nombre, codigo
  Auto-inferibles: sigla (iniciales del nombre), dependeDe (null si no es subdependencia)
  Opcionales complementarios: pais, departamento (si Colombia), ciudad, direccion, telefono

Serie
  Obligatorios: nombre, codigo, dependenciaId (busca el ID en las dependencias existentes por nombre)
  Opcionales: tipoDocumental (default "Simple")

Subserie
  Obligatorios: nombre, codigo, serieId, dependenciaId

Registro TRD
  Obligatorios: dependenciaId, serieId, retencionGestion (anos enteros), retencionCentral (anos enteros), disposicion ("CT"=Conservacion Total, "E"=Eliminacion, "MT"=Microfilmacion, "S"=Seleccion)
  Opcionales: subserieId, procedimiento

== MODO CONVERSACIONAL — RECOLECCION PROGRESIVA (MUY IMPORTANTE) ==
Regla principal: pregunta UN dato a la vez. Lee el historial para saber que ya tienes y que falta.

FASE 1 — Campos obligatorios: recolecta nombre y codigo (y dependenciaId para series).
- Cuando tengas todos los obligatorios → ejecuta el CREATE inmediatamente.
- Despues de crear, SIEMPRE ofrece completar los campos opcionales con: "¿Quieres que te ayude a completarla con informacion adicional como pais, ciudad y direccion?"

FASE 2 — Campos opcionales (si el usuario acepta):
- Pregunta: ¿Que pais tiene esta dependencia? (sugiere "Colombia" si es una entidad colombiana)
- Si dice Colombia: ¿En que departamento? (sugiere el mas probable segun el nombre de la entidad)
- ¿Y la ciudad?
- ¿Cual es la direccion?
- ¿Tiene telefono? (si no, omitelo)
- Cuando termines de recolectar, genera UPDATE con el ID real (busca la dependencia por nombre en el contexto — ya estara ahi porque el sistema refresca despues de cada CREATE).

FASE 3 — Continua guiando: despues de completar una dependencia, pregunta si quiere agregar series a ella.

COMO DETECTAR LA INTENCION:
"ayudame a crear", "quiero crear", "necesito una nueva", "crea una", "nueva dependencia" → DEPENDENCIA
"nueva serie", "crear serie", "agregar serie" → SERIE
"nueva subserie", "crear subserie" → SUBSERIE
"nueva valoracion", "nuevo TRD", "crear TRD" → TRD

EJEMPLOS DE FLUJO COMPLETO:
Turno 1 — Usuario: "Ayudame a crear una dependencia"
  Orianna: "Con gusto. ¿Cual es el nombre oficial de la dependencia?" [QUERY]

Turno 2 — Usuario: "Secretaria de Hacienda"
  Orianna: "Perfecto. ¿Cual es el codigo? Te sugiero 'SH' si no tienes uno definido." [QUERY]

Turno 3 — Usuario: "SH-01"
  Orianna: CREA la dependencia [CRUD], luego en el message dice: "¡Listo! Dependencia creada. ¿Quieres que te ayude a completarla con pais, ciudad y direccion?"

Turno 4 — Usuario: "Si, por favor"
  Orianna: "¿Que pais tiene esta dependencia?" [QUERY]

Turno 5 — Usuario: "Colombia"
  Orianna: "¿En que departamento? Por ejemplo, Cundinamarca, Antioquia, Valle del Cauca..." [QUERY]

Turno 6 — Usuario: "Cundinamarca"
  Orianna: "¿Y la ciudad?" [QUERY]

Turno 7 — Usuario: "Bogota"
  Orianna: "¿Cual es la direccion de la Secretaria de Hacienda?" [QUERY]

Turno 8 — Usuario: "Calle 12 No. 8-45"
  Orianna: "¿Tiene numero de telefono? (Si no, puedes omitirlo)" [QUERY]

Turno 9 — Usuario: "3001234567"
  Orianna: ACTUALIZA la dependencia con pais, departamento, ciudad, direccion, telefono [CRUD UPDATE]
  Luego propone: "¡Perfecto! Dependencia completada. ¿Quieres agregar series documentales a la Secretaria de Hacienda?"

== REGLAS DE ORO ==
1. INTEGRIDAD: Los nombres NUNCA se abrevian. Usa el nombre oficial completo.
2. JERARQUIA: Para estructuras complejas usa IDs temporales (t1, t2...) para enlazar.
3. SIGLAS: Si el usuario no da sigla, infierela de las iniciales del nombre.
4. CODIGOS: Si el usuario no da codigo, sugiere uno basado en siglas.
5. HISTORIAL: Lee el historial para no repetir preguntas. Nunca pidas algo que ya respondieron.
6. IDs REALES: Para UPDATE, busca el ID real en las "Dependencias existentes" del contexto. El sistema refresca automaticamente despues de cada CREATE.

== PAYLOADS EXACTOS ==
dependencias CREATE: {{"nombre":"...","sigla":"...","codigo":"...","dependeDe":null}}
dependencias UPDATE: {{"pais":"...","departamento":"...","ciudad":"...","direccion":"...","telefono":"..."}}
series:    {{"dependenciaId":"...","nombre":"...","codigo":"...","tipoDocumental":"Simple"}}
subseries: {{"dependenciaId":"...","serieId":"...","nombre":"...","codigo":"..."}}
trd_records: {{"dependenciaId":"...","serieId":"...","subserieId":null,"retencionGestion":2,"retencionCentral":5,"disposicion":"CT","procedimiento":""}}

== ESTRUCTURA DE RESPUESTA (SIEMPRE JSON PURO, SIN MARKDOWN) ==
Cuando preguntas o informas (sin ejecutar cambios):
{{"message":"...","intent":"QUERY","actions":[]}}

Cuando creas o modificas:
{{"message":"...","intent":"CRUD","actions":[{{"type":"CREATE","entity":"dependencias","id":"t1","payload":{{...}}}},...]}}

Para UPDATE usa type "UPDATE" con el ID real del registro:
{{"message":"...","intent":"CRUD","actions":[{{"type":"UPDATE","entity":"dependencias","id":"ID-REAL","payload":{{...}}}}]}}

REGLA CRITICA: "QUERY" + actions:[] para preguntas. "CRUD" solo con datos completos para ejecutar.
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
    """Genera un OTP de 6 dígitos, lo almacena en DynamoDB y lo envía vía Resend."""
    email = request.email.strip().lower()

    all_users = await db.scan_table("users")
    user_data = next((u for u in all_users if u.get("email", "").lower() == email), None)

    if user_data:
        code = str(random.randint(100000, 999999))
        expiry = (datetime.now() + timedelta(minutes=15)).isoformat()
        try:
            await db.update_item(
                "users", f"USER#{user_data['id']}", "PROFILE",
                {"resetCode": code, "resetCodeExpiry": expiry}
            )
        except Exception as e:
            print(f"[RESET] Error guardando código: {e}")

        nombre = user_data.get("nombre", "")
        html_content = get_reset_code_email_html(nombre, code)

        if RESEND_API_KEY:
            try:
                async with httpx.AsyncClient() as client:
                    resp = await client.post(
                        "https://api.resend.com/emails",
                        headers={"Authorization": f"Bearer {RESEND_API_KEY}", "Content-Type": "application/json"},
                        json={
                            "from": RESEND_FROM_EMAIL,
                            "to": email,
                            "subject": "Tu código de recuperación – OSE IA",
                            "html": html_content,
                        },
                    )
                    if resp.status_code >= 400:
                        print(f"[RESET] Resend error {resp.status_code}: {resp.text}")
                    else:
                        print(f"[RESET] Código enviado a {email} vía Resend.")
            except Exception as e:
                print(f"[RESET] Error enviando email: {e}")
        else:
            print(f"[RESET] RESEND_API_KEY no configurada. Código para {email}: {code}")

    # Siempre éxito por seguridad (no revelar si el email existe)
    return {"status": "ok", "message": "Si el correo está registrado, recibirás un código de verificación para restablecer tu contraseña."}


@router.post("/perform-reset")
async def perform_reset(request: PerformResetRequest):
    """Valida el OTP almacenado en DynamoDB y restablece la contraseña vía Cognito admin."""
    email = request.email.strip().lower()
    code = (request.code or request.token or "").strip()

    if not code:
        raise HTTPException(status_code=400, detail="Por favor ingresa el código de verificación recibido en tu correo.")

    all_users = await db.scan_table("users")
    user_data = next((u for u in all_users if u.get("email", "").lower() == email), None)

    if not user_data:
        raise HTTPException(status_code=400, detail="No se encontró ninguna cuenta con ese correo.")

    stored_code = user_data.get("resetCode", "")
    expiry_str = user_data.get("resetCodeExpiry", "")

    if not stored_code or stored_code != code:
        raise HTTPException(status_code=400, detail="El código de verificación no es válido. Revísalo e intenta de nuevo.")

    if expiry_str:
        try:
            if datetime.fromisoformat(expiry_str) < datetime.now():
                raise HTTPException(status_code=400, detail="El código ha expirado. Por favor solicita uno nuevo.")
        except ValueError:
            pass

    try:
        await cognito.admin_set_user_password(email, request.new_password)
    except HTTPException as e:
        detail = str(e.detail)
        if "InvalidPasswordException" in detail:
            raise HTTPException(status_code=400, detail="La contraseña no cumple los requisitos: mínimo 8 caracteres, incluyendo mayúsculas, minúsculas, números y caracteres especiales.")
        raise HTTPException(status_code=400, detail=f"Error al restablecer la contraseña: {detail}")

    # Invalidar el código usado
    try:
        await db.update_item(
            "users", f"USER#{user_data['id']}", "PROFILE",
            {"resetCode": "", "resetCodeExpiry": ""}
        )
    except Exception as e:
        print(f"[RESET] Error limpiando código: {e}")

    return {"status": "success", "message": "Tu contraseña ha sido actualizada correctamente."}

@router.get("/health-check")
async def health_check():
    return {"status": "ok", "message": "OSE Backend AWS Serverless ready"}

app.include_router(router)

@app.get("/")
async def root_main():
    return {"message": "OSE IA API Gateway is running"}

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


@router.get("/admin/entity-coverage-report")
async def entity_coverage_report(user: dict = Depends(require_super_admin)):
    """
    Scans all entity-specific DynamoDB tables and reports entity_id coverage.
    Use this before deciding on data migration. Superadmin only.
    """
    tables_to_check = [
        ("dependencias",  "DEP#"),
        ("series",        "SER#"),
        ("subseries",     "SUB#"),
        ("trd_records",   "TRD#"),
        ("funciones",     "FUN#"),
        ("entrevistas",   "INT#"),
        ("RagDocuments",  None),
        ("activity_logs", "LOG#"),
        ("invitations",   None),
    ]

    report = {}
    for logical_name, sk_prefix in tables_to_check:
        try:
            items = await db.scan_table(logical_name)
            valid, invalid, global_pk = [], [], []
            for item in items:
                pk = str(item.get("PK", ""))
                if pk.startswith("ENTITY#") and pk not in ("ENTITY#GLOBAL", "ENTITY#"):
                    valid.append(pk)
                elif pk == "ENTITY#GLOBAL" or pk == "GLOBAL":
                    global_pk.append(pk)
                else:
                    invalid.append({"PK": pk, "SK": item.get("SK", "")})
            report[logical_name] = {
                "total": len(items),
                "entity_scoped": len(valid),
                "global_fallback": len(global_pk),
                "missing_entity": len(invalid),
                "missing_details": invalid[:10],
            }
        except Exception as e:
            report[logical_name] = {"error": str(e)}

    total_records = sum(v.get("total", 0) for v in report.values() if isinstance(v, dict))
    total_missing = sum(v.get("missing_entity", 0) for v in report.values() if isinstance(v, dict))
    return {
        "summary": {
            "total_records_scanned": total_records,
            "records_missing_entity": total_missing,
            "migration_needed": total_missing > 0,
        },
        "tables": report,
    }
