from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel
from typing import List, Optional
import uuid

from .permissions import get_current_user, require_entity_admin, require_super_admin
from .cloud_storage import upload_record, delete_record

# Assuming supabase_client is imported from main module
from .main import supabase_client

router = APIRouter()

# ---------- Pydantic models ----------
class DependenciaCreate(BaseModel):
    nombre: str
    sigla: Optional[str] = None
    codigo: str
    pais: Optional[str] = "Colombia"
    departamento: Optional[str] = None
    ciudad: Optional[str] = None
    direccion: Optional[str] = None
    telefono: Optional[str] = None
    depende_de: Optional[str] = None

class SerieCreate(BaseModel):
    nombre: str
    codigo: str
    tipo_documental: Optional[str] = None
    descripcion: Optional[str] = None
    dependencia_id: str

class SubserieCreate(BaseModel):
    nombre: str
    codigo: str
    tipo_documental: Optional[str] = None
    descripcion: Optional[str] = None
    serie_id: str
    dependencia_id: Optional[str] = None

class TRDRecordCreate(BaseModel):
    dependencia_id: str
    serie_id: str
    subserie_id: Optional[str] = None
    estado_conservacion: Optional[str] = None
    retenci_gestion: Optional[int] = None
    retenci_central: Optional[int] = None
    ddhh: Optional[str] = None
    procedimiento: Optional[str] = None
    acto_admo: Optional[str] = None
    # flags omitted for brevity

# ---------- Helper functions ----------
def _record_to_dict(record) -> dict:
    """Convert a Pydantic model (or dict) to a plain dict suitable for JSON storage."""
    if isinstance(record, BaseModel):
        return record.dict(exclude_unset=True)
    return dict(record)

# ---------- Dependencias ----------
@router.post("/entity/{entity_id}/dependencias", response_model=dict)
async def create_dependencia_entity(
    entity_id: str,
    payload: DependenciaCreate,
    user: dict = Depends(get_current_user),
    background: BackgroundTasks = None,
):
    # Permission check: entity admin only for their entity
    require_entity_admin(user, entity_id)
    # Insert into Supabase DB
    data = payload.dict()
    data["entity_id"] = entity_id
    res = supabase_client.table("dependencias").insert(data).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to create dependencia")
    record = res.data[0]
    # Cloud upload (synchronous – block on error)
    try:
        path = upload_record(
            supabase_client,
            entity_id,
            "dependencias",
            record["id"],
            _record_to_dict(record),
        )
        # Store cloud_key back in DB
        supabase_client.table("dependencias").update({"cloud_key": path}).eq("id", record["id"]).execute()
    except Exception as e:
        # Rollback DB entry
        supabase_client.table("dependencias").delete().eq("id", record["id"]).execute()
        raise HTTPException(status_code=500, detail=f"Cloud upload failed: {e}")
    return record

@router.get("/entity/{entity_id}/dependencias", response_model=List[dict])
async def list_dependencias_entity(entity_id: str, user: dict = Depends(get_current_user)):
    require_entity_admin(user, entity_id)
    res = supabase_client.table("dependencias").select("*").eq("entity_id", entity_id).execute()
    return res.data

