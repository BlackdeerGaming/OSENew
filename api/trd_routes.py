from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
import uuid
from datetime import datetime

from .permissions import get_current_user, require_entity_admin, require_super_admin
from .aws.dynamo_db import db
from .db import llm

from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

router = APIRouter()

# ---------- Pydantic models ----------
class DependenciaCreate(BaseModel):
    id: Optional[str] = None
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
    id: Optional[str] = None
    nombre: str
    codigo: str
    dependencia_id: str

class SubserieCreate(BaseModel):
    id: Optional[str] = None
    nombre: str
    codigo: str
    serie_id: str
    dependencia_id: Optional[str] = None

class TRDRecordCreate(BaseModel):
    id: Optional[str] = None
    dependencia_id: str
    serie_id: str
    subserie_id: Optional[str] = None
    estado_conservacion: Optional[str] = None
    retenci_gestion: Optional[int] = None
    retenci_central: Optional[int] = None
    ddhh: Optional[str] = None
    procedimiento: Optional[str] = None
    acto_admo: Optional[str] = None
    disp_conservacion_total: bool = False
    disp_eliminacion: bool = False
    disp_seleccion: bool = False
    val_administrativo: bool = False
    val_tecnico: bool = False
    val_contable: bool = False
    val_fiscal: bool = False
    val_legal: bool = False
    val_historico: bool = False
    rep_microfilmacion: bool = False
    rep_digitalizacion: bool = False
    ord_alfabetica: bool = False
    ord_cronologica: bool = False
    ord_numerica: bool = False
    ord_otra: bool = False
    tipos_documentales: Optional[List[dict]] = []
    funciones_ids: Optional[List[str]] = []

class FuncionCreate(BaseModel):
    titulo: str
    codigo_funcion: Optional[str] = None
    descripcion: Optional[str] = None
    dependencia_id: str
    proyecto_nombre: Optional[str] = None
    proyecto_sigla: Optional[str] = None

class EntrevistadoSchema(BaseModel):
    id: Optional[str] = None
    nombres: str
    apellidos: str
    cargo: str

class EntrevistaCreate(BaseModel):
    dependencia_id: str
    fecha_entrevista: str
    entrevistado: EntrevistadoSchema

class GenerateManualRequest(BaseModel):
    cargos: List[str]
    dependencia_id: str

class DocumentoOficialCreate(BaseModel):
    tipo: str
    contenido: str


# ---------- Helpers ----------
def _strip_keys(item: dict) -> dict:
    """Remove DynamoDB PK/SK from items before returning to frontend."""
    return {k: v for k, v in item.items() if k not in ("PK", "SK")}

def _epk(entity_id: str) -> str:
    """Return ENTITY#{entity_id}, adding the prefix only when not already present.
    Prevents double-prefix when entity_id arrives as 'ENTITY#abc' from the frontend."""
    return entity_id if entity_id.startswith("ENTITY#") else f"ENTITY#{entity_id}"


# ---------- Dependencias ----------
@router.post("/entity/{entity_id}/dependencias", response_model=dict)
async def create_dependencia_entity(entity_id: str, payload: DependenciaCreate, user: dict = Depends(get_current_user)):
    require_entity_admin(user, entity_id)
    clean_codigo = payload.codigo.strip()

    # Unique code per entity, excluding self on upsert
    all_deps = await db.query_by_entity("dependencias", entity_id, sk_prefix="DEP#")
    for dep in all_deps:
        if dep.get("codigo", "").strip().lower() == clean_codigo.lower():
            if not payload.id or str(dep.get("id")) != str(payload.id):
                raise HTTPException(status_code=400, detail=f"Ya existe una dependencia con el código '{clean_codigo}' en esta entidad. Usa un código diferente.")

    dep_id = payload.id if payload.id else str(uuid.uuid4())
    now = datetime.now().isoformat()
    item = payload.dict()
    item.update({
        "id": dep_id,
        "codigo": clean_codigo,
        "entidad_id": entity_id,
        "PK": _epk(entity_id),
        "SK": f"DEP#{dep_id}",
        "created_at": now,
        "updated_at": now,
    })
    await db.put_item("dependencias", item)
    return _strip_keys(item)

@router.get("/entity/{entity_id}/dependencias", response_model=List[dict])
async def list_dependencias_entity(entity_id: str, user: dict = Depends(get_current_user)):
    require_entity_admin(user, entity_id)
    items = await db.query_by_entity("dependencias", entity_id, sk_prefix="DEP#")
    return [_strip_keys(i) for i in items]

@router.put("/entity/{entity_id}/dependencias/{dep_id}", response_model=dict)
async def update_dependencia_entity(entity_id: str, dep_id: str, payload: DependenciaCreate, user: dict = Depends(get_current_user)):
    require_entity_admin(user, entity_id)

    if payload.codigo:
        clean_codigo = payload.codigo.strip()
        all_deps = await db.query_by_entity("dependencias", entity_id, sk_prefix="DEP#")
        for dep in all_deps:
            if dep.get("codigo", "").strip().lower() == clean_codigo.lower() and str(dep.get("id")) != str(dep_id):
                raise HTTPException(status_code=400, detail=f"Ya existe una dependencia con el código '{clean_codigo}' en esta entidad.")

    pk = _epk(entity_id)
    sk = f"DEP#{dep_id}"
    existing = await db.get_item("dependencias", pk, sk)
    if not existing:
        raise HTTPException(status_code=404, detail="Dependencia not found")

    updates = payload.dict(exclude_unset=True)
    if "codigo" in updates:
        updates["codigo"] = updates["codigo"].strip()
    updates["updated_at"] = datetime.now().isoformat()

    await db.update_item("dependencias", pk, sk, updates)
    return _strip_keys({**existing, **updates})

