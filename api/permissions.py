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
        raw_role = str(payload.get('role', 'usuario')).lower().strip()
        
        if raw_role in ('admin', 'administrador', 'administración'):
            payload['role'] = 'administrador'
        elif raw_role == 'superadmin':
            payload['role'] = 'superadmin'
        elif raw_role in ('user', 'usuario', 'consulta', 'cliente'):
            payload['role'] = 'usuario'
        else:
            payload['role'] = raw_role # Mantener otros roles específicos
            
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
    if str(user.get('entity_id')) != str(entity_id):
        # Even if the JWT says one entity, the user might have others in profile_entities.
        # However, for simplicity and security, we expect the frontend to be in the correct context
        # or we verify in the DB.
        raise HTTPException(status_code=403, detail='Cannot access other entity data')
    
    return True

def require_super_admin(user: dict):
    if user.get('role') != 'superadmin':
        raise HTTPException(status_code=403, detail='Super admin required')