@router.put("/entity/{entity_id}/dependencias/{dep_id}", response_model=dict)
async def update_dependencia_entity(
    entity_id: str,
    dep_id: str,
    payload: DependenciaCreate,
    user: dict = Depends(get_current_user),
):
    require_entity_admin(user, entity_id)
    data = payload.dict(exclude_unset=True)
    res = supabase_client.table("dependencias").update(data).eq("id", dep_id).eq("entity_id", entity_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Dependencia not found")
    # Update cloud storage representation
    record = res.data[0]
    try:
        path = upload_record(
            supabase_client,
            entity_id,
            "dependencias",
            dep_id,
            _record_to_dict(record),
        )
        supabase_client.table("dependencias").update({"cloud_key": path}).eq("id", dep_id).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Cloud sync failed: {e}")
    return record

@router.delete("/entity/{entity_id}/dependencias/{dep_id}", response_model=dict)
async def delete_dependencia_entity(entity_id: str, dep_id: str, user: dict = Depends(get_current_user)):
    require_entity_admin(user, entity_id)
    # Delete from cloud storage first (ignore errors)
    try:
        delete_record(supabase_client, entity_id, "dependencias", dep_id)
    except Exception:
        pass
    # Delete DB record
    res = supabase_client.table("dependencias").delete().eq("id", dep_id).eq("entity_id", entity_id).execute()
    return {"status": "deleted", "id": dep_id}

# ---------- Series (similar pattern) ----------
@router.post("/entity/{entity_id}/series", response_model=dict)
async def create_serie_entity(
    entity_id: str,
    payload: SerieCreate,
    user: dict = Depends(get_current_user),
):
    require_entity_admin(user, entity_id)
    data = payload.dict()
    data["entity_id"] = entity_id
    res = supabase_client.table("series").insert(data).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to create serie")
    record = res.data[0]
    try:
        path = upload_record(supabase_client, entity_id, "series", record["id"], _record_to_dict(record))
        supabase_client.table("series").update({"cloud_key": path}).eq("id", record["id"]).execute()
    except Exception as e:
        supabase_client.table("series").delete().eq("id", record["id"]).execute()
        raise HTTPException(status_code=500, detail=f"Cloud upload failed: {e}")
    return record

# List, update, delete for series follow same pattern (omitted for brevity)

# ---------- Subseries ----------
@router.post("/entity/{entity_id}/subseries", response_model=dict)
async def create_subserie_entity(
    entity_id: str,
    payload: SubserieCreate,
    user: dict = Depends(get_current_user),
):
    require_entity_admin(user, entity_id)
    data = payload.dict()
    data["entity_id"] = entity_id
    res = supabase_client.table("subseries").insert(data).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to create subserie")
    record = res.data[0]
    try:
        path = upload_record(supabase_client, entity_id, "subseries", record["id"], _record_to_dict(record))
        supabase_client.table("subseries").update({"cloud_key": path}).eq("id", record["id"]).execute()
    except Exception as e:
        supabase_client.table("subseries").delete().eq("id", record["id"]).execute()
        raise HTTPException(status_code=500, detail=f"Cloud upload failed: {e}")
    return record

# ---------- TRD Records ----------
@router.post("/entity/{entity_id}/trd_records", response_model=dict)
async def create_trd_record_entity(
    entity_id: str,
    payload: TRDRecordCreate,
    user: dict = Depends(get_current_user),
):
    require_entity_admin(user, entity_id)
    data = payload.dict()
    data["entity_id"] = entity_id
    res = supabase_client.table("trd_records").insert(data).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to create TRD record")
    record = res.data[0]
    try:
        path = upload_record(supabase_client, entity_id, "trd_records", record["id"], _record_to_dict(record))
        supabase_client.table("trd_records").update({"cloud_key": path}).eq("id", record["id"]).execute()
    except Exception as e:
        supabase_client.table("trd_records").delete().eq("id", record["id"]).execute()
        raise HTTPException(status_code=500, detail=f"Cloud upload failed: {e}")
    return record

# ---------- Super‑Admin endpoints (no entity scoping) ----------
@router.get("/admin/dependencias", response_model=List[dict])
async def admin_list_dependencias(user: dict = Depends(get_current_user)):
    require_super_admin(user)
    res = supabase_client.table("dependencias").select("*").execute()
    return res.data

@router.get("/admin/series", response_model=List[dict])
async def admin_list_series(user: dict = Depends(get_current_user)):
    require_super_admin(user)
    res = supabase_client.table("series").select("*").execute()
    return res.data

@router.get("/admin/subseries", response_model=List[dict])
async def admin_list_subseries(user: dict = Depends(get_current_user)):
    require_super_admin(user)
    res = supabase_client.table("subseries").select("*").execute()
    return res.data

@router.get("/admin/trd_records", response_model=List[dict])
async def admin_list_trd(user: dict = Depends(get_current_user)):
    require_super_admin(user)
    res = supabase_client.table("trd_records").select("*").execute()
    return res.data

# Additional admin CRUD (create, update, delete) can be added similarly.
