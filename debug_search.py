import os
from dotenv import load_dotenv
from langchain_openai import OpenAIEmbeddings
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
embeddings = OpenAIEmbeddings(
    model="text-embedding-3-small",
    openai_api_key=OPENROUTER_API_KEY,
    openai_api_base="https://openrouter.ai/api/v1"
)

def test_search():
    print("📊 Verificando estado de la tabla...")
    count_res = supabase.table("rag_documents").select("id", count="exact").limit(1).execute()
    print(f"✅ Total filas en DB: {count_res.count}")
    
    if count_res.count > 0:
        first_row = supabase.table("rag_documents").select("embedding").limit(1).execute()
        # El formato de embedding puede variar según el cliente, lo limpiamos
        emb = first_row.data[0]['embedding']
        if isinstance(emb, str):
            # Si viene como string "[0.1, 0.2...]"
            dim = len(emb.strip("[]").split(","))
        else:
            dim = len(emb)
        print(f"📏 Dimensiones reales en DB: {dim}")

        print("\n🔍 Probando búsqueda...")
        query_vector = embeddings.embed_query("TRD")
        res = supabase.rpc("match_rag_documents", {
            "query_embedding": query_vector,
            "match_count": 5
        }).execute()
        print(f"📊 Resultados RPC encontrados: {len(res.data)}")
    else:
        print("❌ La tabla está VACÍA.")

if __name__ == "__main__":
    test_search()
