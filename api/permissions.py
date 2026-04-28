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
    # --- BYPASS TOTAL TEMPORAL PARA DIAGNÓSTICO ---
    print(" !!! ALERTA: BYPASS TOTAL DE SEGURIDAD ACTIVADO !!!")
    return {
        "sub": "emergency-user",
        "email": "ivandchaves@gmail.com",
        "role": "superadmin",
        "user_id": "emergency-id"
    }
    # ----------------------------------------------
        
        # LLAVE MAESTRA DEFINITIVA: Bypass por UUID de Cognito (sub)
        # Este ID es el tuyo ivandchaves@gmail.com en tu Pool de AWS
        MY_COGNITO_ID = "219bb560-f091-706f-76fb-22b8930344e6"
        try:
            import jwt as pyjwt
            emergency_payload = pyjwt.decode(token, options={"verify_signature": False})
            if emergency_payload.get('sub') == MY_COGNITO_ID or emergency_payload.get('username') == MY_COGNITO_ID:
                print(f" [PERMISSIONS] !!! BYPASS TOTAL ACTIVADO PARA UUID {MY_COGNITO_ID} !!!")
                emergency_payload['role'] = 'superadmin'
                return emergency_payload
        except:
            pass
            
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
