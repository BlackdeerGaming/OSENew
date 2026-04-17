import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_KEY")
supabase: Client = create_client(url, key)

print("--- Data Check ---")
print("1. Checking Entity e0:")
ent = supabase.table("entities").select("*").eq("id", "e0").execute()
print(f"Entity e0 exists? {bool(ent.data)}")

print("\n2. Checking if profile_entities table works:")
try:
    pe = supabase.table("profile_entities").select("*").limit(1).execute()
    print(f"profile_entities works. Rows: {len(pe.data)}")
except Exception as e:
    print(f"profile_entities ERROR: {e}")

print("\n3. Checking for username conflicts:")
email = "ivandchaves@gmail.com"
username = email.split('@')[0]
un = supabase.table("profiles").select("email").eq("username", username).execute()
if un.data:
    print(f"Conflict: Username '{username}' is already taken by {un.data[0]['email']}")
else:
    print(f"Username '{username}' is available.")