@router.delete("/entity/{entity_id}/dependencias/{dep_id}", response_model=dict)
async def delete_dependencia_entity(entity_id: str, dep_id: str, user: dict = Depends(get_current_user)):
    require_entity_admin(user, entity_id)
    try:
        # Cascade: series and their subseries
        try:
            sers = await db.query_by_entity("series", entity_id, sk_prefix="SER#")
            dep_serie_ids = {s["id"] for s in sers if s.get("dependencia_id") == dep_id}
            try:
                subs = await db.query_by_entity("subseries", entity_id, sk_prefix="SUB#")
                for sub in subs:
                    if sub.get("serie_id") in dep_serie_ids:
                        await db.delete_item("subseries", sub["PK"], sub["SK"])
            except Exception as e:
                print(f"[CASCADE] subseries for dep {dep_id}: {e}")
            for ser in sers:
                if ser.get("dependencia_id") == dep_id:
                    await db.delete_item("series", ser["PK"], ser["SK"])
        except Exception as e:
            print(f"[CASCADE] series for dep {dep_id}: {e}")

        # Cascade: TRD records
        try:
            trds = await db.query_by_entity("trd_records", entity_id, sk_prefix="TRD#")
            for trd in trds:
                if trd.get("dependencia_id") == dep_id:
                    await db.delete_item("trd_records", trd["PK"], trd["SK"])
        except Exception as e:
            print(f"[CASCADE] trd_records for dep {dep_id}: {e}")

        # Cascade: funciones (table may not exist yet)
        try:
            funs = await db.query_by_entity("funciones", entity_id, sk_prefix="FUN#")
            for fun in funs:
                if fun.get("dependencia_id") == dep_id:
                    await db.delete_item("funciones", fun["PK"], fun["SK"])
        except Exception as e:
            print(f"[CASCADE] funciones for dep {dep_id}: {e}")

        # Cascade: entrevistas (table may not exist yet)
        try:
            ints = await db.query_by_entity("entrevistas", entity_id, sk_prefix="INT#")
            for ent in ints:
                if ent.get("dependencia_id") == dep_id:
                    await db.delete_item("entrevistas", ent["PK"], ent["SK"])
        except Exception as e:
            print(f"[CASCADE] entrevistas for dep {dep_id}: {e}")

        pk = _epk(entity_id)
        sk = f"DEP#{dep_id}"
        await db.delete_item("dependencias", pk, sk)
        return {"status": "deleted", "id": dep_id}
    except Exception as e:
        print(f"Error deleting dependencia: {e}")
        raise HTTPException(status_code=500, detail=f"Error al eliminar dependencia: {str(e)}")


# ---------- Series ----------
@router.post("/entity/{entity_id}/series", response_model=dict)
async def create_serie_entity(entity_id: str, payload: SerieCreate, user: dict = Depends(get_current_user)):
    require_entity_admin(user, entity_id)
    clean_codigo = payload.codigo.strip()

    # Unique code per dependency, excluding self on upsert
    all_series = await db.query_by_entity("series", entity_id, sk_prefix="SER#")
    for ser in all_series:
        if (ser.get("codigo", "").strip().lower() == clean_codigo.lower() and
                str(ser.get("dependencia_id")) == str(payload.dependencia_id)):
            if not payload.id or str(ser.get("id")) != str(payload.id):
                raise HTTPException(status_code=400, detail=f"Ya existe una serie con el código '{clean_codigo}' en esta dependencia.")

    serie_id = payload.id if payload.id else str(uuid.uuid4())
    now = datetime.now().isoformat()
    item = payload.dict()
    item.update({
        "id": serie_id,
        "codigo": clean_codigo,
        "entidad_id": entity_id,
        "PK": _epk(entity_id),
        "SK": f"SER#{serie_id}",
        "created_at": now,
        "updated_at": now,
    })
    await db.put_item("series", item)
    return _strip_keys(item)

@router.get("/entity/{entity_id}/series", response_model=List[dict])
async def list_series_entity(entity_id: str, user: dict = Depends(get_current_user)):
    require_entity_admin(user, entity_id)
    items = await db.query_by_entity("series", entity_id, sk_prefix="SER#")
    items.sort(key=lambda x: x.get("codigo", ""))
    return [_strip_keys(i) for i in items]

