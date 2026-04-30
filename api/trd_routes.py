from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel
from typing import List, Optional
import uuid
from datetime import datetime

from .permissions import get_current_user, require_entity_admin, require_super_admin
from .cloud_storage import upload_record, delete_record
from .db import db, llm

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
    user_id: Optional[str] = None
    import_session_id: Optional[str] = None

class SerieCreate(BaseModel):
    id: Optional[str] = None
    nombre: str
    codigo: str
    tipo_documental: Optional[str] = None
    descripcion: Optional[str] = None
    dependencia_id: str
    user_id: Optional[str] = None
    import_session_id: Optional[str] = None

class SubserieCreate(BaseModel):
    id: Optional[str] = None
    nombre: str
    codigo: str
    tipo_documental: Optional[str] = None
    descripcion: Optional[str] = None
    serie_id: str
    dependencia_id: Optional[str] = None
    user_id: Optional[str] = None
    import_session_id: Optional[str] = None

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
    user_id: Optional[str] = None
    import_session_id: Optional[str] = None
    # Flags de DisposiciÃƒÂ³n
    disp_conservacion_total: bool = False
    disp_eliminacion: bool = False
    disp_seleccion: bool = False
    # Flags de ValoraciÃƒÂ³n
    val_administrativo: bool = False
    val_tecnico: bool = False
    val_contable: bool = False
    val_fiscal: bool = False
    val_legal: bool = False
    val_historico: bool = False
    # Medios y Otros
    rep_microfilmacion: bool = False
    rep_digitalizacion: bool = False
    ord_alfabetica: bool = False
    ord_cronologica: bool = False
    ord_numerica: bool = False
    ord_otra: bool = False

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
    cargos: List[str]  # Cargo names from entrevistados list
    dependencia_id: str # To grab context

class DocumentoOficialCreate(BaseModel):
    tipo: str # 'manual_funciones' | 'ccd'
    contenido: str # HTML


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
    # Insert into DynamoDB
    data = payload.dict()
    data["entidad_id"] = entity_id
    if not data.get("id"):
        data["id"] = str(uuid.uuid4())
    
    # Reparación: Check for duplicate code in same entity
    all_deps = await db.scan_table("dependencias")
    if any(d.get("entidad_id") == entity_id and d.get("codigo") == data["codigo"] for d in all_deps):
        raise HTTPException(status_code=400, detail="El código de dependencia ya existe para esta entidad.")

    # Partition Key: entity_id, Sort Key: id (for dependencias)
    data["PK"] = f"ENTITY#{entity_id}"
    data["SK"] = f"DEP#{data['id']}"
    
    await db.put_item("dependencias", data)
    
    # Cloud upload to S3
    try:
        await upload_record(
            entity_id,
            "dependencias",
            data["id"],
            data,
        )
    except Exception as e:
        # Rollback DynamoDB entry
        await db.delete_item("dependencias", data["PK"], data["SK"])
        raise HTTPException(status_code=500, detail=f"Cloud upload failed: {e}")
    return data

@router.get("/entity/{entity_id}/dependencias", response_model=List[dict])
async def list_dependencias_entity(entity_id: str, user: dict = Depends(get_current_user)):
    require_entity_admin(user, entity_id)
    # Query DynamoDB by Partition Key (assuming DEP prefix in SK for filtering)
    return await db.query_by_entity("dependencias", entity_id, sk_prefix="DEP#")

@router.put("/entity/{entity_id}/dependencias/{dep_id}", response_model=dict)
async def update_dependencia_entity(
    entity_id: str,
    dep_id: str,
    payload: DependenciaCreate,
    user: dict = Depends(get_current_user),
):
    require_entity_admin(user, entity_id)
    data = payload.dict(exclude_unset=True)
    pk = f"ENTITY#{entity_id}"
    sk = f"DEP#{dep_id}"
    
    await db.update_item("dependencias", pk, sk, data)
    
    # Get full item for S3 update
    full_item = await db.get_item("dependencias", pk, sk)
    try:
        await upload_record(
            entity_id,
            "dependencias",
            dep_id,
            full_item,
        )
    except Exception as e:
        print(f"Cloud sync failed: {e}")
    return full_item

