-- ============================================================
-- OSE IA - Script de Configuración Supabase
-- Ejecutar en: Supabase > SQL Editor > New Query
-- ============================================================

-- 1. Habilitar extensión pgvector (para RAG)
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- 2. TABLAS DE ESTRUCTURA TRD
-- ============================================================

CREATE TABLE IF NOT EXISTS dependencias (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  nombre TEXT NOT NULL,
  sigla TEXT,
  codigo TEXT UNIQUE NOT NULL,
  pais TEXT DEFAULT 'Colombia',
  departamento TEXT,
  ciudad TEXT,
  direccion TEXT,
  telefono TEXT,
  depende_de TEXT REFERENCES dependencias(id) ON DELETE SET NULL,
  entity_id TEXT REFERENCES entities(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS series (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  nombre TEXT NOT NULL,
  codigo TEXT NOT NULL,
  tipo_documental TEXT,
  descripcion TEXT,
  dependencia_id TEXT NOT NULL REFERENCES dependencias(id) ON DELETE CASCADE,
  entity_id TEXT REFERENCES entities(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subseries (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  nombre TEXT NOT NULL,
  codigo TEXT NOT NULL,
  tipo_documental TEXT,
  descripcion TEXT,
  serie_id TEXT NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  dependencia_id TEXT REFERENCES dependencias(id) ON DELETE CASCADE,
  entity_id TEXT REFERENCES entities(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS trd_records (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  dependencia_id TEXT REFERENCES dependencias(id) ON DELETE CASCADE,
  serie_id TEXT REFERENCES series(id) ON DELETE CASCADE,
  subserie_id TEXT REFERENCES subseries(id) ON DELETE SET NULL,
  entity_id TEXT REFERENCES entities(id) ON DELETE CASCADE,
  estado_conservacion TEXT,
  retenci_gestion INTEGER,
  retenci_central INTEGER,
  ddhh TEXT,
  procedimiento TEXT,
  acto_admo TEXT,
  -- Flags de disposicion
  disp_conservacion_total BOOLEAN DEFAULT false,
  disp_eliminacion BOOLEAN DEFAULT false,
  disp_seleccion BOOLEAN DEFAULT false,
  -- Flags de ordenacion
  ord_alfabetica BOOLEAN DEFAULT false,
  ord_cronologica BOOLEAN DEFAULT false,
  ord_numerica BOOLEAN DEFAULT false,
  ord_otra BOOLEAN DEFAULT false,
  -- Flags de valor
  val_administrativo BOOLEAN DEFAULT false,
  val_tecnico BOOLEAN DEFAULT false,
  val_contable BOOLEAN DEFAULT false,
  val_fiscal BOOLEAN DEFAULT false,
  val_legal BOOLEAN DEFAULT false,
  val_historico BOOLEAN DEFAULT false,
  -- Flags de reproduccion
  rep_microfilmacion BOOLEAN DEFAULT false,
  rep_digitalizacion BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 3. TABLA RAG (Vector Store - reemplaza Pinecone)
-- ============================================================

CREATE TABLE IF NOT EXISTS rag_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  embedding vector(1536),  -- OpenAI text-embedding-3-small nativo (1536)
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índice para búsqueda vectorial rápida por similitud coseno
-- 2. Crear el nuevo índice HNSW (Más rápido y preciso)
CREATE INDEX IF NOT EXISTS rag_documents_embedding_hnsw_idx 
ON rag_documents USING hnsw (embedding vector_cosine_ops);

-- ============================================================
-- 4. FUNCIÓN DE BÚSQUEDA VECTORIAL (para el backend Python)
-- ============================================================

CREATE OR REPLACE FUNCTION match_rag_documents(
  query_embedding vector(1536),
  match_count INT DEFAULT 5,
  filter JSONB DEFAULT '{}'
)
RETURNS TABLE (
  id uuid,
  content TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    rag_documents.id,
    rag_documents.content,
    rag_documents.metadata,
    1 - (rag_documents.embedding <=> query_embedding) AS similarity
  FROM rag_documents
  WHERE (filter = '{}' OR rag_documents.metadata @> filter)
  ORDER BY rag_documents.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ============================================================
-- 5. ROW LEVEL SECURITY (RLS) - Acceso público de lectura
-- ============================================================

ALTER TABLE dependencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE series ENABLE ROW LEVEL SECURITY;
ALTER TABLE subseries ENABLE ROW LEVEL SECURITY;
ALTER TABLE trd_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag_documents ENABLE ROW LEVEL SECURITY;

-- Políticas: permitir todo al service_role (backend Python)
-- y lectura al anon (frontend directo)
CREATE POLICY "allow_all_service" ON dependencias FOR ALL USING (true);
CREATE POLICY "allow_all_service" ON series FOR ALL USING (true);
CREATE POLICY "allow_all_service" ON subseries FOR ALL USING (true);
CREATE POLICY "allow_all_service" ON trd_records FOR ALL USING (true);
CREATE POLICY "allow_all_service" ON rag_documents FOR ALL USING (true);

-- ============================================================
-- ✅ LISTO. Verifica en Table Editor que aparecen las 5 tablas.
-- ============================================================
-- Migration to add cloud_key columns for TRD modules
ALTER TABLE dependencias ADD COLUMN IF NOT EXISTS cloud_key TEXT;
ALTER TABLE series ADD COLUMN IF NOT EXISTS cloud_key TEXT;
ALTER TABLE subseries ADD COLUMN IF NOT EXISTS cloud_key TEXT;
ALTER TABLE trd_records ADD COLUMN IF NOT EXISTS cloud_key TEXT;

-- Migration to add entity_id for multi-tenant support
ALTER TABLE dependencias ADD COLUMN IF NOT EXISTS entity_id TEXT REFERENCES entities(id) ON DELETE CASCADE;
ALTER TABLE series ADD COLUMN IF NOT EXISTS entity_id TEXT REFERENCES entities(id) ON DELETE CASCADE;
ALTER TABLE subseries ADD COLUMN IF NOT EXISTS entity_id TEXT REFERENCES entities(id) ON DELETE CASCADE;
ALTER TABLE trd_records ADD COLUMN IF NOT EXISTS entity_id TEXT REFERENCES entities(id) ON DELETE CASCADE;

-- Optional: create index for faster lookup
CREATE INDEX IF NOT EXISTS idx_dependencias_cloud_key ON dependencias(cloud_key);
CREATE INDEX IF NOT EXISTS idx_series_cloud_key ON series(cloud_key);
CREATE INDEX IF NOT EXISTS idx_subseries_cloud_key ON subseries(cloud_key);
CREATE INDEX IF NOT EXISTS idx_trd_records_cloud_key ON trd_records(cloud_key);

-- Index for entity_id lookups
CREATE INDEX IF NOT EXISTS idx_dependencias_entity ON dependencias(entity_id);
CREATE INDEX IF NOT EXISTS idx_series_entity ON series(entity_id);
CREATE INDEX IF NOT EXISTS idx_subseries_entity ON subseries(entity_id);
CREATE INDEX IF NOT EXISTS idx_trd_records_entity ON trd_records(entity_id);

-- ============================================================
-- 6. TABLA DE HISTORIAL DE CHAT (Persistencia Privada)
-- ============================================================

CREATE TABLE IF NOT EXISTS chat_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assistant TEXT NOT NULL, -- 'orianna' o 'documencio'
  messages JSONB DEFAULT '[]',
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, assistant)
);

ALTER TABLE chat_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_service" ON chat_history FOR ALL USING (true);

