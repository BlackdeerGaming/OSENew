from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel
from typing import List, Optional
import uuid

from .permissions import get_current_user, require_entity_admin, require_super_admin
from .cloud_storage import upload_record, delete_record

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
    tipo_documental: Optional[str] = None
    descripcion: Optional[str] = None
    dependencia_id: str

class SubserieCreate(BaseModel):
    id: Optional[str] = None
    nombre: str
    codigo: str
    tipo_documental: Optional[str] = None
    descripcion: Optional[str] = None
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

@router.get("/entity/{entity_id}/series", response_model=List[dict])
async def list_series_entity(entity_id: str, user: dict = Depends(get_current_user)):
    require_entity_admin(user, entity_id)
    res = supabase_client.table("series").select("*").eq("entity_id", entity_id).order("codigo").execute()
    return res.data or []

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

@router.get("/entity/{entity_id}/subseries", response_model=List[dict])
async def list_subseries_entity(entity_id: str, user: dict = Depends(get_current_user)):
    require_entity_admin(user, entity_id)
    res = supabase_client.table("subseries").select("*").eq("entity_id", entity_id).order("codigo").execute()
    return res.data or []

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

@router.get("/entity/{entity_id}/trd_records", response_model=List[dict])
async def list_trd_records_entity(entity_id: str, user: dict = Depends(get_current_user)):
    require_entity_admin(user, entity_id)
    res = supabase_client.table("trd_records").select("*").eq("entity_id", entity_id).execute()
    return res.data or []

# ---------- Funciones ----------
@router.post("/entity/{entity_id}/funciones", response_model=dict)
async def create_funcion_entity(
    entity_id: str,
    payload: FuncionCreate,
    user: dict = Depends(get_current_user),
):
    require_entity_admin(user, entity_id)
    data = payload.dict()
    data["entity_id"] = entity_id
    res = supabase_client.table("funciones").insert(data).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to create funcion")
    record = res.data[0]
    try:
        path = upload_record(supabase_client, entity_id, "funciones", record["id"], _record_to_dict(record))
        supabase_client.table("funciones").update({"cloud_key": path}).eq("id", record["id"]).execute()
    except Exception as e:
        supabase_client.table("funciones").delete().eq("id", record["id"]).execute()
        raise HTTPException(status_code=500, detail=f"Cloud upload failed: {e}")
    return record

@router.get("/entity/{entity_id}/funciones", response_model=List[dict])
async def list_funciones_entity(entity_id: str, user: dict = Depends(get_current_user)):
    require_entity_admin(user, entity_id)
    res = supabase_client.table("funciones").select("*").eq("entity_id", entity_id).execute()
    return res.data

