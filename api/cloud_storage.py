import json
from typing import Any, Dict
from .aws.s3_storage import s3_client

async def upload_record(entity_id: str, module: str, record_id: str, data: Dict[str, Any]) -> str:
    """Upload a JSON representation of a TRD record to AWS S3.
    """
    path = f"{entity_id}/{module}/{record_id}.json"
    content = json.dumps(data, ensure_ascii=False, indent=2)
    await s3_client.upload_file(content.encode('utf-8'), path, content_type="application/json")
    return path

async def get_view_url(path: str) -> str:
    """Get a pre-signed URL for viewing a file."""
    return await s3_client.get_download_url(path)

async def delete_record(entity_id: str, module: str, record_id: str) -> None:
    """Delete a stored JSON file from AWS S3."""
    path = f"{entity_id}/{module}/{record_id}.json"
    await s3_client.delete_file(path)
