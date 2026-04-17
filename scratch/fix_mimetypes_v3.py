import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv(os.path.join(os.getcwd(), ".env"))

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

def fix_content_types_v3():
    if not (SUPABASE_URL and SUPABASE_SERVICE_KEY):
        print("Missing credentials")
        return
    
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    
    bucket_name = "trd-uploads"
    files = supabase.storage.from_(bucket_name).list()
    
    for f in files:
        name = f['name']
        if name.lower().endswith('.pdf'):
            print(f"Upserting {name}...")
            try:
                data = supabase.storage.from_(bucket_name).download(name)
                # properly remove using a list
                supabase.storage.from_(bucket_name).remove([name])
                # upload with content-type
                res = supabase.storage.from_(bucket_name).upload(
                    name, 
                    data, 
                    file_options={"content-type": "application/pdf", "upsert": "true"}
                )
                print(f"  Status code: {res.status_code}")
                # check header
                busted_url = f"{supabase.storage.from_(bucket_name).get_public_url(name)}?t={os.urandom(4).hex()}"
                import httpx
                h = httpx.head(busted_url).headers.get('content-type')
                print(f"  New Header: {h}")
            except Exception as e:
                print(f"  Error: {e}")

if __name__ == "__main__":
    fix_content_types_v3()
