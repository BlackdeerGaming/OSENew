# -*- coding: utf-8 -*-
"""
Script para:
1. Verificar la columna ia_disponible en la tabla profiles de Supabase
2. Crear los usuarios Carlos Chaves y Hector Chaves con IA habilitada
"""
import os, sys, httpx
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("ERROR: SUPABASE_URL o SUPABASE_KEY no encontradas en .env")
    sys.exit(1)

headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

def sb_get(table, params=""):
    r = httpx.get(f"{SUPABASE_URL}/rest/v1/{table}?{params}", headers=headers)
    r.raise_for_status()
    return r.json()

def sb_post(table, data):
    r = httpx.post(f"{SUPABASE_URL}/rest/v1/{table}", headers=headers, json=data)
    r.raise_for_status()
    return r.json()

def sb_patch(table, col, val, data):
    r = httpx.patch(f"{SUPABASE_URL}/rest/v1/{table}?{col}=eq.{val}", headers=headers, json=data)
    r.raise_for_status()
    return r.json()

# ── PASO 1: Verificar columna ──────────────────────────────────────────
print("\n[1] Verificando columna ia_disponible...")
try:
    sb_get("profiles", "select=ia_disponible&limit=1")
    print("    OK - Columna existe.")
except Exception as e:
    print(f"    FALTA - Columna no encontrada.")
    print("    --> Ejecuta en Supabase SQL Editor:")
    print("        ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ia_disponible BOOLEAN DEFAULT FALSE;")
    sys.exit(1)

# ── PASO 2: Buscar DANE ────────────────────────────────────────────────
print("\n[2] Buscando entidad DANE...")
entities = sb_get("entities", "razon_social=ilike.*DANE*&select=id,razon_social")
if not entities:
    print("    ERROR - No se encontro entidad DANE.")
    sys.exit(1)
dane = entities[0]
print(f"    OK - {dane['razon_social']} (id={dane['id']})")

# ── PASO 3: Crear usuarios ─────────────────────────────────────────────
usuarios = [
    {"nombre":"Carlos","apellido":"Chaves","email":"carloschaves56@gmail.com",
     "username":"carloschaves56","perfil":"admin","estado":"Activo",
     "entidad_id":dane["id"],"is_activated":True,"ia_disponible":True},
    {"nombre":"Hector","apellido":"Chaves","email":"chaveshector41@gmail.com",
     "username":"chaveshector41","perfil":"user","estado":"Activo",
     "entidad_id":dane["id"],"is_activated":True,"ia_disponible":True},
]

print("\n[3] Creando/actualizando usuarios...")
for u in usuarios:
    existing = sb_get("profiles", f"email=eq.{u['email']}&select=id,email")
    if existing:
        uid = existing[0]["id"]
        sb_patch("profiles", "email", u["email"], {"ia_disponible":True,"is_activated":True,"estado":"Activo"})
        print(f"    WARN - Ya existia -> actualizado: {u['email']}")
    else:
        result = sb_post("profiles", u)
        uid = result[0]["id"] if isinstance(result, list) else result["id"]
        sb_post("profile_entities", {"profile_id": uid, "entity_id": dane["id"]})
        print(f"    OK - Creado: {u['nombre']} {u['apellido']} ({u['email']}) id={uid}")

print("\nProceso completado.\n")