@router.delete("/entity/{entity_id}/dependencias/{dep_id}", response_model=dict)
async def delete_dependencia_entity(entity_id: str, dep_id: str, user: dict = Depends(get_current_user)):
    require_entity_admin(user, entity_id)
    # Delete from cloud storage first
    try:
        await delete_record(entity_id, "dependencias", dep_id)
    except: pass
    # Delete from DynamoDB
    await db.delete_item("dependencias", f"ENTITY#{entity_id}", f"DEP#{dep_id}")
    return {"status": "deleted", "id": dep_id}

# ---------- Series ----------
@router.post("/entity/{entity_id}/series", response_model=dict)
async def create_serie_entity(
    entity_id: str,
    payload: SerieCreate,
    user: dict = Depends(get_current_user),
):
    require_entity_admin(user, entity_id)
    data = payload.dict()
    data["entidad_id"] = entity_id
    if not data.get("id"): data["id"] = str(uuid.uuid4())

    # Reparación: Check for duplicate code in same entity
    all_series = await db.scan_table("series")
    if any(s.get("entidad_id") == entity_id and s.get("codigo") == data["codigo"] for s in all_series):
        raise HTTPException(status_code=400, detail="El código de serie ya existe para esta entidad.")

    data["PK"] = f"ENTITY#{entity_id}"
    data["SK"] = f"SER#{data['id']}"
    
    await db.put_item("series", data)
    try:
        await upload_record(entity_id, "series", data["id"], data)
    except Exception as e:
        await db.delete_item("series", data["PK"], data["SK"])
        raise HTTPException(status_code=500, detail=f"Cloud upload failed: {e}")
    return data

@router.get("/entity/{entity_id}/series", response_model=List[dict])
async def list_series_entity(entity_id: str, user: dict = Depends(get_current_user)):
    require_entity_admin(user, entity_id)
    return await db.query_by_entity("series", entity_id, sk_prefix="SER#")

@router.put("/entity/{entity_id}/series/{serie_id}", response_model=dict)
async def update_serie_entity(
    entity_id: str,
    serie_id: str,
    payload: SerieCreate,
    user: dict = Depends(get_current_user),
):
    require_entity_admin(user, entity_id)
    data = payload.dict(exclude_unset=True)
    pk, sk = f"ENTITY#{entity_id}", f"SER#{serie_id}"
    await db.update_item("series", pk, sk, data)
    record = await db.get_item("series", pk, sk)
    try:
        await upload_record(entity_id, "series", serie_id, record)
    except Exception: pass
    return record

@router.delete("/entity/{entity_id}/series/{serie_id}")
async def delete_serie_entity(entity_id: str, serie_id: str, user: dict = Depends(get_current_user)):
    require_entity_admin(user, entity_id)
    try:
        await delete_record(entity_id, "series", serie_id)
    except: pass
    await db.delete_item("series", f"ENTITY#{entity_id}", f"SER#{serie_id}")
    return {"status": "deleted", "id": serie_id}

# ---------- Subseries ----------
@router.post("/entity/{entity_id}/subseries", response_model=dict)
async def create_subserie_entity(
    entity_id: str,
    payload: SubserieCreate,
    user: dict = Depends(get_current_user),
):
    require_entity_admin(user, entity_id)
    data = payload.dict()
    data["entidad_id"] = entity_id
    if not data.get("id"): data["id"] = str(uuid.uuid4())

    # Reparación: Check for duplicate code in same entity, dependency and series
    all_subs = await db.scan_table("subseries")
    if any(
        s.get("entidad_id") == entity_id and 
        s.get("dependencia_id") == data.get("dependencia_id") and
        s.get("serie_id") == data.get("serie_id") and
        s.get("codigo") == data["codigo"] 
        for s in all_subs
    ):
        raise HTTPException(status_code=400, detail="Ya existe una subserie con este código dentro de la misma dependencia y serie")

    data["PK"] = f"ENTITY#{entity_id}"
    data["SK"] = f"SUB#{data['id']}"
    
    await db.put_item("subseries", data)
    try:
        await upload_record(entity_id, "subseries", data["id"], data)
    except Exception as e:
        await db.delete_item("subseries", data["PK"], data["SK"])
        raise HTTPException(status_code=500, detail=f"Cloud upload failed: {e}")
    return data

