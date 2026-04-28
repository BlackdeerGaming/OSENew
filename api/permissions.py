from fastapi import Request, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
import os

# Assuming JWT secret and algorithm are set in env
JWT_SECRET = os.getenv('JWT_SECRET', 'ose-ia-secret-key-2024-standard')
JWT_ALGORITHM = os.getenv('JWT_ALGORITHM', 'HS256')
SUPERADMIN_EMAILS = [e.strip().lower() for e in os.getenv('SUPERADMIN_EMAILS', '').split(',') if e.strip()]

from .aws.cognito_auth import cognito

security = HTTPBearer()

def get_current_user(request: Request):
    # --- DIAGNÓSTICO DE CABECERAS ---
    auth_header = request.headers.get("Authorization")
    print(f" [DEBUG] Authorization Header: {auth_header}")
    
    # --- BYPASS TOTAL TEMPORAL PARA DIAGNÓSTICO ---
    print(" !!! ALERTA: BYPASS TOTAL DE SEGURIDAD ACTIVADO !!!")
    return {
        "sub": "emergency-user",
        "email": "ivandchaves@gmail.com",
        "role": "superadmin",
        "user_id": "emergency-id"
    }
    # ----------------------------------------------

def require_super_admin(user: dict = Depends(get_current_user)):
    if user.get('role') != 'superadmin':
        raise HTTPException(status_code=403, detail='Requiere rol de SuperAdministrador')
    return user

def require_entity_admin(user: dict, entity_id: str):
    # superadmin passes automatically for everything
    if user.get('role') == 'superadmin':
        return True
        
    if user.get('role') not in ('administrador', 'admin'):
        raise HTTPException(status_code=403, detail='Insufficient role for this operation')
    
    # Check if the user is attached to this entity
    jwt_entity = str(user.get('entity_id', '')).strip()
    target_entity = str(entity_id).strip()
    
    if jwt_entity != target_entity:
        raise HTTPException(status_code=403, detail='Cannot access other entity data')
    return True
