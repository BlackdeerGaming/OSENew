import os
from dotenv import load_dotenv

from langchain_openai import OpenAIEmbeddings, ChatOpenAI

# Critical: load env vars first
load_dotenv()

# Environment Variables

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "google/gemini-2.0-flash-001")

# Initialize DynamoDB Client
from .aws.dynamo_db import db

print(" [DB] DynamoDB configurado para arquitectura serverless.")

# Initialize LLM (OpenRouter)
llm = None
if OPENROUTER_API_KEY:
    try:
        llm = ChatOpenAI(
            model=OPENROUTER_MODEL,
            openai_api_key=OPENROUTER_API_KEY,
            openai_api_base="https://openrouter.ai/api/v1",
            temperature=0.1,
            max_tokens=4096,
            request_timeout=65,
            default_headers={
                "HTTP-Referer": "https://ose-ia.vercel.app",
                "X-Title": "OSE Copilot Context"
            }
        )
        print(f" [DB] LLM ({OPENROUTER_MODEL}) listo.")
    except Exception as e:
        print(f" [DB] Error inicializando LLM: {e}")

# Initialize Embeddings
embeddings = None
if OPENROUTER_API_KEY:
    try:
        # Nota: OpenRouter soporta text-embedding-3-small si se redirige correctamente.
        # En algunos entornos, es mejor usar la URL directa si falla la est\u00e1ndar.
        embeddings = OpenAIEmbeddings(
            model="text-embedding-3-small",
            openai_api_key=OPENROUTER_API_KEY,
            openai_api_base="https://openrouter.ai/api/v1",
            check_embedding_ctx_length=False # OpenRouter puede no retornar esto
        )
        print(" [DB] Embeddings (OpenRouter: text-embedding-3-small) listo.")
    except Exception as e:
        print(f" [DB] Error inicializando embeddings: {e}")
        embeddings = None
