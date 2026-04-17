import os
from supabase import create_client, Client
from dotenv import load_dotenv
from langchain_openai import OpenAIEmbeddings

# Use absolute path for .env
load_dotenv(os.path.join(os.getcwd(), ".env"))

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

def test_search():
    if not (SUPABASE_URL and SUPABASE_SERVICE_KEY and OPENROUTER_API_KEY):
        print("Missing credentials")
        return
    
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    embeddings = OpenAIEmbeddings(
        model="text-embedding-3-small",
        openai_api_key=OPENROUTER_API_KEY,
        openai_api_base="https://openrouter.ai/api/v1"
    )
    
    query = "Que hace el DANE?"
    vector = embeddings.embed_query(query)
    
    res = supabase.rpc("match_rag_documents", {
        "query_embedding": vector,
        "match_count": 5,
        "filter": {}
    }).execute()
    
    print(f"Items found in RPC: {len(res.data)}")
    for i, row in enumerate(res.data):
        meta = row['metadata']
        status = meta.get('status')
        print(f"[{i}] Status: {status} | Entidad: {meta.get('entidad_id')} | Snippet: {row['content'][:50]}...")

if __name__ == "__main__":
    test_search()
