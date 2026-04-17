import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_KEY")
supabase: Client = create_client(url, key)

email = "ivandchaves@gmail.com"
res = supabase.table("profiles").select("*").eq("email", email).execute()

if res.data:
    user = res.data[0]
    print(f"User found: {user['email']}")
    print(f"Role (perfil): {user['perfil']}")
    print(f"ID: {user['id']}")
else:
    print(f"User {email} not found in profiles table.")

# Check SUPERADMIN_EMAILS in environment
raw_emails = os.environ.get("SUPERADMIN_EMAILS", "")
print(f"SUPERADMIN_EMAILS in env: '{raw_emails}'")
parsed = [e.strip().lower() for e in raw_emails.split(",") if e.strip()]
print(f"Parsed whitelist: {parsed}")
print(f"Match found? {email.lower() in parsed}")
