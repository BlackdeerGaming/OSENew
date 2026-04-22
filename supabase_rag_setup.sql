-- 1. Habilitar extensi\u00f3n pgvector
create extension if not exists vector;

-- 2. Crear tabla para los fragmentos de documentos (si no existe)
create table if not exists rag_documents (
  id uuid primary key default gen_random_uuid(),
  content text,
  metadata jsonb,
  embedding vector(1536), -- Para OpenAI text-embedding-3-small
  created_at timestamp with time zone default now()
);

-- 3. Crear \u00edndice para b\u00fasqueda de proximidad (Opcional pero recomendado)
create index if not exists idx_rag_documents_embedding on rag_documents using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- 4. Funci\u00f3n RPC para b\u00fasqueda vectorial (ESENCIAL PARA EL CHAT)
create or replace function match_rag_documents (
  query_embedding vector(1536),
  match_count int DEFAULT 5,
  filter jsonb DEFAULT '{}'
) returns table (
  id uuid,
  content text,
  metadata jsonb,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    rag_documents.id,
    rag_documents.content,
    rag_documents.metadata,
    1 - (rag_documents.embedding <=> query_embedding) as similarity
  from rag_documents
  where (filter = '{}' or rag_documents.metadata @> filter)
  order by rag_documents.embedding <=> query_embedding
  limit match_count;
end;
$$;
