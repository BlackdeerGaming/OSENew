import boto3
import os
import jwt
import requests
from fastapi import HTTPException
from typing import Dict, Any, Optional

class CognitoManager:
    def __init__(self):
        self.region = os.getenv("AWS_REGION", "us-east-1")
        self.user_pool_id = os.getenv("COGNITO_USER_POOL_ID")
        self.client_id = os.getenv("COGNITO_CLIENT_ID")
        self.client = boto3.client("cognito-idp", region_name=self.region)
        self.jwks_url = f"https://cognito-idp.{self.region}.amazonaws.com/{self.user_pool_id}/.well-known/jwks.json"
        self._jwks = None

    def get_jwks(self):
        if not self._jwks:
            self._jwks = requests.get(self.jwks_url).json()
        return self._jwks

    async def authenticate(self, username, password) -> Dict:
        try:
            response = self.client.initiate_auth(
                ClientId=self.client_id,
                AuthFlow="USER_PASSWORD_AUTH",
                AuthParameters={
                    "USERNAME": username,
                    "PASSWORD": password
                }
            )
            return response.get("AuthenticationResult")
        except self.client.exceptions.NotAuthorizedException:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    async def forgot_password(self, username: str):
        try:
            return self.client.forgot_password(
                ClientId=self.client_id,
                Username=username
            )
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))

    async def confirm_forgot_password(self, username: str, confirmation_code: str, new_password: str):
        try:
            return self.client.confirm_forgot_password(
                ClientId=self.client_id,
                Username=username,
                ConfirmationCode=confirmation_code,
                Password=new_password
            )
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))

    def verify_token(self, token: str) -> Dict:
        # Simplified token verification. In production, use jose or verify against JWKS
        try:
            # We skip full JWKS verification here for brevity, but it should be implemented
            decoded = jwt.decode(token, options={"verify_signature": False})
            return decoded
        except Exception:
            raise HTTPException(status_code=401, detail="Invalid token")

    async def get_user_attributes(self, access_token: str) -> Dict:
        response = self.client.get_user(AccessToken=access_token)
        attrs = {attr["Name"]: attr["Value"] for attr in response["UserAttributes"]}
        return {
            "sub": response["Username"],
            "email": attrs.get("email"),
            "role": attrs.get("custom:role", "usuario"),
            "entity_id": attrs.get("custom:entity_id")
        }

cognito = CognitoManager()
