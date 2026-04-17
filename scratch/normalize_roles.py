import os
import sys
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_KEY")

if not url or not key:
    print("Error: SUPABASE_URL or SUPABASE_SERVICE_KEY not found in environment")
    sys.exit(1)

supabase: Client = create_client(url, key)

def normalize_roles():
    print("--- Normalizando roles en la base de datos ---")
    
    # 1. Administrador -> administrador
    print("Actualizando 'Administrador' -> 'administrador'...")
    res = supabase.table("profiles").update({"perfil": "administrador"}).eq("perfil", "Administrador").execute()
    print(f"Hecho. Registros afectados: {len(res.data)}")
    
    # 2. Consulta -> usuario
    print("Actualizando 'Consulta' -> 'usuario'...")
    res = supabase.table("profiles").update({"perfil": "usuario"}).eq("perfil", "Consulta").execute()
    print(f"Hecho. Registros afectados: {len(res.data)}")
    
    # 3. superadmin -> superadmin (asegurar consistencia si hubiera variaciones)
    # Por ahora ya es el estándar usado.
    
    print("--- Proceso completado con éxito ---")

if __name__ == "__main__":
    normalize_roles()
