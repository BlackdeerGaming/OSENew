import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

def debug_rag():
    if not (SUPABASE_URL and SUPABASE_SERVICE_KEY):
        print("Missing Supabase credentials")
        return
    
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    
    # Check document metadata
    res = supabase.table("rag_documents").select("id, metadata").limit(5).execute()
    print(f"Total docs sample: {len(res.data)}")
    for doc in res.data:
        print(f"ID: {doc['id']} | Metadata: {doc['metadata']}")

if __name__ == "__main__":
    debug_rag()
