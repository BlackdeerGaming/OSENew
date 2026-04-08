import json
from typing import Any, Dict

from supabase import Client

# Assuming supabase_client is initialized in main.py and imported here

def get_storage_client(supabase_client: Client):
    """Return the Supabase storage bucket client for TRD data."""
    return supabase_client.storage.from_('trd-data')

def upload_record(supabase_client: Client, entity_id: str, module: str, record_id: str, data: Dict[str, Any]) -> str:
    """Upload a JSON representation of a TRD record to Supabase storage.

    Args:
        supabase_client: Initialized Supabase client.
        entity_id: ID of the entity the record belongs to.
        module: One of 'dependencias', 'series', 'subseries', 'trd_records'.
        record_id: Primary key of the record.
        data: Dictionary to be stored.
    Returns:
        The storage path (key) where the file was stored.
    """
    storage = get_storage_client(supabase_client)
    path = f"entity_{entity_id}/{module}/{record_id}.json"
    content = json.dumps(data, ensure_ascii=False, indent=2)
    # Supabase storage expects bytes
    result = storage.upload(path, content.encode('utf-8'))
    if result.get('error'):
        raise Exception(f"Supabase storage upload error: {result['error']}")
    return path

def delete_record(supabase_client: Client, entity_id: str, module: str, record_id: str) -> None:
    """Delete a stored JSON file from Supabase storage."""
    storage = get_storage_client(supabase_client)
    path = f"entity_{entity_id}/{module}/{record_id}.json"
    result = storage.remove([path])
    if result.get('error'):
        raise Exception(f"Supabase storage delete error: {result['error']}")
