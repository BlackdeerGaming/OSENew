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

from .db import supabase_client

def get_current_user(request: Request, credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        # 1. Decodificar el token (IdToken o AccessToken)
        payload = cognito.verify_token(token)
        
        # 2. Intentar obtener el email del token
        verified_email = payload.get('email', '').lower().strip()
        user_id = payload.get('sub', payload.get('username'))
        
        if raw_role in ('admin', 'administrador', 'administración', 'administracion'):
            payload['role'] = 'administrador'
        elif raw_role == 'superadmin':
            payload['role'] = 'superadmin'
        else:
            payload['role'] = 'usuario'

        # --- LÓGICA DE CONTEXTO MULTI-ENTIDAD ---
        header_entity_id = request.headers.get("x-entity-context")
        role = payload['role']
        user_id = payload.get('user_id')
        
        active_entity_id = payload.get('entity_id') # Fallback
        
        if role == 'superadmin':
            if header_entity_id:
                active_entity_id = header_entity_id
            payload['allowed_entities'] = [] # Superadmin ve todo via query global
        elif supabase_client:
            # Obtener todas las entidades permitidas y roles para este usuario
            # Agregamos reintento por error de socket en Windows (httpx.ReadError / WinError 10035)
            all_perms = None
            max_retries = 3
            for attempt in range(max_retries):
                try:
                    all_perms = supabase_client.table("profile_entities").select("entity_id", "role").eq("profile_id", user_id).execute()
                    break
                except Exception as e:
                    if "10035" in str(e) or "ReadError" in str(type(e)):
                        if attempt < max_retries - 1:
                            import time
                            time.sleep(0.1 * (attempt + 1))
                            continue
                    raise e

            allowed_entities = [p['entity_id'] for p in (all_perms.data or [])]
            entity_roles = {p['entity_id']: p['role'] for p in (all_perms.data or [])}
            
            # Asegurar que la entidad del JWT esté incluida
            jwt_entity = payload.get('entity_id')
            if jwt_entity and jwt_entity not in allowed_entities:
                allowed_entities.append(jwt_entity)
            
            payload['allowed_entities'] = allowed_entities
            
            # Validar si el usuario quiere cambiar de contexto
            if header_entity_id and header_entity_id in allowed_entities:
                active_entity_id = header_entity_id
            else:
                active_entity_id = jwt_entity
                
            # Reevaluar dinamicamente el rol segun la entidad activa
            if active_entity_id in entity_roles:
                context_role = str(entity_roles[active_entity_id]).lower()
                if context_role in ('admin', 'administrador', 'administración', 'administracion'):
                    payload['role'] = 'administrador'
                else:
                    if payload['role'] != 'administrador':
                        payload['role'] = 'usuario'

        payload['entity_id'] = active_entity_id
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