@router.put("/entity/{entity_id}/series/{serie_id}", response_model=dict)
async def update_serie_entity(entity_id: str, serie_id: str, payload: SerieCreate, user: dict = Depends(get_current_user)):
    require_entity_admin(user, entity_id)

    if payload.codigo and payload.dependencia_id:
        clean_codigo = payload.codigo.strip()
        all_series = await db.query_by_entity("series", entity_id, sk_prefix="SER#")
        for ser in all_series:
            if (ser.get("codigo", "").strip().lower() == clean_codigo.lower() and
                    str(ser.get("dependencia_id")) == str(payload.dependencia_id) and
                    str(ser.get("id")) != str(serie_id)):
                raise HTTPException(status_code=400, detail=f"Ya existe una serie con el código '{clean_codigo}' en esta dependencia.")

    pk = _epk(entity_id)
    sk = f"SER#{serie_id}"
    existing = await db.get_item("series", pk, sk)
    if not existing:
        raise HTTPException(status_code=404, detail="Serie not found")

    updates = payload.dict(exclude_unset=True)
    if "codigo" in updates:
        updates["codigo"] = updates["codigo"].strip()
    updates["updated_at"] = datetime.now().isoformat()

    await db.update_item("series", pk, sk, updates)
    return _strip_keys({**existing, **updates})

