"""
Entity quota enforcement helpers.

Quota fields are stored directly in the ose_entities METADATA record:
  PK  = ENTITY#{entity_id}
  SK  = METADATA
  Fields added:
    quota_enabled        bool   — False means quota is inactive (pass-through)
    quota_type           str    — "storage" | "dependencies" | "both" | "unlimited"
    storage_limit_bytes  int    — maximum bytes allowed for uploaded files
    storage_used_bytes   int    — running counter, updated on upload/delete
    dependency_limit     int    — max dependencies (falls back to maxDependencias)
    dependency_count     int    — running counter, updated on create/delete
    plan_name            str    — display label (e.g. "Standard")

Counter strategy: hybrid.
  - Real-time: counters updated synchronously on every write/delete.
  - Repair:    recalculate_* functions rebuild counters from live DynamoDB records.
"""

from fastapi import HTTPException
from .aws.dynamo_db import db

QUOTA_DEP_EXCEEDED     = "QUOTA_DEPENDENCY_LIMIT_EXCEEDED"
QUOTA_STORAGE_EXCEEDED = "QUOTA_STORAGE_LIMIT_EXCEEDED"


# ── Internal helpers ────────────────────────────────────────────────────────

async def _get_entity(entity_id: str) -> dict:
    return await db.get_item("entities", f"ENTITY#{entity_id}", "METADATA") or {}


def _fmt_bytes(b: int) -> str:
    for unit in ("B", "KB", "MB", "GB"):
        if b < 1024:
            return f"{b:.1f} {unit}"
        b /= 1024
    return f"{b:.1f} TB"


# ── Public check functions (call before write operations) ───────────────────

async def check_dependency_quota(entity_id: str, new_count: int = 1):
    """Raise HTTP 429 if creating `new_count` more dependencies would exceed the limit.
    No-op when quota_enabled is False or quota_type excludes dependencies."""
    entity = await _get_entity(entity_id)
    if not entity.get("quota_enabled"):
        return
    qt = entity.get("quota_type", "unlimited")
    if qt not in ("dependencies", "both"):
        return

    limit = entity.get("dependency_limit") or entity.get("maxDependencias")
    if not limit:
        return

    current = int(entity.get("dependency_count", 0))
    if current + new_count > int(limit):
        raise HTTPException(
            status_code=429,
            detail={
                "code": QUOTA_DEP_EXCEEDED,
                "message": (
                    f"Esta entidad ha alcanzado su límite de {limit} dependencias. "
                    "Elimina dependencias existentes o contacta al administrador para ampliar el plan."
                ),
                "current": current,
                "limit": int(limit),
            },
        )


async def check_storage_quota(entity_id: str, file_size_bytes: int):
    """Raise HTTP 429 if uploading `file_size_bytes` would exceed the storage limit.
    No-op when quota_enabled is False or quota_type excludes storage."""
    entity = await _get_entity(entity_id)
    if not entity.get("quota_enabled"):
        return
    qt = entity.get("quota_type", "unlimited")
    if qt not in ("storage", "both"):
        return

    limit = entity.get("storage_limit_bytes")
    if not limit:
        return

    used = int(entity.get("storage_used_bytes", 0))
    if used + file_size_bytes > int(limit):
        remaining = max(0, int(limit) - used)
        raise HTTPException(
            status_code=429,
            detail={
                "code": QUOTA_STORAGE_EXCEEDED,
                "message": (
                    f"Esta entidad ha alcanzado su límite de almacenamiento. "
                    f"Espacio disponible: {_fmt_bytes(remaining)}. "
                    "Elimina archivos o contacta al administrador para ampliar el plan."
                ),
                "used_bytes": used,
                "limit_bytes": int(limit),
                "file_size_bytes": file_size_bytes,
                "remaining_bytes": remaining,
            },
        )


# ── Counter mutators ────────────────────────────────────────────────────────

async def increment_dependency_count(entity_id: str, delta: int = 1):
    """Add delta to dependency_count (use -1 on delete). Clamps to >= 0."""
    entity = await _get_entity(entity_id)
    current = int(entity.get("dependency_count", 0))
    new_val = max(0, current + delta)
    await db.update_item("entities", f"ENTITY#{entity_id}", "METADATA",
                         {"dependency_count": new_val})


async def increment_storage_used(entity_id: str, delta_bytes: int):
    """Add delta_bytes to storage_used_bytes (use negative value on delete). Clamps to >= 0."""
    entity = await _get_entity(entity_id)
    current = int(entity.get("storage_used_bytes", 0))
    new_val = max(0, current + delta_bytes)
    await db.update_item("entities", f"ENTITY#{entity_id}", "METADATA",
                         {"storage_used_bytes": new_val})


# ── Repair / recalculate ────────────────────────────────────────────────────

async def recalculate_dependency_count(entity_id: str) -> int:
    """Count all active DEP# records and write the corrected value to the entity."""
    items = await db.query_by_entity("dependencias", entity_id, sk_prefix="DEP#")
    count = len(items)
    await db.update_item("entities", f"ENTITY#{entity_id}", "METADATA",
                         {"dependency_count": count})
    return count


async def recalculate_storage_used(entity_id: str) -> int:
    """Sum file_size_bytes from all UPLOAD# records in rag_documents and update entity counter.
    Checks both top-level field and metadata.file_size_bytes for older records."""
    items = await db.query_by_entity("RagDocuments", entity_id, sk_prefix="UPLOAD#")
    total = 0
    for item in items:
        size = item.get("file_size_bytes")
        if not size:
            size = (item.get("metadata") or {}).get("file_size_bytes")
        if size:
            total += int(size)
    await db.update_item("entities", f"ENTITY#{entity_id}", "METADATA",
                         {"storage_used_bytes": total})
    return total


async def get_quota_status(entity_id: str) -> dict:
    """Return a complete quota summary dict for the given entity."""
    entity = await _get_entity(entity_id)
    dep_limit = entity.get("dependency_limit") or entity.get("maxDependencias") or 0
    stor_limit = entity.get("storage_limit_bytes") or 0
    dep_count  = int(entity.get("dependency_count", 0))
    stor_used  = int(entity.get("storage_used_bytes", 0))

    dep_pct  = round(dep_count  / dep_limit  * 100, 1) if dep_limit  else 0
    stor_pct = round(stor_used  / stor_limit * 100, 1) if stor_limit else 0

    return {
        "entity_id":             entity_id,
        "quota_enabled":         entity.get("quota_enabled", False),
        "quota_type":            entity.get("quota_type", "unlimited"),
        "plan_name":             entity.get("plan_name", "Free"),
        "dependency_limit":      dep_limit,
        "dependency_count":      dep_count,
        "dependency_pct":        dep_pct,
        "dependency_remaining":  max(0, int(dep_limit) - dep_count) if dep_limit else None,
        "storage_limit_bytes":   stor_limit,
        "storage_used_bytes":    stor_used,
        "storage_pct":           stor_pct,
        "storage_remaining_bytes": max(0, int(stor_limit) - stor_used) if stor_limit else None,
        "storage_limit_fmt":     _fmt_bytes(stor_limit) if stor_limit else "Sin límite",
        "storage_used_fmt":      _fmt_bytes(stor_used),
    }
