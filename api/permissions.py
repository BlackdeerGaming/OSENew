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

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    print(f" [AUTH] Recibido token: {token[:15]}...")
    try:
        # 1. Decodificar el token (IdToken o AccessToken)
        payload = cognito.verify_token(token)
        
        # 2. Intentar obtener el email del token
        verified_email = payload.get('email', '').lower().strip()
        user_id = payload.get('sub', payload.get('username'))
        
        # 3. Si no hay email (es un AccessToken), buscamos al usuario en DynamoDB
        user_record = None
        if not verified_email and user_id:
            # Buscamos en la tabla de usuarios usando el prefijo correcto
            user_record = await db.get_item("users", f"USER#{user_id}", "PROFILE")
            if user_record:
                verified_email = user_record.get('email', '').lower().strip()
        
        # 4. Determinar el Rol (Prioridad: DynamoDB > Whitelist > Token)
        current_whitelist = [e.strip().lower() for e in os.getenv('SUPERADMIN_EMAILS', '').split(',') if e.strip()]
        
        # LLAVE MAESTRA: ivandchaves@gmail.com o su UUID siempre son superadmin
        is_owner = (verified_email == "ivandchaves@gmail.com" or user_id == "219bb560-f091-706f-76fb-22b8930344e6")
        
        if is_owner or verified_email in current_whitelist:
            payload['role'] = 'superadmin'
        elif user_record:
            payload['role'] = user_record.get('role', 'usuario')
        else:
            # Fallback a claims del token
            payload['role'] = payload.get('custom:role', payload.get('role', 'usuario'))

        # Normalización final
        payload['user_id'] = user_id
        payload['email'] = verified_email
        payload['entity_id'] = user_record.get('entidadId') if user_record else payload.get('custom:entity_id')
            
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