@router.get("/entity/{entity_id}/subseries", response_model=List[dict])
async def list_subseries_entity(entity_id: str, user: dict = Depends(get_current_user)):
    require_entity_admin(user, entity_id)
    return await db.query_by_entity("subseries", entity_id, sk_prefix="SUB#")

@router.put("/entity/{entity_id}/subseries/{subserie_id}", response_model=dict)
async def update_subserie_entity(
    entity_id: str,
    subserie_id: str,
    payload: SubserieCreate,
    user: dict = Depends(get_current_user),
):
    require_entity_admin(user, entity_id)
    data = payload.dict(exclude_unset=True)
    pk, sk = f"ENTITY#{entity_id}", f"SUB#{subserie_id}"
    await db.update_item("subseries", pk, sk, data)
    record = await db.get_item("subseries", pk, sk)
    try:
        await upload_record(entity_id, "subseries", subserie_id, record)
    except Exception: pass
    return record

@router.delete("/entity/{entity_id}/subseries/{subserie_id}")
async def delete_subserie_entity(entity_id: str, subserie_id: str, user: dict = Depends(get_current_user)):
    require_entity_admin(user, entity_id)
    try:
        await delete_record(entity_id, "subseries", subserie_id)
    except: pass
    await db.delete_item("subseries", f"ENTITY#{entity_id}", f"SUB#{subserie_id}")
    return {"status": "deleted", "id": subserie_id}

# ---------- TRD Records ----------
@router.post("/entity/{entity_id}/trd_records", response_model=dict)
async def create_trd_record_entity(
    entity_id: str,
    payload: TRDRecordCreate,
    user: dict = Depends(get_current_user),
):
    require_entity_admin(user, entity_id)
    data = payload.dict()
    data["entidad_id"] = entity_id
    if not data.get("id"): data["id"] = str(uuid.uuid4())
    data["PK"] = f"ENTITY#{entity_id}"
    data["SK"] = f"TRD#{data['id']}"
    
    await db.put_item("trd_records", data)
    try:
        await upload_record(entity_id, "trd_records", data["id"], data)
    except Exception as e:
        await db.delete_item("trd_records", data["PK"], data["SK"])
        raise HTTPException(status_code=500, detail=f"Cloud upload failed: {e}")
    return data

@router.get("/entity/{entity_id}/trd_records", response_model=List[dict])
async def list_trd_records_entity(entity_id: str, user: dict = Depends(get_current_user)):
    require_entity_admin(user, entity_id)
    return await db.query_by_entity("trd_records", entity_id, sk_prefix="TRD#")

@router.put("/entity/{entity_id}/trd_records/{record_id}", response_model=dict)
async def update_trd_record_entity(
    entity_id: str,
    record_id: str,
    payload: TRDRecordCreate,
    user: dict = Depends(get_current_user),
):
    require_entity_admin(user, entity_id)
    data = payload.dict(exclude_unset=True)
    pk, sk = f"ENTITY#{entity_id}", f"TRD#{record_id}"
    await db.update_item("trd_records", pk, sk, data)
    record = await db.get_item("trd_records", pk, sk)
    try:
        await upload_record(entity_id, "trd_records", record_id, record)
    except Exception: pass
    return record

@router.delete("/entity/{entity_id}/trd_records/{record_id}")
async def delete_trd_record_entity(entity_id: str, record_id: str, user: dict = Depends(get_current_user)):
    require_entity_admin(user, entity_id)
    try: await delete_record(entity_id, "trd_records", record_id)
    except: pass
    await db.delete_item("trd_records", f"ENTITY#{entity_id}", f"TRD#{record_id}")
    return {"status": "deleted", "id": record_id}

