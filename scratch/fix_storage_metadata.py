import os
import sys
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv(os.path.join(os.getcwd(), ".env"))

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

def fix_content_types():
    print("Starting fix_content_types...")
    sys.stdout.flush()
    
    if not (SUPABASE_URL and SUPABASE_SERVICE_KEY):
        print("Missing credentials")
        return
    
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    bucket = "trd-uploads"
    
    try:
        print(f"Listing files in {bucket}...")
        sys.stdout.flush()
        res = supabase.storage.from_(bucket).list()
        print(f"Found {len(res)} files.")
        sys.stdout.flush()
        
        for f in res:
            name = f['name']
            if name.lower().endswith('.pdf'):
                print(f"Processing: {name}")
                sys.stdout.flush()
                try:
                    content = supabase.storage.from_(bucket).download(name)
                    supabase.storage.from_(bucket).update(name, content, {"content-type": "application/pdf"})
                    print(f"DONE: {name}")
                    sys.stdout.flush()
                except Exception as ex:
                    print(f"Error processing {name}: {ex}")
                    sys.stdout.flush()
    except Exception as e:
        print(f"Fatal error: {e}")
        sys.stdout.flush()

if __name__ == "__main__":
    fix_content_types()
