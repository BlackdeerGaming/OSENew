import os
import time
from datetime import datetime
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_KEY")
supabase: Client = create_client(url, key)

email = "ivandchaves@gmail.com"
nombre = "Ivan"
apellido = "Chaves"
SUPERADMIN_EMAILS = ["superadmin@ose.com", "ivandchaves@gmail.com"]
SUPERADMIN_ROLE = "superadmin"
DEFAULT_ROLE = "usuario"

print(f"--- SIMULANDO GOOGLE_AUTH PARA {email} ---")

try:
    # 1. Check if exists
    res = supabase.table("profiles").select("*").eq("email", email).execute()
    if res.data:
        print(f"User already exists. Skipping insert. Role: {res.data[0]['perfil']}")
    else:
        # 2. Create
        print("User doesn't exist. Creating...")
        initial_role = DEFAULT_ROLE
        if email.lower() in [e.lower() for e in SUPERADMIN_EMAILS]:
            initial_role = SUPERADMIN_ROLE
            
        username = email.split('@')[0]
        payload = {
            "nombre": nombre,
            "apellido": apellido,
            "email": email,
            "username": username,
            "perfil": initial_role,
            "estado": "Activo",
            "is_activated": True,
            "entidad_id": "e0",
            "created_at": datetime.now().isoformat()
        }
        
        print(f"Payload: {payload}")
        ins = supabase.table("profiles").insert(payload).execute()
        print(f"Profiles Insert: {'SUCCESS' if ins.data else 'FAILED'}")
        
        if ins.data:
            user_id = ins.data[0]['id']
            print(f"New User ID: {user_id}")
            # 3. Entity link
            pe = supabase.table("profile_entities").insert({
                "profile_id": user_id,
                "entity_id": "e0"
            }).execute()
            print(f"Profile Entities Insert: {'SUCCESS' if pe.data else 'FAILED'}")

except Exception as e:
    print(f"EXCEPTION: {e}")
