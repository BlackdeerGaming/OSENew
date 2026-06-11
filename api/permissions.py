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
        
        # 2. Intentar obtener el email y el id de usuario del token
        verified_email = payload.get('email', '').lower().strip()
        user_id = payload.get('sub', payload.get('username'))
        
        # 3. Obtener rol por defecto del payload
        raw_role = str(payload.get('role', payload.get('custom:role', payload.get('custom:perfil', 'usuario')))).lower().strip()
        allowed_entities = payload.get('allowed_entities', [])
        default_entity = payload.get('entity_id', payload.get('custom:entity_id'))

        # 4. Consultar DynamoDB para obtener el perfil real (si está disponible)
        user_data = None
        if db and user_id:
            try:
                user_pk = f"USER#{user_id}"
                user_data = await db.get_item("users", user_pk, "PROFILE")
            except Exception as db_err:
                print(f" [PERMISSIONS] Error consultando DynamoDB para {user_id}: {db_err}")

        # Fallback: search by email for users created before Cognito sub alignment.
        # This ensures existing users with a mismatched UUID still authenticate correctly.
        if not user_data and verified_email:
            try:
                all_users = await db.scan_table("users")
                matched = [u for u in all_users if u.get("email", "").lower().strip() == verified_email]
                if matched:
                    user_data = matched[0]
                    actual_id = user_data.get("id") or str(user_data.get("PK", "")).replace("USER#", "")
                    if actual_id:
                        user_id = actual_id
            except Exception as fb_err:
                print(f" [PERMISSIONS] Email fallback error: {fb_err}")

        if user_data:
            raw_role = str(user_data.get("role", user_data.get("perfil", raw_role))).lower().strip()
            allowed_entities = user_data.get("entidadIds", allowed_entities)
            default_entity = user_data.get("entidadId", default_entity)

        # 5. Normalizar rol
        if verified_email in SUPERADMIN_EMAILS or raw_role == 'superadmin':
            payload['role'] = 'superadmin'
        elif raw_role in ('admin', 'administrador', 'administración', 'administracion'):
            payload['role'] = 'administrador'
        else:
            payload['role'] = 'usuario'

        # --- LÓGICA DE CONTEXTO MULTI-ENTIDAD ---
        header_entity_id = request.headers.get("x-entity-context")
        role = payload['role']
        
        if role == 'superadmin':
            active_entity_id = header_entity_id if header_entity_id else default_entity
            payload['allowed_entities'] = [] # Superadmin ve todo
        else:
            # Asegurar que allowed_entities sea una lista limpia
            if not isinstance(allowed_entities, list):
                allowed_entities = [allowed_entities] if allowed_entities else []
            
            # Asegurar que la entidad por defecto esté incluida
            if default_entity and default_entity not in allowed_entities:
                allowed_entities.append(default_entity)
            
            payload['allowed_entities'] = allowed_entities
            
            # Validar cambio de contexto
            if header_entity_id and header_entity_id in allowed_entities:
                active_entity_id = header_entity_id
            else:
                active_entity_id = default_entity if default_entity else (allowed_entities[0] if allowed_entities else None)

        payload['user_id'] = user_id
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
    """Validates that the authenticated user can administer the given entity.

    Accepts the user if:
    - they are superadmin (global access), OR
    - they have admin/administrador role AND the entity is their active entity
      OR is in their allowed_entities list (multi-entity admins).
    """
    if user.get('role') == 'superadmin':
        return True
    if user.get('role') not in ('administrador', 'admin'):
        raise HTTPException(status_code=403, detail='Insufficient role for this operation')

    target = str(entity_id).strip()
    active = str(user.get('entity_id', '')).strip()
    allowed = [str(e).strip() for e in (user.get('allowed_entities') or []) if e]

    if target == active or target in allowed:
        return True
    raise HTTPException(status_code=403, detail='Cannot access other entity data')

