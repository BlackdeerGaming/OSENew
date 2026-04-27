import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv(".env")
url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_KEY")

supabase: Client = create_client(url, key)

try:
    # We fetch a single record just to see its keys (columns)
    res = supabase.table("entities").select("*").limit(1).execute()
    if res.data:
        columns = list(res.data[0].keys())
        print(f"Columnas detectadas en Supabase: {columns}")
        
        missing = []
        for col in ['ciiu', 'clasificacion', 'pais', 'departamento']:
            if col not in columns:
                missing.append(col)
        
        print(f"Faltan en DB: {missing}")
    else:
        print("La tabla no tiene registros, no podemos inferir columnas vía query rest. Necesitamos verificar el esquema directamente.")
except Exception as e:
    print(f"Error checking db: {e}")
