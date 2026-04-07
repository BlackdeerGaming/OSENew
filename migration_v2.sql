-- ============================================================
-- OSE IA - Migración V2: Asociación de Entidades y Multientidad
-- ============================================================

-- 1. Añadir columna entidad_id a tablas TRD
ALTER TABLE dependencias ADD COLUMN IF NOT EXISTS entidad_id TEXT REFERENCES entities(id);
ALTER TABLE series ADD COLUMN IF NOT EXISTS entidad_id TEXT REFERENCES entities(id);
ALTER TABLE subseries ADD COLUMN IF NOT EXISTS entidad_id TEXT REFERENCES entities(id);
ALTER TABLE trd_records ADD COLUMN IF NOT EXISTS entidad_id TEXT REFERENCES entities(id);

-- 2. Crear tabla de unión para Usuarios y Entidades (Muchos a Muchos)
CREATE TABLE IF NOT EXISTS profile_entities (
  profile_id TEXT REFERENCES profiles(id) ON DELETE CASCADE,
  entity_id TEXT REFERENCES entities(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (profile_id, entity_id)
);

-- 3. Migrar datos existentes de profiles.entidad_id a profile_entities
INSERT INTO profile_entities (profile_id, entity_id)
SELECT id, entidad_id FROM profiles
WHERE entidad_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 4. Habilitar RLS para la nueva tabla
ALTER TABLE profile_entities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_service" ON profile_entities FOR ALL USING (true);
