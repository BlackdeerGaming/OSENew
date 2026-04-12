import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
c = create_client(os.environ['SUPABASE_URL'], os.environ['SUPABASE_SERVICE_KEY'])
try:
    c.table('rag_documents').delete().gt('created_at', '1900-01-01').execute()
    print("Documents cleared")
except Exception as e:
    print(e)
    
try:
    c.storage.create_bucket('rag-uploads', options={'public': True})
    print("Bucket created")
except Exception as e:
    print("Bucket created or error:", e)
