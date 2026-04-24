import boto3
import os
from typing import Optional
from botocore.exceptions import ClientError

class S3Manager:
    def __init__(self):
        self.region = os.getenv("AWS_REGION", "us-east-1")
        self.bucket_name = os.getenv("S3_BUCKET_NAME")
        self.s3 = boto3.client("s3", region_name=self.region)

    async def upload_file(self, file_content: bytes, path: str, content_type: str = "application/octet-stream"):
        try:
            self.s3.put_object(
                Bucket=self.bucket_name,
                Key=path,
                Body=file_content,
                ContentType=content_type
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

    async def delete_file(self, path: str):
        try:
            self.s3.delete_object(Bucket=self.bucket_name, Key=path)
        except ClientError as e:
            print(f"Error deleting from S3: {e}")
            raise e

s3_client = S3Manager()
