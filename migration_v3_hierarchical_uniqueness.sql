-- ============================================================
-- MIGRACIÓN: RESTRICCIONES DE UNICIDAD JERÁRQUICA (v3)
-- Objetivo: Permitir códigos duplicados en diferentes niveles jerárquicos.
-- ============================================================

-- 1. CORRECCIÓN EN DEPENDENCIAS
-- El código de dependencia debe ser único POR ENTIDAD, no global.
ALTER TABLE dependencias DROP CONSTRAINT IF EXISTS dependencias_codigo_key;
ALTER TABLE dependencias ADD CONSTRAINT dependencias_codigo_entity_unique UNIQUE (codigo, entity_id);

-- 2. RESTRICCIONES EN SERIES
-- El código de serie es único POR DEPENDENCIA.
-- Esto permite que el mismo código (ej. '100') exista en diferentes oficinas.
ALTER TABLE series DROP CONSTRAINT IF EXISTS series_codigo_key; -- Por si existía
ALTER TABLE series ADD CONSTRAINT series_codigo_dependency_unique UNIQUE (codigo, dependencia_id);

-- 3. RESTRICCIONES EN SUBSERIES
-- El código de subserie es único POR SERIE y DEPENDENCIA.
ALTER TABLE subseries DROP CONSTRAINT IF EXISTS subseries_codigo_key;
ALTER TABLE subseries ADD CONSTRAINT subseries_codigo_hierarchy_unique UNIQUE (codigo, serie_id, dependencia_id);

-- 4. ÍNDICES PARA OPTIMIZACIÓN
CREATE INDEX IF NOT EXISTS idx_dependencias_hierarchical ON dependencias(codigo, entity_id);
CREATE INDEX IF NOT EXISTS idx_series_hierarchical ON series(codigo, dependencia_id);
CREATE INDEX IF NOT EXISTS idx_subseries_hierarchical ON subseries(codigo, serie_id, dependencia_id);
