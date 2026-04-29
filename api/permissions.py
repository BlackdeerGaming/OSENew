from fastapi import Request, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
import os
from typing import Dict, Any, Optional

# Configuración básica
SUPERADMIN_EMAILS = [e.strip().lower() for e in os.getenv('SUPERADMIN_EMAILS', '').split(',') if e.strip()]

from .aws.cognito_auth import cognito
from .aws.dynamo_db import db

security = HTTPBearer()

async def get_current_user(request: Request, credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        # 1. Decodificar el token (IdToken o AccessToken)
        payload = cognito.verify_token(token)
        
        # 2. Intentar obtener el email del token
        verified_email = payload.get('email', '').lower().strip()
        user_id = payload.get('sub', payload.get('username'))
        
        # 3. SIEMPRE buscamos al usuario en DynamoDB
        user_record = None
        if user_id:
            user_record = await db.get_item("users", f"USER#{user_id}", "PROFILE")
            if user_record and not verified_email:
                verified_email = user_record.get('email', '').lower().strip()
        
        # 4. Determinar el Rol
        current_whitelist = [e.strip().lower() for e in os.getenv('SUPERADMIN_EMAILS', '').split(',') if e.strip()]
        is_owner = (verified_email == "ivandchaves@gmail.com" or user_id == "219bb560-f091-706f-76fb-22b8930344e6")
        
        role = 'usuario'
        if is_owner or verified_email in current_whitelist:
            role = 'superadmin'
        elif user_record:
            role = user_record.get('role', 'usuario')
        else:
            role = payload.get('custom:role', payload.get('role', 'usuario'))

        # Normalización final
        payload['user_id'] = user_id
        payload['email'] = verified_email
        payload['role'] = role
        payload['iaDisponible'] = user_record.get('iaDisponible', False) if user_record else False
        
        # --- LÓGICA DE CONTEXTO MULTI-ENTIDAD ---
        # 1. Obtener entidad desde el header (opcional)
        header_entity_id = request.headers.get("x-entity-context")
        # 2. Obtener lista de entidades permitidas para el usuario
        allowed_entities = user_record.get('entidadIds', []) if user_record else []
        # Asegurar que el entidadId principal esté incluido
        main_entity_id = user_record.get('entidadId') if user_record else payload.get('custom:entity_id')
        if main_entity_id and main_entity_id not in allowed_entities:
            allowed_entities.append(main_entity_id)

        active_entity_id = main_entity_id
        
        if role == 'superadmin':
            # El superadmin puede usar cualquier entidad que pase por el header
            if header_entity_id:
                active_entity_id = header_entity_id
        else:
            # El admin/usuario solo puede usar entidades a las que está asignado
            if header_entity_id and header_entity_id in allowed_entities:
                active_entity_id = header_entity_id
            # Si no hay header o no tiene permiso, usa su entidad principal
            elif not active_entity_id and allowed_entities:
                active_entity_id = allowed_entities[0]

        payload['entity_id'] = active_entity_id
        payload['allowed_entities'] = allowed_entities
        payload['role'] = role
        payload['user_id'] = user_id
        payload['email'] = verified_email
            
        return payload
        
    except Exception as e:
        print(f" [PERMISSIONS] Error de autenticación: {str(e)}")
        raise HTTPException(status_code=401, detail=f"No autorizado: {str(e)}")

def require_super_admin(user: dict = Depends(get_current_user)):
    if user.get('role') != 'superadmin':
        raise HTTPException(status_code=403, detail='Requiere rol de SuperAdministrador')
    return user

def require_entity_admin(user: dict, entity_id: str):
    if user.get('role') == 'superadmin':
        return True
    if user.get('role') not in ('administrador', 'admin'):
        raise HTTPException(status_code=403, detail='Insufficient role for this operation')
    
    jwt_entity = str(user.get('entity_id', '')).strip()
    target_entity = str(entity_id).strip()
    
    if jwt_entity != target_entity:
        raise HTTPException(status_code=403, detail='Cannot access other entity data')
    return True
