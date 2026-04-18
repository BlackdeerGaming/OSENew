from fastapi import Request, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt

# Assuming JWT secret and algorithm are set in env
import os
JWT_SECRET = os.getenv('JWT_SECRET', 'ose-ia-secret-key-2024-standard')
JWT_ALGORITHM = os.getenv('JWT_ALGORITHM', 'HS256')

security = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        
        # --- NORMALIZACIÓN DE ROLES CENTRALIZADA ---
        raw_role = payload.get('role', 'usuario')
        if raw_role in ('admin', 'administrador', 'administración'):
            payload['role'] = 'administrador'
        elif raw_role in ('superadmin'):
            payload['role'] = 'superadmin'
        elif raw_role in ('user', 'usuario', 'Consulta', 'cliente'):
            payload['role'] = 'usuario'
        else:
            payload['role'] = raw_role # Por si hay otros roles
            
        return payload
    except jwt.PyJWTError as e:
        raise HTTPException(status_code=401, detail='Invalid authentication token')

def require_entity_admin(user: dict, entity_id: str):
    if user.get('role') not in ('administrador', 'admin', 'superadmin'):
        raise HTTPException(status_code=403, detail='Insufficient role')
    if user.get('role') in ('administrador', 'admin') and str(user.get('entity_id')) != str(entity_id):
        raise HTTPException(status_code=403, detail='Cannot access other entity data')
    # superadmin passes automatically

def require_super_admin(user: dict):
    if user.get('role') != 'superadmin':
        raise HTTPException(status_code=403, detail='Super admin required')
