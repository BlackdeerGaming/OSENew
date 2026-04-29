from fastapi import Request, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt

# Assuming JWT secret and algorithm are set in env
import os
JWT_SECRET = os.getenv('JWT_SECRET', 'ose-ia-secret-key-2024-standard')
JWT_ALGORITHM = os.getenv('JWT_ALGORITHM', 'HS256')

security = HTTPBearer()

from .db import supabase_client

def get_current_user(request: Request, credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        
        # --- NORMALIZACIÓN DE ROLES CENTRALIZADA ---
        raw_role = str(payload.get('role', 'usuario')).lower().strip()
        
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
        elif role == 'administrador' and header_entity_id and supabase_client:
            # Validar si el admin tiene acceso a esa entidad en profile_entities
            check = supabase_client.table("profile_entities").select("role").eq("profile_id", user_id).eq("entity_id", header_entity_id).execute()
            if check.data:
                active_entity_id = header_entity_id
            # Si no tiene acceso, se queda con la del JWT
            
        payload['entity_id'] = active_entity_id
        return payload
    except jwt.PyJWTError as e:
        raise HTTPException(status_code=401, detail='Invalid authentication token')

def require_entity_admin(user: dict, entity_id: str):
    # superadmin passes automatically for everything
    if user.get('role') == 'superadmin':
        return True
        
    if user.get('role') not in ('administrador', 'admin'):
        raise HTTPException(status_code=403, detail='Insufficient role for this operation')
    
    # Check if the user is attached to this entity
    # Use robust comparison (strip and stringify)
    jwt_entity = str(user.get('entity_id', '')).strip()
    target_entity = str(entity_id).strip()
    
    if jwt_entity != target_entity:
        raise HTTPException(status_code=403, detail='Cannot access other entity data')
    
    return True

def require_super_admin(user: dict):
    if user.get('role') != 'superadmin':
        raise HTTPException(status_code=403, detail='Super admin required')
