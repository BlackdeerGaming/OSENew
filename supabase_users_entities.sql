-- ============================================================
-- OSE IA - Esquema de Usuarios y Entidades
-- ============================================================

-- 1. TABLA DE ENTIDADES (Empresas/Organizaciones)
CREATE TABLE IF NOT EXISTS entities (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  razon_social TEXT NOT NULL,
  nit TEXT UNIQUE NOT NULL,
  email TEXT,
  telefono TEXT,
  pais TEXT DEFAULT 'Colombia',
  departamento TEXT,
  ciudad TEXT,
  sigla TEXT,
  direccion TEXT,
  -- SaaS Config
  max_usuarios INTEGER DEFAULT 10,
  max_dependencias INTEGER DEFAULT 20,
  estado TEXT DEFAULT 'Activo',
  ciiu TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. TABLA DE PERFILES DE USUARIO
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  nombre TEXT NOT NULL,
  apellido TEXT,
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  perfil TEXT NOT NULL, -- 'superadmin', 'Administrador', 'Consulta'
  estado TEXT DEFAULT 'Inactivo',
  is_activated BOOLEAN DEFAULT false,
  entidad_id TEXT REFERENCES entities(id) ON DELETE SET NULL,
  password TEXT, -- Temporal (Idealmente usar Supabase Auth)
  activation_token TEXT,
  token_expiry BIGINT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Habilitar RLS
ALTER TABLE entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 4. POLÍTICAS (Dejar acceso libre al backend service role por ahora)
CREATE POLICY "allow_all_service" ON entities FOR ALL USING (true);
CREATE POLICY "allow_all_service" ON profiles FOR ALL USING (true);

-- 5. Insertar Entidad por defecto si no existe
INSERT INTO entities (id, razon_social, nit, sigla)
VALUES ('e0', 'OSE Sistema Global', '000000000', 'OSE')
ON CONFLICT (id) DO NOTHING;

-- 6. Insertar Super Admin por defecto
INSERT INTO profiles (id, nombre, apellido, email, username, perfil, estado, is_activated, password, entidad_id)
VALUES ('u0', 'Super', 'Admin', 'superadmin@ose.com', 'superadmin', 'superadmin', 'Activo', true, 'admin', 'e0')
ON CONFLICT (id) DO NOTHING;