# ---------- Funciones ----------
@router.post("/entity/{entity_id}/funciones", response_model=dict)
async def create_funcion_entity(
    entity_id: str,
    payload: FuncionCreate,
    user: dict = Depends(get_current_user),
):
    require_entity_admin(user, entity_id)
    data = payload.dict()
    data["entidad_id"] = entity_id
    if not data.get("id"): data["id"] = str(uuid.uuid4())
    data["PK"] = f"ENTITY#{entity_id}"
    data["SK"] = f"FUN#{data['id']}"
    
    await db.put_item("funciones", data)
    try:
        await upload_record(entity_id, "funciones", data["id"], data)
    except Exception as e:
        await db.delete_item("funciones", data["PK"], data["SK"])
        raise HTTPException(status_code=500, detail=f"Cloud upload failed: {e}")
    return data

@router.get("/entity/{entity_id}/funciones", response_model=List[dict])
async def list_funciones_entity(entity_id: str, user: dict = Depends(get_current_user)):
    require_entity_admin(user, entity_id)
    return await db.query_by_entity("funciones", entity_id, sk_prefix="FUN#")

@router.put("/entity/{entity_id}/funciones/{func_id}", response_model=dict)
async def update_funcion_entity(
    entity_id: str,
    func_id: str,
    payload: FuncionCreate,
    user: dict = Depends(get_current_user),
):
    require_entity_admin(user, entity_id)
    data = payload.dict(exclude_unset=True)
    pk, sk = f"ENTITY#{entity_id}", f"FUN#{func_id}"
    await db.update_item("funciones", pk, sk, data)
    record = await db.get_item("funciones", pk, sk)
    try:
        await upload_record(entity_id, "funciones", func_id, record)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Cloud sync failed: {e}")
    return record

@router.delete("/entity/{entity_id}/funciones/{func_id}", response_model=dict)
async def delete_funcion_entity(entity_id: str, func_id: str, user: dict = Depends(get_current_user)):
    require_entity_admin(user, entity_id)
    try: await delete_record(entity_id, "funciones", func_id)
    except: pass
    await db.delete_item("funciones", f"ENTITY#{entity_id}", f"FUN#{func_id}")
    return {"status": "deleted", "id": func_id}

# ---------- Entrevistas y Entrevistados ----------

@router.get("/entity/{entity_id}/entrevistados", response_model=List[dict])
async def list_entrevistados_entity(entity_id: str, user: dict = Depends(get_current_user)):
    require_entity_admin(user, entity_id)
    return await db.query_by_entity("entrevistados", entity_id, sk_prefix="ETV#")

@router.post("/entity/{entity_id}/entrevistas", response_model=dict)
async def create_entrevista_entity(
    entity_id: str,
    payload: EntrevistaCreate,
    user: dict = Depends(get_current_user),
):
    require_entity_admin(user, entity_id)
    
    # 1. Manage Entrevistado
    entrevistado_data = payload.entrevistado.dict(exclude_unset=True)
    entrevistado_id = entrevistado_data.get("id")
    
    if entrevistado_id:
        pk, sk = f"ENTITY#{entity_id}", f"ETV#{entrevistado_id}"
        await db.update_item("entrevistados", pk, sk, {
            "nombres": entrevistado_data["nombres"],
            "apellidos": entrevistado_data["apellidos"],
            "cargo": entrevistado_data["cargo"]
        })
    else:
        entrevistado_id = str(uuid.uuid4())
        await db.put_item("entrevistados", {
            "PK": f"ENTITY#{entity_id}",
            "SK": f"ETV#{entrevistado_id}",
            "id": entrevistado_id,
            "entidad_id": entity_id,
            "nombres": entrevistado_data["nombres"],
            "apellidos": entrevistado_data["apellidos"],
            "cargo": entrevistado_data["cargo"]
        })

    # 2. Manage Entrevista
    ent_id = str(uuid.uuid4())
    entrevista_data = {
        "PK": f"ENTITY#{entity_id}",
        "SK": f"ETR#{ent_id}",
        "id": ent_id,
        "entidad_id": entity_id,
        "dependencia_id": payload.dependencia_id,
        "entrevistado_id": entrevistado_id,
        "fecha_entrevista": payload.fecha_entrevista
    }
    await db.put_item("entrevistas", entrevista_data)
    try:
        await upload_record(entity_id, "entrevistas", ent_id, entrevista_data)
    except Exception as e:
        pass # Ignore minor cloud sync upload error on create
    return entrevista_data