@router.put("/entity/{entity_id}/funciones/{func_id}", response_model=dict)
async def update_funcion_entity(
    entity_id: str,
    func_id: str,
    payload: FuncionCreate,
    user: dict = Depends(get_current_user),
):
    require_entity_admin(user, entity_id)
    data = payload.dict(exclude_unset=True)
    res = supabase_client.table("funciones").update(data).eq("id", func_id).eq("entity_id", entity_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Funcion not found")
    record = res.data[0]
    try:
        path = upload_record(supabase_client, entity_id, "funciones", func_id, _record_to_dict(record))
        supabase_client.table("funciones").update({"cloud_key": path}).eq("id", func_id).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Cloud sync failed: {e}")
    return record

@router.delete("/entity/{entity_id}/funciones/{func_id}", response_model=dict)
async def delete_funcion_entity(entity_id: str, func_id: str, user: dict = Depends(get_current_user)):
    require_entity_admin(user, entity_id)
    try:
        delete_record(supabase_client, entity_id, "funciones", func_id)
    except Exception:
        pass
    res = supabase_client.table("funciones").delete().eq("id", func_id).eq("entity_id", entity_id).execute()
    return {"status": "deleted", "id": func_id}

# ---------- Entrevistas y Entrevistados ----------

@router.get("/entity/{entity_id}/entrevistados", response_model=List[dict])
async def list_entrevistados_entity(entity_id: str, user: dict = Depends(get_current_user)):
    require_entity_admin(user, entity_id)
    res = supabase_client.table("entrevistados").select("*").eq("entity_id", entity_id).execute()
    return res.data

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
        # Update existing
        supabase_client.table("entrevistados").update({
            "nombres": entrevistado_data["nombres"],
            "apellidos": entrevistado_data["apellidos"],
            "cargo": entrevistado_data["cargo"]
        }).eq("id", entrevistado_id).eq("entity_id", entity_id).execute()
    else:
        # Create new
        res_entrev_create = supabase_client.table("entrevistados").insert({
            "entity_id": entity_id,
            "nombres": entrevistado_data["nombres"],
            "apellidos": entrevistado_data["apellidos"],
            "cargo": entrevistado_data["cargo"]
        }).execute()
        if not res_entrev_create.data:
            raise HTTPException(status_code=500, detail="Failed to create entrevistado")
        entrevistado_id = res_entrev_create.data[0]["id"]

    # 2. Manage Entrevista
    entrevista_data = {
        "entity_id": entity_id,
        "dependencia_id": payload.dependencia_id,
        "entrevistado_id": entrevistado_id,
        "fecha_entrevista": payload.fecha_entrevista
    }
    res = supabase_client.table("entrevistas").insert(entrevista_data).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to create entrevista")
    
    record = res.data[0]
    try:
        path = upload_record(supabase_client, entity_id, "entrevistas", record["id"], _record_to_dict(record))
        supabase_client.table("entrevistas").update({"cloud_key": path}).eq("id", record["id"]).execute()
    except Exception as e:
        pass # Ignore minor cloud sync upload error on create
    return record

@router.get("/entity/{entity_id}/entrevistas", response_model=List[dict])
async def list_entrevistas_entity(entity_id: str, user: dict = Depends(get_current_user)):
    from .main import supabase_client
    require_entity_admin(user, entity_id)
    # Using foreign key joins for easiest frontend use
    res = supabase_client.table("entrevistas").select("*, entrevistado:entrevistados(*)").eq("entity_id", entity_id).execute()
    return res.data

@router.delete("/entity/{entity_id}/entrevistas/{ent_id}", response_model=dict)
async def delete_entrevista_entity(entity_id: str, ent_id: str, user: dict = Depends(get_current_user)):
    from .main import supabase_client
    require_entity_admin(user, entity_id)
    try:
        delete_record(supabase_client, entity_id, "entrevistas", ent_id)
    except Exception:
        pass
    res = supabase_client.table("entrevistas").delete().eq("id", ent_id).eq("entity_id", entity_id).execute()
    return {"status": "deleted", "id": ent_id}

# ---------- Super‑Admin endpoints (no entity scoping) ----------
@router.get("/admin/dependencias", response_model=List[dict])
async def admin_list_dependencias(user: dict = Depends(get_current_user)):
    from .main import supabase_client
    require_super_admin(user)
    res = supabase_client.table("dependencias").select("*").execute()
    return res.data

@router.get("/admin/series", response_model=List[dict])
async def admin_list_series(user: dict = Depends(get_current_user)):
    from .main import supabase_client
    require_super_admin(user)
    res = supabase_client.table("series").select("*").execute()
    return res.data

# ---------- Generación Documental con LLM ----------

@router.post("/entity/{entity_id}/generate/ccd")
async def generate_ccd(entity_id: str, user: dict = Depends(get_current_user)):
    from .main import supabase_client, llm
    require_entity_admin(user, entity_id)
    
    # 1. Gather all dependencias and funciones
    res_dep = supabase_client.table("dependencias").select("*").eq("entity_id", entity_id).execute()
    res_fun = supabase_client.table("funciones").select("*").eq("entity_id", entity_id).execute()
    
    deps = res_dep.data or []
    funs = res_fun.data or []
    
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
    from .main import supabase_client, llm
    require_entity_admin(user, entity_id)
    
    # Query dependency
    dep_res = supabase_client.table("dependencias").select("*").eq("id", payload.dependencia_id).execute()
    dep_data = dep_res.data[0] if dep_res.data else {}
    
    # Query functions of that dependency
    func_res = supabase_client.table("funciones").select("*").eq("dependencia_id", payload.dependencia_id).execute()
    funciones = func_res.data or []
    
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
    res = supabase_client.table("subseries").select("*").execute()
    return res.data

@router.get("/admin/trd_records", response_model=List[dict])
async def admin_list_trd(user: dict = Depends(get_current_user)):
    require_super_admin(user)
    res = supabase_client.table("trd_records").select("*").execute()
    return res.data

# Additional admin CRUD (create, update, delete) can be added similarly.
