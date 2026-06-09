import boto3
import os
from typing import Optional
from botocore.exceptions import ClientError
from botocore.config import Config

class S3Manager:
    def __init__(self):
        self.region = os.getenv("AWS_REGION", "us-east-1")
        self.bucket_name = os.getenv("S3_BUCKET_NAME")
        self.s3 = boto3.client(
            "s3",
            region_name=self.region,
            aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
            aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
            endpoint_url=f"https://s3.{self.region}.amazonaws.com",
            config=Config(signature_version="s3v4"),
        )
        self._apply_cors_policy()

    def _apply_cors_policy(self):
        """Configura CORS en el bucket S3 para que el browser pueda cargar logos
        directamente desde URLs presignadas sin errores de CORS.
        Falla silenciosamente si el IAM no tiene permiso s3:PutBucketCors."""
        if not self.bucket_name:
            return
        origins = list(filter(None, [
            os.getenv("FRONTEND_URL", ""),
            "http://localhost:5173",
            "http://localhost:5174",
            "http://127.0.0.1:5173",
        ]))
        if not origins:
            return
        try:
            self.s3.put_bucket_cors(
                Bucket=self.bucket_name,
                CORSConfiguration={
                    "CORSRules": [{
                        "AllowedHeaders": ["*"],
                        "AllowedMethods": ["GET", "HEAD"],
                        "AllowedOrigins": origins,
                        "MaxAgeSeconds": 3600,
                    }]
                }
            )
            print(f"[S3 CORS] Política aplicada para orígenes: {origins}")
        except Exception as e:
            print(f"[S3 CORS] No se pudo configurar (sin permiso s3:PutBucketCors): {e}")

    async def upload_file(self, file_content: bytes, path: str, content_type: str = "application/octet-stream"):
        try:
            self.s3.put_object(
                Bucket=self.bucket_name,
                Key=path,
                Body=file_content,
                ContentType=content_type or "application/octet-stream",
            )
            return path
        except ClientError as e:
            print(f"Error uploading to S3: {e}")
            raise e

    async def get_download_url(self, path: str, expires_in: int = 3600) -> str:
        try:
            url = self.s3.generate_presigned_url(
                "get_object",
                Params={"Bucket": self.bucket_name, "Key": path},
                ExpiresIn=expires_in
            )
            return url
        except ClientError as e:
            print(f"Error generating pre-signed URL: {e}")
            raise e

    async def get_object_bytes(self, path: str) -> tuple:
        """Descarga un objeto de S3 y devuelve (bytes, content_type)."""
        try:
            response = self.s3.get_object(Bucket=self.bucket_name, Key=path)
            content = response["Body"].read()
            content_type = response.get("ContentType", "application/octet-stream")
            return content, content_type
        except ClientError as e:
            print(f"Error downloading from S3: {e}")
            raise e

    async def delete_file(self, path: str):
        try:
            self.s3.delete_object(Bucket=self.bucket_name, Key=path)
        except ClientError as e:
            print(f"Error deleting from S3: {e}")
            raise e

s3_client = S3Manager()