@router.get("/entity/{entity_id}/entrevistas", response_model=List[dict])
async def list_entrevistas_entity(entity_id: str, user: dict = Depends(get_current_user)):
    require_entity_admin(user, entity_id)
    return await db.query_by_entity("entrevistas", entity_id, sk_prefix="ETR#")

@router.delete("/entity/{entity_id}/entrevistas/{ent_id}", response_model=dict)
async def delete_entrevista_entity(entity_id: str, ent_id: str, user: dict = Depends(get_current_user)):
    require_entity_admin(user, entity_id)
    try: await delete_record(entity_id, "entrevistas", ent_id)
    except: pass
    await db.delete_item("entrevistas", f"ENTITY#{entity_id}", f"ETR#{ent_id}")
    return {"status": "deleted", "id": ent_id}

# ---------- Super‑Admin endpoints (no entity scoping) ----------
@router.get("/admin/dependencias", response_model=List[dict])
async def admin_list_dependencias(entidad_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    if user.get("role") != SUPERADMIN_ROLE:
        raise HTTPException(status_code=403, detail="Only superadmins can access this.")
    
    if entidad_id:
        return await db.query_by_entity("dependencias", entidad_id, sk_prefix="DEP#")
    
    # Por seguridad, no devolvemos nada sin entidad_id a menos que sea necesario un scan global (evitar fuga)
    return []

@router.get("/admin/series", response_model=List[dict])
async def admin_list_series(entidad_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    if user.get("role") != SUPERADMIN_ROLE:
        raise HTTPException(status_code=403, detail="Only superadmins can access this.")
    
    if entidad_id:
        return await db.query_by_entity("series", entidad_id, sk_prefix="SER#")
    return []

# ---------- Generación Documental con LLM ----------

@router.post("/entity/{entity_id}/generate/ccd")
async def generate_ccd(entity_id: str, user: dict = Depends(get_current_user)):
    
    require_entity_admin(user, entity_id)
    # 1. Gather all dependencias and funciones from DynamoDB
    deps = await db.query_by_entity("dependencias", entity_id)
    funs = await db.query_by_entity("funciones", entity_id)
    
    # Simple structured tree formatting
    tree_text = "Estructura de la Entidad:\n"
    for d in deps:
        tree_text += f"- Dependencia: {d.get('codigo', '')} - {d.get('nombre', '')}\n"
        deps_funs = [f for f in funs if f.get('dependencia_id') == d.get('id')]
        for f in deps_funs:
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
        html_output = chain.invoke({"data": tree_text})
        return {"html": html_output}
    except Exception as e:
        print(f"LLM Error generating CCD: {e}")
        raise HTTPException(status_code=500, detail="Error de generación por IA.")

@router.post("/entity/{entity_id}/generate/manual-funciones")
async def generate_manual(entity_id: str, payload: GenerateManualRequest, user: dict = Depends(get_current_user)):
    
    require_entity_admin(user, entity_id)
    # Query dependency
    dep_data = await db.get_item("dependencias", f"ENTITY#{entity_id}", f"DEP#{payload.dependencia_id}")
    # Query functions of that dependency
    all_funs = await db.query_by_entity("funciones", entity_id)
    funciones = [f for f in all_funs if f.get("dependencia_id") == payload.dependencia_id]
    
    # Context format
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
        html_output = chain.invoke({"data": ctx})
        return {"html": html_output}
    except Exception as e:
        print(f"LLM Error generating Manual: {e}")
        raise HTTPException(status_code=500, detail="Error de generación por IA.")

@router.get("/admin/subseries", response_model=List[dict])
async def admin_list_subseries(user: dict = Depends(get_current_user)):
    require_super_admin(user)
    return await db.scan_table("subseries")

@router.get("/admin/trd_records", response_model=List[dict])
async def admin_list_trd(user: dict = Depends(get_current_user)):
    require_super_admin(user)
    return await db.scan_table("trd_records")

# ---------- Documentos Oficiales (Control de Versiones) ----------

@router.get("/entity/{entity_id}/documentos-oficiales", response_model=List[dict])
async def list_documentos_oficiales(entity_id: str, user: dict = Depends(get_current_user)):
    require_entity_admin(user, entity_id)
    items = await db.query_by_entity("documentos_oficiales", entity_id)
    # Sort by created_at desc manually if needed, or rely on DynamoDB Sort Key
    return [i for i in items if i.get("SK", "").startswith("DOC#")]

@router.post("/entity/{entity_id}/documentos-oficiales", response_model=dict)
async def create_documento_oficial(
    entity_id: str,
    payload: DocumentoOficialCreate,
    user: dict = Depends(get_current_user),
):
    require_entity_admin(user, entity_id)
    
    tipo = payload.tipo
    contenido = payload.contenido
    pk = f"ENTITY#{entity_id}"

    try:
        # 1. Obtener documentos existentes del mismo tipo
        items = await db.query_by_entity("documentos_oficiales", entity_id)
        docs_tipo = [i for i in items if i.get("tipo") == tipo]
        
        # 2. Eliminar backup anterior y convertir activo en backup
        for doc in docs_tipo:
            if doc.get("is_backup"):
                await db.delete_item("documentos_oficiales", pk, doc["SK"])
            elif doc.get("is_active"):
                await db.update_item("documentos_oficiales", pk, doc["SK"], {"is_active": False, "is_backup": True})

        # 3. Insertar el nuevo como activo
        doc_id = str(uuid.uuid4())
        new_doc = {
            "PK": pk,
            "SK": f"DOC#{doc_id}",
            "id": doc_id,
            "entidad_id": entity_id,
            "tipo": tipo,
            "contenido": contenido,
            "is_active": True,
            "is_backup": False,
            "created_at": datetime.now().isoformat()
        }
        await db.put_item("documentos_oficiales", new_doc)
        return new_doc
    except Exception as e:
        print(f"Error in versioning logic: {e}")
        raise HTTPException(status_code=500, detail=f"Error en la base de datos: {str(e)}")

@router.post("/entity/{entity_id}/documentos-oficiales/restore/{doc_id}", response_model=dict)
async def restore_documento_oficial(
    entity_id: str,
    doc_id: str,
    user: dict = Depends(get_current_user),
):
    require_entity_admin(user, entity_id)
    pk = f"ENTITY#{entity_id}"
    
    # 1. Obtener el documento a restaurar
    doc_to_restore = await db.get_item("documentos_oficiales", pk, f"DOC#{doc_id}")
    if not doc_to_restore:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    
    tipo = doc_to_restore["tipo"]

    # 2. El activo actual pasa a ser backup
    items = await db.query_by_entity("documentos_oficiales", entity_id)
    for doc in items:
        if doc.get("tipo") == tipo:
            if doc.get("is_backup"):
                await db.delete_item("documentos_oficiales", pk, doc["SK"])
            elif doc.get("is_active"):
                await db.update_item("documentos_oficiales", pk, doc["SK"], {"is_active": False, "is_backup": True})
    
    # 3. El documento target pasa a ser activo
    await db.update_item("documentos_oficiales", pk, f"DOC#{doc_id}", {"is_active": True, "is_backup": False})
    return await db.get_item("documentos_oficiales", pk, f"DOC#{doc_id}")

