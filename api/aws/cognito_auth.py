import boto3
import os
import re
import jwt
import requests
import hmac
import hashlib
import base64
from fastapi import HTTPException
from typing import Dict, Any, Optional

class CognitoManager:
    def __init__(self):
        self.region = os.getenv("AWS_REGION", "us-east-1")
        self.user_pool_id = os.getenv("COGNITO_USER_POOL_ID")
        self.client_id = os.getenv("COGNITO_CLIENT_ID")
        self.client_secret = os.getenv("COGNITO_CLIENT_SECRET")
        self.client = boto3.client("cognito-idp", region_name=self.region)
        self.jwks_url = f"https://cognito-idp.{self.region}.amazonaws.com/{self.user_pool_id}/.well-known/jwks.json"
        self._jwks = None

    def _get_secret_hash(self, username: str) -> str:
        if not self.client_secret:
            return None
        msg = username + self.client_id
        dig = hmac.new(
            str(self.client_secret).encode('utf-8'), 
            msg.encode('utf-8'), 
            digestmod=hashlib.sha256
        ).digest()
        return base64.b64encode(dig).decode()

    def get_jwks(self):
        if not self._jwks:
            self._jwks = requests.get(self.jwks_url).json()
        return self._jwks

    async def authenticate(self, username, password) -> Dict:
        try:
            auth_params = {
                "USERNAME": username,
                "PASSWORD": password
            }
            secret_hash = self._get_secret_hash(username)
            if secret_hash:
                auth_params["SECRET_HASH"] = secret_hash

            response = self.client.initiate_auth(
                ClientId=self.client_id,
                AuthFlow="USER_PASSWORD_AUTH",
                AuthParameters=auth_params
            )
            return response.get("AuthenticationResult")
        except self.client.exceptions.NotAuthorizedException:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    async def forgot_password(self, username: str):
        try:
            params = {
                "ClientId": self.client_id,
                "Username": username
            }
            secret_hash = self._get_secret_hash(username)
            if secret_hash:
                params["SecretHash"] = secret_hash
            return self.client.forgot_password(**params)
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))

    async def confirm_forgot_password(self, username: str, confirmation_code: str, new_password: str):
        try:
            params = {
                "ClientId": self.client_id,
                "Username": username,
                "ConfirmationCode": confirmation_code,
                "Password": new_password
            }
            secret_hash = self._get_secret_hash(username)
            if secret_hash:
                params["SecretHash"] = secret_hash
            return self.client.confirm_forgot_password(**params)
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))

    def verify_token(self, token: str) -> Dict:
        """Verifica un token de Cognito (IdToken o AccessToken) sin validar firma para desarrollo local"""
        try:
            # En desarrollo saltamos la validación de firma JWKS por simplicidad
            # pero nos aseguramos de que el token sea un JWT válido
            decoded = jwt.decode(token, options={"verify_signature": False})
            return decoded
        except Exception as e:
            print(f" [AUTH] Error decodificando token: {str(e)}")
            raise HTTPException(status_code=401, detail=f"Token invalido: {str(e)}")

    def _normalize_phone_e164(self, phone: str) -> Optional[str]:
        """Convert phone number to E.164 format required by Cognito.
        Assumes +57 (Colombia) when no country code is present."""
        if not phone or not phone.strip():
            return None
        stripped = phone.strip()
        has_plus = stripped.startswith('+')
        digits = re.sub(r'\D', '', stripped)
        if not digits:
            return None
        if has_plus:
            return f"+{digits}"
        # 12 digits starting with 57 → already has Colombian country code
        if len(digits) == 12 and digits.startswith('57'):
            return f"+{digits}"
        # 10-digit local Colombian number
        if len(digits) == 10:
            return f"+57{digits}"
        # Fallback: prepend Colombian code for any reasonably-sized number
        if len(digits) >= 7:
            return f"+57{digits}"
        return None

    async def sign_up(self, username, password, email, name, family_name=None, phone=None):
        try:
            full_name = f"{name} {family_name}" if family_name else name
            user_attributes = [
                {"Name": "email", "Value": email},
                {"Name": "given_name", "Value": name},
                {"Name": "name", "Value": full_name}
            ]
            if family_name:
                user_attributes.append({"Name": "family_name", "Value": family_name})
            if phone:
                normalized = self._normalize_phone_e164(phone)
                if normalized:
                    user_attributes.append({"Name": "phone_number", "Value": normalized})
            
            params = {
                "ClientId": self.client_id,
                "Username": username,
                "Password": password,
                "UserAttributes": user_attributes
            }
            secret_hash = self._get_secret_hash(username)
            if secret_hash:
                params["SecretHash"] = secret_hash
            
            response = self.client.sign_up(**params)
            
            # Auto-confirmar usuario para agilizar el flujo (opcional, requiere permisos admin)
            try:
                self.client.admin_confirm_sign_up(
                    UserPoolId=self.user_pool_id,
                    Username=username
                )
            except Exception as e:
                print(f"No se pudo auto-confirmar: {e}")
                
            return response
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))

    async def get_user_attributes(self, access_token: str) -> Dict:
        response = self.client.get_user(AccessToken=access_token)
        attrs = {attr["Name"]: attr["Value"] for attr in response["UserAttributes"]}
        return {
            "sub": response["Username"],
            "email": attrs.get("email"),
            "role": attrs.get("custom:role", "usuario"),
            "entity_id": attrs.get("custom:entity_id")
        }

    async def admin_delete_user(self, username: str):
        """Elimina un usuario del User Pool de Cognito."""
        try:
            self.client.admin_delete_user(
                UserPoolId=self.user_pool_id,
                Username=username
            )
        except self.client.exceptions.UserNotFoundException:
            print(f" [COGNITO] Usuario {username} no encontrado, saltando.")
        except Exception as e:
            print(f" [COGNITO] Error eliminando usuario {username}: {e}")
            raise e

    async def force_cleanup_user(self, username: str):
        """Intenta eliminar un usuario de Cognito sin lanzar error si no existe."""
        try:
            self.client.admin_delete_user(
                UserPoolId=self.user_pool_id,
                Username=username
            )
            print(f" [COGNITO] Limpieza exitosa para {username}")
            return True
        except self.client.exceptions.UserNotFoundException:
            return True
        except Exception as e:
            print(f" [COGNITO] Error en limpieza forzada para {username}: {e}")
            return False

    async def admin_set_user_password(self, username: str, password: str):
        """Admin establece una contraseña permanente para el usuario."""
        try:
            self.client.admin_set_user_password(
                UserPoolId=self.user_pool_id,
                Username=username,
                Password=password,
                Permanent=True
            )
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))

    async def admin_create_and_confirm(self, email: str, password: str, nombre: str, apellido: str = ""):
        """Crea y confirma un usuario en Cognito para el flujo de activación.
        Si ya existe, actualiza su contraseña."""
        try:
            await self.sign_up(email, password, email, nombre, apellido)
        except HTTPException as e:
            if "UsernameExistsException" in str(e.detail):
                await self.admin_set_user_password(email, password)
            else:
                raise e

cognito = CognitoManager()
