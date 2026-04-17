-- SQL Migration: Crear tabla de invitaciones

CREATE TABLE IF NOT EXISTS invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    entity_id TEXT REFERENCES entities(id) ON DELETE CASCADE,
    inviter_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'pendiente', -- 'pendiente', 'aceptada', 'rechazada', 'vencida'
    created_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    token TEXT,
    
    -- Restricción para evitar invitaciones duplicadas pendientes para el mismo email en la misma entidad
    CONSTRAINT unique_pending_invitation UNIQUE (email, entity_id, status)
);

-- Habilitar RLS
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- Política simple para permitir acceso total al service role (backend)
CREATE POLICY "allow_all_service" ON invitations FOR ALL USING (true);

-- Índices para búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_entity_id ON invitations(entity_id);
