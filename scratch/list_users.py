import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_KEY")
supabase: Client = create_client(url, key)

print("Listing first 5 users in profiles:")
res = supabase.table("profiles").select("email, perfil").limit(5).execute()
for u in res.data:
    print(f"- {u['email']} (Role: {u['perfil']})")

print("\nListing SUPERADMIN_EMAILS:")
raw_emails = os.environ.get("SUPERADMIN_EMAILS", "")
print(f"Raw: '{raw_emails}'")
parsed = [e.strip().lower() for e in raw_emails.split(",") if e.strip()]
print(f"Parsed: {parsed}")
