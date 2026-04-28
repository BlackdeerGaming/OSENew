from fastapi import Request, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt

# Assuming JWT secret and algorithm are set in env
import os
JWT_SECRET = os.getenv('JWT_SECRET', 'ose-ia-secret-key-2024-standard')
JWT_ALGORITHM = os.getenv('JWT_ALGORITHM', 'HS256')
SUPERADMIN_EMAILS = [e.strip().lower() for e in os.getenv('SUPERADMIN_EMAILS', '').split(',') if e.strip()]

from .aws.cognito_auth import cognito

security = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        # Verify using Cognito logic
        payload = cognito.verify_token(token)
        
        # Cognito attributes mapping (normalización)
        raw_role = str(payload.get('custom:role', payload.get('role', 'usuario'))).lower().strip()
        # Recargar whitelist del entorno
        current_whitelist = [e.strip().lower() for e in os.getenv('SUPERADMIN_EMAILS', '').split(',') if e.strip()]
        
        if raw_role in ('admin', 'administrador', 'administración', 'administracion'):
            payload['role'] = 'administrador'
        elif raw_role == 'superadmin' or payload.get('email', '').lower().strip() in current_whitelist:
            payload['role'] = 'superadmin'
        elif raw_role in ('user', 'usuario', 'consulta', 'cliente'):
            payload['role'] = 'usuario'
        else:
            payload['role'] = raw_role
            
        # Ensure sub and entity_id are present as per existing logic
        payload['user_id'] = payload.get('sub')
        payload['entity_id'] = payload.get('custom:entity_id', payload.get('entity_id'))
            
        return payload
    except Exception as e:
        raise HTTPException(status_code=401, detail=f'Invalid authentication token: {str(e)}')

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

def require_super_admin(user: dict = Depends(get_current_user)):
    if user.get('role') != 'superadmin':
        raise HTTPException(status_code=403, detail='Super admin required')
    return user