@router.delete("/entity/{entity_id}/series/{serie_id}")
async def delete_serie_entity(entity_id: str, serie_id: str, user: dict = Depends(get_current_user)):
    require_entity_admin(user, entity_id)
    try:
        # Cascade: TRD records
        try:
            trds = await db.query_by_entity("trd_records", entity_id, sk_prefix="TRD#")
            for trd in trds:
                if trd.get("serie_id") == serie_id:
                    await db.delete_item("trd_records", trd["PK"], trd["SK"])
        except Exception as e:
            print(f"[CASCADE] trd_records for serie {serie_id}: {e}")

        # Cascade: subseries
        try:
            subs = await db.query_by_entity("subseries", entity_id, sk_prefix="SUB#")
            for sub in subs:
                if sub.get("serie_id") == serie_id:
                    await db.delete_item("subseries", sub["PK"], sub["SK"])
        except Exception as e:
            print(f"[CASCADE] subseries for serie {serie_id}: {e}")

        pk = _epk(entity_id)
        sk = f"SER#{serie_id}"
        await db.delete_item("series", pk, sk)
        return {"status": "deleted", "id": serie_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al eliminar serie: {str(e)}")


# ---------- Subseries ----------
@router.post("/entity/{entity_id}/subseries", response_model=dict)
async def create_subserie_entity(entity_id: str, payload: SubserieCreate, user: dict = Depends(get_current_user)):
    require_entity_admin(user, entity_id)
    clean_codigo = payload.codigo.strip()
    clean_nombre = payload.nombre.strip()

    all_subs = await db.query_by_entity("subseries", entity_id, sk_prefix="SUB#")

    # Code uniqueness scoped to the same series, excluding self on upsert
    for sub in all_subs:
        if (sub.get("codigo", "").strip().lower() == clean_codigo.lower() and
                str(sub.get("serie_id")) == str(payload.serie_id)):
            if not payload.id or str(sub.get("id")) != str(payload.id):
                raise HTTPException(status_code=400, detail=f"Ya existe una subserie con el código '{clean_codigo}' en esta serie.")

    # Name uniqueness scoped to the same series, excluding self on upsert
    for sub in all_subs:
        if (sub.get("nombre", "").strip().lower() == clean_nombre.lower() and
                str(sub.get("serie_id")) == str(payload.serie_id)):
            if not payload.id or str(sub.get("id")) != str(payload.id):
                raise HTTPException(status_code=400, detail=f"Ya existe una subserie con el nombre '{clean_nombre}' en esta serie.")

    sub_id = payload.id if payload.id else str(uuid.uuid4())
    now = datetime.now().isoformat()
    item = payload.dict()
    item.update({
        "id": sub_id,
        "codigo": clean_codigo,
        "entidad_id": entity_id,
        "PK": _epk(entity_id),
        "SK": f"SUB#{sub_id}",
        "created_at": now,
        "updated_at": now,
    })
    await db.put_item("subseries", item)
    return _strip_keys(item)

@router.get("/entity/{entity_id}/subseries", response_model=List[dict])
async def list_subseries_entity(entity_id: str, user: dict = Depends(get_current_user)):
    require_entity_admin(user, entity_id)
    items = await db.query_by_entity("subseries", entity_id, sk_prefix="SUB#")
    items.sort(key=lambda x: x.get("codigo", ""))
    return [_strip_keys(i) for i in items]

@router.put("/entity/{entity_id}/subseries/{subserie_id}", response_model=dict)
async def update_subserie_entity(entity_id: str, subserie_id: str, payload: SubserieCreate, user: dict = Depends(get_current_user)):
    require_entity_admin(user, entity_id)

    if payload.codigo and payload.serie_id:
        clean_codigo = payload.codigo.strip()
        all_subs = await db.query_by_entity("subseries", entity_id, sk_prefix="SUB#")
        for sub in all_subs:
            if (sub.get("codigo", "").strip().lower() == clean_codigo.lower() and
                    str(sub.get("serie_id")) == str(payload.serie_id) and
                    str(sub.get("id")) != str(subserie_id)):
                raise HTTPException(status_code=400, detail=f"Ya existe una subserie con el código '{clean_codigo}' en esta serie.")

    pk = _epk(entity_id)
    sk = f"SUB#{subserie_id}"
    existing = await db.get_item("subseries", pk, sk)
    if not existing:
        raise HTTPException(status_code=404, detail="Subserie not found")

    updates = payload.dict(exclude_unset=True)
    if "codigo" in updates:
        updates["codigo"] = updates["codigo"].strip()
    updates["updated_at"] = datetime.now().isoformat()

    await db.update_item("subseries", pk, sk, updates)
    return _strip_keys({**existing, **updates})

@router.delete("/entity/{entity_id}/subseries/{subserie_id}")
async def delete_subserie_entity(entity_id: str, subserie_id: str, user: dict = Depends(get_current_user)):
    require_entity_admin(user, entity_id)
    try:
        # Cascade: TRD records linked to this subserie
        try:
            trds = await db.query_by_entity("trd_records", entity_id, sk_prefix="TRD#")
            for trd in trds:
                if trd.get("subserie_id") == subserie_id:
                    await db.delete_item("trd_records", trd["PK"], trd["SK"])
        except Exception as e:
            print(f"[CASCADE] trd_records for subserie {subserie_id}: {e}")

        pk = _epk(entity_id)
        sk = f"SUB#{subserie_id}"
        await db.delete_item("subseries", pk, sk)
        return {"status": "deleted", "id": subserie_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al eliminar subserie: {str(e)}")


# ---------- TRD Records ----------
@router.post("/entity/{entity_id}/trd_records", response_model=dict)
async def create_trd_record_entity(entity_id: str, payload: TRDRecordCreate, user: dict = Depends(get_current_user)):
    require_entity_admin(user, entity_id)

    record_id = payload.id if payload.id else str(uuid.uuid4())
    now = datetime.now().isoformat()
    item = payload.dict()
    item.update({
        "id": record_id,
        "entidad_id": entity_id,
        "PK": _epk(entity_id),
        "SK": f"TRD#{record_id}",
        "created_at": now,
        "updated_at": now,
    })
    if not item.get("funciones_ids"):
        item.pop("funciones_ids", None)

    await db.put_item("trd_records", item)
    return _strip_keys(item)

@router.get("/entity/{entity_id}/trd_records", response_model=List[dict])
async def list_trd_records_entity(entity_id: str, user: dict = Depends(get_current_user)):
    require_entity_admin(user, entity_id)
    items = await db.query_by_entity("trd_records", entity_id, sk_prefix="TRD#")
    return [_strip_keys(i) for i in items]

@router.put("/entity/{entity_id}/trd_records/{record_id}", response_model=dict)
async def update_trd_record_entity(entity_id: str, record_id: str, payload: TRDRecordCreate, user: dict = Depends(get_current_user)):
    require_entity_admin(user, entity_id)

    pk = _epk(entity_id)
    sk = f"TRD#{record_id}"
    existing = await db.get_item("trd_records", pk, sk)
    if not existing:
        raise HTTPException(status_code=404, detail="TRD Record not found")

    updates = payload.dict(exclude_unset=True)
    # Allow funciones_ids=[] to clear existing selections; only skip when absent (None)
    if "funciones_ids" in updates and updates["funciones_ids"] is None:
        updates.pop("funciones_ids", None)
    updates["updated_at"] = datetime.now().isoformat()

    await db.update_item("trd_records", pk, sk, updates)
    return _strip_keys({**existing, **updates})

@router.delete("/entity/{entity_id}/trd_records/{record_id}")
async def delete_trd_record_entity(entity_id: str, record_id: str, user: dict = Depends(get_current_user)):
    require_entity_admin(user, entity_id)
    try:
        pk = _epk(entity_id)
        sk = f"TRD#{record_id}"
        existing = await db.get_item("trd_records", pk, sk)
        if not existing:
            return {"status": "not_found", "id": record_id}
        await db.delete_item("trd_records", pk, sk)
        return {"status": "deleted", "id": record_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al eliminar valoración: {str(e)}")


# ---------- Funciones ----------
@router.post("/entity/{entity_id}/funciones", response_model=dict)
async def create_funcion_entity(entity_id: str, payload: FuncionCreate, user: dict = Depends(get_current_user)):
    require_entity_admin(user, entity_id)

    func_id = str(uuid.uuid4())
    now = datetime.now().isoformat()
    item = payload.dict()
    item.update({
        "id": func_id,
        "entidad_id": entity_id,
        "PK": _epk(entity_id),
        "SK": f"FUN#{func_id}",
        "created_at": now,
        "updated_at": now,
    })
    await db.put_item("funciones", item)
    return _strip_keys(item)

@router.get("/entity/{entity_id}/funciones", response_model=List[dict])
async def list_funciones_entity(entity_id: str, user: dict = Depends(get_current_user)):
    require_entity_admin(user, entity_id)
    try:
        items = await db.query_by_entity("funciones", entity_id, sk_prefix="FUN#")
        return [_strip_keys(i) for i in items]
    except Exception as e:
        print(f"Ignored error in list_funciones_entity: {e}")
        return []

@router.put("/entity/{entity_id}/funciones/{func_id}", response_model=dict)
async def update_funcion_entity(entity_id: str, func_id: str, payload: FuncionCreate, user: dict = Depends(get_current_user)):
    require_entity_admin(user, entity_id)

    pk = _epk(entity_id)
    sk = f"FUN#{func_id}"
    existing = await db.get_item("funciones", pk, sk)
    if not existing:
        raise HTTPException(status_code=404, detail="Funcion not found")

    updates = payload.dict(exclude_unset=True)
    updates["updated_at"] = datetime.now().isoformat()

    await db.update_item("funciones", pk, sk, updates)
    return _strip_keys({**existing, **updates})

@router.delete("/entity/{entity_id}/funciones/{func_id}", response_model=dict)
async def delete_funcion_entity(entity_id: str, func_id: str, user: dict = Depends(get_current_user)):
    require_entity_admin(user, entity_id)
    pk = _epk(entity_id)
    sk = f"FUN#{func_id}"
    await db.delete_item("funciones", pk, sk)
    return {"status": "deleted", "id": func_id}


# ---------- Entrevistas y Entrevistados ----------
@router.get("/entity/{entity_id}/entrevistados", response_model=List[dict])
async def list_entrevistados_entity(entity_id: str, user: dict = Depends(get_current_user)):
    require_entity_admin(user, entity_id)
    try:
        items = await db.query_by_entity("entrevistados", entity_id, sk_prefix="INTV#")
        return [_strip_keys(i) for i in items]
    except Exception as e:
        print(f"Ignored error in list_entrevistados_entity: {e}")
        return []

@router.post("/entity/{entity_id}/entrevistas", response_model=dict)
async def create_entrevista_entity(entity_id: str, payload: EntrevistaCreate, user: dict = Depends(get_current_user)):
    require_entity_admin(user, entity_id)
    now = datetime.now().isoformat()

    # Manage entrevistado
    entrevistado_data = payload.entrevistado.dict(exclude_unset=True)
    entrevistado_id = entrevistado_data.get("id")

    if entrevistado_id:
        pk_intv = _epk(entity_id)
        sk_intv = f"INTV#{entrevistado_id}"
        await db.update_item("entrevistados", pk_intv, sk_intv, {
            "nombres": entrevistado_data["nombres"],
            "apellidos": entrevistado_data["apellidos"],
            "cargo": entrevistado_data["cargo"],
            "updated_at": now,
        })
    else:
        entrevistado_id = str(uuid.uuid4())
        pk_intv = _epk(entity_id)
        sk_intv = f"INTV#{entrevistado_id}"
        await db.put_item("entrevistados", {
            "PK": pk_intv, "SK": sk_intv,
            "id": entrevistado_id, "entidad_id": entity_id,
            "nombres": entrevistado_data["nombres"],
            "apellidos": entrevistado_data["apellidos"],
            "cargo": entrevistado_data["cargo"],
            "created_at": now, "updated_at": now,
        })

    # Create entrevista
    entrevista_id = str(uuid.uuid4())
    record = {
        "PK": _epk(entity_id),
        "SK": f"INT#{entrevista_id}",
        "id": entrevista_id,
        "entidad_id": entity_id,
        "dependencia_id": payload.dependencia_id,
        "entrevistado_id": entrevistado_id,
        "fecha_entrevista": payload.fecha_entrevista,
        "created_at": now,
        "updated_at": now,
    }
    await db.put_item("entrevistas", record)
    return _strip_keys(record)

@router.get("/entity/{entity_id}/entrevistas", response_model=List[dict])
async def list_entrevistas_entity(entity_id: str, user: dict = Depends(get_current_user)):
    require_entity_admin(user, entity_id)
    try:
        entrevistas = await db.query_by_entity("entrevistas", entity_id, sk_prefix="INT#")
        entrevistados = await db.query_by_entity("entrevistados", entity_id, sk_prefix="INTV#")
        intv_map = {i["id"]: _strip_keys(i) for i in entrevistados}
        result = []
        for ent in entrevistas:
            ent_clean = _strip_keys(ent)
            ent_clean["entrevistado"] = intv_map.get(ent.get("entrevistado_id"))
            result.append(ent_clean)
        return result
    except Exception as e:
        print(f"Ignored error in list_entrevistas_entity: {e}")
        return []

@router.delete("/entity/{entity_id}/entrevistas/{ent_id}", response_model=dict)
async def delete_entrevista_entity(entity_id: str, ent_id: str, user: dict = Depends(get_current_user)):
    require_entity_admin(user, entity_id)
    pk = _epk(entity_id)
    sk = f"INT#{ent_id}"
    await db.delete_item("entrevistas", pk, sk)
    return {"status": "deleted", "id": ent_id}


# ---------- Super-Admin endpoints ----------
@router.get("/admin/dependencias", response_model=List[dict])
async def admin_list_dependencias(entidad_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    require_super_admin(user)
    if not entidad_id:
        return []
    items = await db.query_by_entity("dependencias", entidad_id, sk_prefix="DEP#")
    return [_strip_keys(i) for i in items]

@router.get("/admin/series", response_model=List[dict])
async def admin_list_series(entidad_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    require_super_admin(user)
    if not entidad_id:
        return []
    items = await db.query_by_entity("series", entidad_id, sk_prefix="SER#")
    return [_strip_keys(i) for i in items]

@router.get("/admin/subseries", response_model=List[dict])
async def admin_list_subseries(user: dict = Depends(get_current_user)):
    require_super_admin(user)
    items = await db.scan_table("subseries")
    return [_strip_keys(i) for i in items]

@router.get("/admin/trd_records", response_model=List[dict])
async def admin_list_trd(user: dict = Depends(get_current_user)):
    require_super_admin(user)
    items = await db.scan_table("trd_records")
    return [_strip_keys(i) for i in items]


# ---------- CCD Debug — diagnóstico de datos en DynamoDB ----------
@router.get("/entity/{entity_id}/ccd-debug", response_model=dict)
async def get_ccd_debug(entity_id: str, user: dict = Depends(get_current_user)):
    """Endpoint de diagnóstico: muestra qué hay en DynamoDB para CCD.
    Devuelve TRD records con sus campos clave, funciones con descripcion,
    y el estado del índice de cruces."""
    trd_raw       = await db.query_by_entity("trd_records",  entity_id, sk_prefix="TRD#")
    funciones_raw = await db.query_by_entity("funciones",    entity_id, sk_prefix="FUN#")
    series_raw    = await db.query_by_entity("series",       entity_id, sk_prefix="SER#")
    subseries_raw = await db.query_by_entity("subseries",    entity_id, sk_prefix="SUB#")

    trd_summary = []
    for r in trd_raw:
        rc = _strip_keys(r)
        trd_summary.append({
            "id":            rc.get("id"),
            "dependencia_id": rc.get("dependencia_id"),
            "serie_id":       rc.get("serie_id"),
            "subserie_id":    rc.get("subserie_id"),
            "acto_admo":      rc.get("acto_admo"),
            "funciones_ids":  rc.get("funciones_ids"),
            "trd_index_key":  [rc.get("serie_id",""), rc.get("subserie_id") or ""],
        })

    funciones_summary = []
    for f in funciones_raw:
        fc = _strip_keys(f)
        funciones_summary.append({
            "id":            fc.get("id"),
            "titulo":        fc.get("titulo"),
            "descripcion":   fc.get("descripcion"),
            "dependencia_id": fc.get("dependencia_id"),
        })

    series_summary = []
    for s in series_raw:
        sc = _strip_keys(s)
        subs = [_strip_keys(ss) for ss in subseries_raw if _strip_keys(ss).get("serie_id") == sc.get("id")]
        series_summary.append({
            "id":            sc.get("id"),
            "nombre":        sc.get("nombre"),
            "dependencia_id": sc.get("dependencia_id"),
            "subseries":     [{"id": ss.get("id"), "nombre": ss.get("nombre")} for ss in subs],
            "expected_trd_keys": (
                [[sc.get("id",""), ss.get("id","")]
                 for ss in subs]
                if subs else
                [[sc.get("id",""), ""]]
            ),
        })

    return {
        "entity_id": entity_id,
        "counts": {
            "trd_records":  len(trd_raw),
            "funciones":    len(funciones_raw),
            "series":       len(series_raw),
            "subseries":    len(subseries_raw),
        },
        "trd_records":  trd_summary,
        "funciones":    funciones_summary,
        "series":       series_summary,
    }


# ---------- CCD Estructurado (formato AGN Acuerdo 001 / 2024) ----------
@router.get("/entity/{entity_id}/ccd-data", response_model=dict)
async def get_ccd_data(entity_id: str, user: dict = Depends(get_current_user)):
    """Retorna los datos jerárquicos para el Cuadro de Clasificación Documental (CCD)
    en el formato exacto del AGN — 10 columnas: acto administrativo, función,
    código/nombre de sección, código/nombre de subsección, código/nombre de serie,
    código/nombre de subserie."""
    deps_raw      = await db.query_by_entity("dependencias", entity_id, sk_prefix="DEP#")
    series_raw    = await db.query_by_entity("series",       entity_id, sk_prefix="SER#")
    subseries_raw = await db.query_by_entity("subseries",    entity_id, sk_prefix="SUB#")
    trd_raw       = await db.query_by_entity("trd_records",  entity_id, sk_prefix="TRD#")
    funciones_raw = await db.query_by_entity("funciones",    entity_id, sk_prefix="FUN#")

    print(f"[CCD] entity={entity_id} → deps={len(deps_raw)} series={len(series_raw)} subs={len(subseries_raw)} trds={len(trd_raw)} funs={len(funciones_raw)}")

    deps_map      = {d["id"]: _strip_keys(d) for d in deps_raw      if "id" in d}
    funciones_map = {f["id"]: _strip_keys(f) for f in funciones_raw if "id" in f}

    # TRD records indexados solo por (serie_id, subserie_id).
    # dep_id se excluye de la clave porque puede estar vacío en la serie
    # pero lleno en el TRD record (o viceversa), causando un falso mismatch.
    # serie_id es un UUID único: no necesita dep_id para ser inequívoco.
    trd_idx: dict = {}
    for r in trd_raw:
        rc  = _strip_keys(r)
        key = (rc.get("serie_id", ""), rc.get("subserie_id") or "")
        trd_idx[key] = rc
        print(f"[CCD]  trd_idx key={key} acto_admo={rc.get('acto_admo')} funciones_ids={rc.get('funciones_ids')}")

    # Subseries agrupadas por serie_id
    subs_by_serie: dict = {}
    for ss in subseries_raw:
        sc  = _strip_keys(ss)
        sid = sc.get("serie_id")
        if sid:
            subs_by_serie.setdefault(sid, []).append(sc)

    def get_funciones(trd: dict) -> list:
        """Retorna la descripción de cada función seleccionada en el registro TRD.
        La relación es directa: trd.funciones_ids → función.descripcion.
        No se filtra por dependencia; si el ID está en funciones_ids es porque
        fue seleccionado explícitamente en ese formulario de valoración."""
        result = []
        for fid in (trd.get("funciones_ids") or []):
            f = funciones_map.get(fid)
            if f and f.get("descripcion"):
                result.append(f["descripcion"])
        return result or [""]   # Al menos una fila con función vacía si no hay funciones

    def make_rows(trd: dict, seccion: dict, subseccion: dict,
                  serie: dict, subserie: dict) -> list:
        """Crea una fila por función para el par (TRD, serie/subserie) dado."""
        base = {
            "acto_administrativo": trd.get("acto_admo") or "",
            "codigo_seccion":      seccion.get("codigo", ""),
            "nombre_seccion":      seccion.get("nombre", ""),
            "codigo_subseccion":   subseccion.get("codigo", ""),
            "nombre_subseccion":   subseccion.get("nombre", ""),
            "codigo_serie":        serie.get("codigo", ""),
            "nombre_serie":        serie.get("nombre", ""),
            "codigo_subserie":     subserie.get("codigo", ""),
            "nombre_subserie":     subserie.get("nombre", ""),
        }
        return [{**base, "funcion": desc} for desc in get_funciones(trd)]

    rows = []
    for serie_item in series_raw:
        s      = _strip_keys(serie_item)
        dep_id = s.get("dependencia_id", "")
        dep    = deps_map.get(dep_id, {})

        # Determinar sección (top-level) vs subsección (tiene depende_de)
        if dep.get("depende_de"):
            seccion    = deps_map.get(dep["depende_de"], {})
            subseccion = dep
        else:
            seccion    = dep
            subseccion = {}

        serie_id            = s.get("id", "")
        subseries_for_serie = subs_by_serie.get(serie_id, [])

        if subseries_for_serie:
            for ss in subseries_for_serie:
                lookup_key = (serie_id, ss.get("id", ""))
                trd = trd_idx.get(lookup_key, {})
                if not trd:
                    print(f"[CCD]  MISS serie={s.get('nombre')} sub={ss.get('nombre')} key={lookup_key}")
                rows.extend(make_rows(trd, seccion, subseccion, s, ss))
        else:
            lookup_key = (serie_id, "")
            trd = trd_idx.get(lookup_key, {})
            if not trd:
                print(f"[CCD]  MISS serie={s.get('nombre')} (sin subserie) key={lookup_key}")
            rows.extend(make_rows(trd, seccion, subseccion, s, {}))

    rows.sort(key=lambda r: (
        r["codigo_seccion"],    r["codigo_subseccion"],
        r["codigo_serie"],      r["codigo_subserie"],
    ))
    return {"rows": rows, "total": len(rows)}


# ---------- Generación Documental con LLM ----------
@router.post("/entity/{entity_id}/generate/ccd")
async def generate_ccd(entity_id: str, user: dict = Depends(get_current_user)):
    require_entity_admin(user, entity_id)

    deps = await db.query_by_entity("dependencias", entity_id, sk_prefix="DEP#")
    funs = await db.query_by_entity("funciones", entity_id, sk_prefix="FUN#")

    tree_text = "Estructura de la Entidad:\n"
    for d in deps:
        tree_text += f"- Dependencia: {d.get('codigo', '')} - {d.get('nombre', '')}\n"
        for f in funs:
            if f.get("dependencia_id") == d.get("id"):
                tree_text += f"  * Función: {f.get('codigo_funcion', '')} - {f.get('titulo', '')}\n"

    prompt = ChatPromptTemplate.from_messages([
        ("system", "Eres un experto archivista enfocado en la Ley 594 de 2000 (Colombia). Tu tarea es generar el 'Cuadro de Clasificación Documental' (CCD) exacto. "
         "Te proveeré el fondo documental (Estructura de la entidad, con sus Dependencias/Secciones y Funciones). "
         "Agrupa jerárquicamente en 'Fondo > Sección (Dependencia) > Serie (Función)'. Si ves agrupaciones lógicas para 'Subseries', proponlas. "
         "RESPONDE ÚNICAMENTE CON CÓDIGO HTML bien estructurado y formal (usa <h1>, <h2>, tablas o listas) sin bloques markdown (sin ```html). Evita saludos. Usa fuentes y colores formales si usas CSS inline."),
        ("user", "{data}")
    ])
    chain = prompt | llm | StrOutputParser()
    try:
        html_output = await chain.ainvoke({"data": tree_text})
        return {"html": html_output}
    except Exception as e:
        print(f"LLM Error generating CCD: {e}")
        raise HTTPException(status_code=500, detail="Error de generación por IA.")

@router.post("/entity/{entity_id}/generate/manual-funciones")
async def generate_manual(entity_id: str, payload: GenerateManualRequest, user: dict = Depends(get_current_user)):
    require_entity_admin(user, entity_id)

    dep_item = await db.get_item("dependencias", _epk(entity_id), f"DEP#{payload.dependencia_id}")
    dep_data = _strip_keys(dep_item) if dep_item else {}

    all_funs = await db.query_by_entity("funciones", entity_id, sk_prefix="FUN#")
    funciones = [f for f in all_funs if f.get("dependencia_id") == payload.dependencia_id]

    cargos_str = ", ".join(payload.cargos) if payload.cargos else "Desconocido"
    ctx = f"Cargos a documentar: {cargos_str}\n"
    ctx += f"Dependencia (Sección): {dep_data.get('nombre')} (Cód {dep_data.get('codigo')})\n"
    ctx += "Funciones de la Dependencia:\n"
    for f in funciones:
        ctx += f"- {f.get('titulo')} (Detalle: {f.get('descripcion', '')})\n"

    prompt = ChatPromptTemplate.from_messages([
        ("system", "Eres un analista de talento humano experto en el sector público de Colombia y la ley 594. "
         "Tu objetivo es redactar el 'Manual de Funciones' para un conjunto de cargos dentro de una dependencia. "
         "Para CADA cargo provisto en la lista, deberás crear una sección que incluya:\n"
         "1. Un encabezado <h2>Identificación del Cargo: [Nombre del cargo]</h2>.\n"
         "2. El Propósito Principal del Cargo basado en el nombre y las funciones de su área.\n"
         "3. Las Funciones Específicas del cargo formateadas formalmente (<ul>), extraídas de las funciones provistas.\n"
         "4. Las Relaciones e Interacciones con otras áreas.\n"
         "Si documentas MÁS DE UN CARGO, pon una etiqueta <hr style='margin: 32px 0; border-color: #ccc;' /> entre cada uno para separarlos visualmente.\n\n"
         "RESPONDE ÚNICAMENTE EN FORMATO HTML bien estructurado estilo documento formal (<h1>, <h2>, <ul>) y sin macros markdown (sin ```html), para ser embebido en una vista. El documento general debe empezar con <h1>Manual de Funciones</h1>. No expongas saludos informales."),
        ("user", "{data}")
    ])
    chain = prompt | llm | StrOutputParser()
    try:
        html_output = await chain.ainvoke({"data": ctx})
        return {"html": html_output}
    except Exception as e:
        print(f"LLM Error generating Manual: {e}")
        raise HTTPException(status_code=500, detail="Error de generación por IA.")


# ---------- Documentos Oficiales (Control de Versiones) ----------
@router.get("/entity/{entity_id}/documentos-oficiales", response_model=List[dict])
async def list_documentos_oficiales(entity_id: str, user: dict = Depends(get_current_user)):
    require_entity_admin(user, entity_id)
    items = await db.query_by_entity("documentos_oficiales", entity_id, sk_prefix="DOC#")
    items.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return [_strip_keys(i) for i in items]

@router.post("/entity/{entity_id}/documentos-oficiales", response_model=dict)
async def create_documento_oficial(entity_id: str, payload: DocumentoOficialCreate, user: dict = Depends(get_current_user)):
    require_entity_admin(user, entity_id)
    tipo = payload.tipo
    now = datetime.now().isoformat()

    try:
        all_docs = await db.query_by_entity("documentos_oficiales", entity_id, sk_prefix="DOC#")
        type_docs = [d for d in all_docs if d.get("tipo") == tipo]

        # Delete existing backup
        for doc in type_docs:
            if doc.get("is_backup"):
                await db.delete_item("documentos_oficiales", doc["PK"], doc["SK"])

        # Move active to backup
        for doc in type_docs:
            if doc.get("is_active"):
                await db.update_item("documentos_oficiales", doc["PK"], doc["SK"], {
                    "is_active": False, "is_backup": True, "updated_at": now,
                })

        # Insert new active
        doc_id = str(uuid.uuid4())
        new_doc = {
            "PK": _epk(entity_id),
            "SK": f"DOC#{doc_id}",
            "id": doc_id,
            "entidad_id": entity_id,
            "tipo": tipo,
            "contenido": payload.contenido,
            "is_active": True,
            "is_backup": False,
            "created_at": now,
            "updated_at": now,
        }
        await db.put_item("documentos_oficiales", new_doc)
        return _strip_keys(new_doc)
    except Exception as e:
        print(f"Error in versioning logic: {e}")
        raise HTTPException(status_code=500, detail=f"Error en la base de datos: {str(e)}")

@router.post("/entity/{entity_id}/documentos-oficiales/restore/{doc_id}", response_model=dict)
async def restore_documento_oficial(entity_id: str, doc_id: str, user: dict = Depends(get_current_user)):
    require_entity_admin(user, entity_id)
    now = datetime.now().isoformat()

    pk = _epk(entity_id)
    sk = f"DOC#{doc_id}"
    doc_to_restore = await db.get_item("documentos_oficiales", pk, sk)
    if not doc_to_restore:
        raise HTTPException(status_code=404, detail="Documento no encontrado")

    tipo = doc_to_restore.get("tipo")
    all_docs = await db.query_by_entity("documentos_oficiales", entity_id, sk_prefix="DOC#")
    type_docs = [d for d in all_docs if d.get("tipo") == tipo]

    # Delete existing backups (other than target)
    for doc in type_docs:
        if doc.get("is_backup") and doc.get("id") != doc_id:
            await db.delete_item("documentos_oficiales", doc["PK"], doc["SK"])

    # Move active to backup
    for doc in type_docs:
        if doc.get("is_active"):
            await db.update_item("documentos_oficiales", doc["PK"], doc["SK"], {
                "is_active": False, "is_backup": True, "updated_at": now,
            })

    # Restore target to active
    await db.update_item("documentos_oficiales", pk, sk, {
        "is_active": True, "is_backup": False, "updated_at": now,
    })

    updated = {**doc_to_restore, "is_active": True, "is_backup": False, "updated_at": now}
    return _strip_keys(updated)
