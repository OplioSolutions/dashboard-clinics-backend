-- Initial schema for Dashboard Clinics AI (multi-tenant)
-- Enums
CREATE TYPE company_status AS ENUM ('active', 'inactive');
CREATE TYPE user_role AS ENUM ('admin', 'staff');
CREATE TYPE user_status AS ENUM ('active', 'inactive');
CREATE TYPE appointment_status AS ENUM ('scheduled', 'confirmed', 'completed', 'cancelled');
CREATE TYPE interaction_channel AS ENUM ('whatsapp', 'email', 'sms');
CREATE TYPE interaction_direction AS ENUM ('inbound', 'outbound');
CREATE TYPE interaction_status AS ENUM ('sent', 'delivered', 'read', 'failed');
CREATE TYPE engagement_level AS ENUM ('high', 'medium', 'low');
CREATE TYPE payment_status_company AS ENUM ('active', 'pending', 'overdue');
CREATE TYPE payment_method AS ENUM ('credit_card', 'debit_card', 'cash', 'pix', 'bank_transfer', 'other');
CREATE TYPE payment_status_transaction AS ENUM ('paid', 'pending', 'refunded', 'failed');
CREATE TYPE conversation_status AS ENUM ('active', 'closed');
CREATE TYPE assignment_status AS ENUM ('unassigned', 'assigned', 'in_progress', 'resolved');

-- Tables
CREATE TABLE IF NOT EXISTS companies (
    id SERIAL PRIMARY KEY,
    name VARCHAR NOT NULL,
    owner_name VARCHAR NOT NULL,
    email VARCHAR UNIQUE NOT NULL,
    phone VARCHAR,
    address TEXT,
    logo_url VARCHAR,
    status company_status NOT NULL DEFAULT 'active',
    cnpj VARCHAR UNIQUE NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    auth_user_id UUID UNIQUE, -- Link to auth.users(id)
    name VARCHAR NOT NULL,
    email VARCHAR UNIQUE NOT NULL,
    password_hash VARCHAR NOT NULL,
    role user_role NOT NULL,
    status user_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clients (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    full_name VARCHAR NOT NULL,
    phone VARCHAR,
    email VARCHAR,
    birth_date DATE,
    notes TEXT,
    cpf VARCHAR UNIQUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS services (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    duration_minutes INTEGER NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS appointments (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    title VARCHAR NOT NULL,
    description TEXT,
    date DATE NOT NULL,
    time TIME NOT NULL,
    status appointment_status NOT NULL DEFAULT 'scheduled',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conversation_threads (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    started_at TIMESTAMP NOT NULL,
    ended_at TIMESTAMP,
    channels_used JSON NOT NULL,
    context_summary TEXT,
    status conversation_status NOT NULL DEFAULT 'active',
    assigned_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    assignment_status assignment_status NOT NULL DEFAULT 'unassigned',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS interactions (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    conversation_id INTEGER NOT NULL REFERENCES conversation_threads(id) ON DELETE CASCADE,
    channel interaction_channel NOT NULL,
    direction interaction_direction NOT NULL,
    message TEXT NOT NULL,
    status interaction_status NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS insights (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    risk_score INTEGER NOT NULL,
    engagement_level engagement_level NOT NULL,
    summary TEXT NOT NULL,
    recommendations TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    appointment_id INTEGER REFERENCES appointments(id) ON DELETE SET NULL,
    amount DECIMAL(10, 2) NOT NULL,
    payment_date TIMESTAMP NOT NULL DEFAULT NOW(),
    payment_method payment_method NOT NULL,
    status payment_status_transaction NOT NULL DEFAULT 'pending',
    transaction_id VARCHAR UNIQUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS settings (
    id SERIAL PRIMARY KEY,
    company_id INTEGER UNIQUE NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    working_hours JSONB NOT NULL,
    contact_email VARCHAR,
    contact_phone VARCHAR,
    support_ticket_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    payment_status payment_status_company NOT NULL DEFAULT 'active',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_context_snapshots (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    last_updated TIMESTAMP NOT NULL,
    summary TEXT NOT NULL,
    important_flags JSON,
    source_conversation_id INTEGER REFERENCES conversation_threads(id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- RLS: Enable on all tables
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_context_snapshots ENABLE ROW LEVEL SECURITY;

-- Helper: tenancy condition by company_id
-- Policy template (expanded per table):
-- EXISTS (
--   SELECT 1 FROM public.users u
--   WHERE u.auth_user_id = (SELECT auth.uid()) AND u.company_id = <table>.company_id
-- )

-- Companies: match by (companies.id)
CREATE POLICY companies_select_tenant ON companies FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.users u WHERE u.auth_user_id = (SELECT auth.uid()) AND u.company_id = companies.id
  )
);
CREATE POLICY companies_update_tenant ON companies FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.users u WHERE u.auth_user_id = (SELECT auth.uid()) AND u.company_id = companies.id
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users u WHERE u.auth_user_id = (SELECT auth.uid()) AND u.company_id = companies.id
  )
);
CREATE POLICY companies_delete_tenant ON companies FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.users u WHERE u.auth_user_id = (SELECT auth.uid()) AND u.company_id = companies.id
  )
);
-- Note: Não é seguro criar política de INSERT em companies baseada no NEW.id sem gatilhos; inserir empresas deve ser privilégio controlado no backend.

-- Users
CREATE POLICY users_select_tenant ON users FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.users u WHERE u.auth_user_id = (SELECT auth.uid()) AND u.company_id = users.company_id
  )
);
CREATE POLICY users_update_tenant ON users FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.users u WHERE u.auth_user_id = (SELECT auth.uid()) AND u.company_id = users.company_id
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users u WHERE u.auth_user_id = (SELECT auth.uid()) AND u.company_id = users.company_id
  )
);
CREATE POLICY users_delete_tenant ON users FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.users u WHERE u.auth_user_id = (SELECT auth.uid()) AND u.company_id = users.company_id
  )
);
CREATE POLICY users_insert_tenant ON users FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users u WHERE u.auth_user_id = (SELECT auth.uid()) AND u.company_id = users.company_id
  )
);

-- Generic policy generator for other tables with company_id
CREATE POLICY clients_select_tenant ON clients FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users u WHERE u.auth_user_id = (SELECT auth.uid()) AND u.company_id = clients.company_id)
);
CREATE POLICY clients_update_tenant ON clients FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users u WHERE u.auth_user_id = (SELECT auth.uid()) AND u.company_id = clients.company_id)
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.users u WHERE u.auth_user_id = (SELECT auth.uid()) AND u.company_id = clients.company_id)
);
CREATE POLICY clients_delete_tenant ON clients FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.users u WHERE u.auth_user_id = (SELECT auth.uid()) AND u.company_id = clients.company_id)
);
CREATE POLICY clients_insert_tenant ON clients FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users u WHERE u.auth_user_id = (SELECT auth.uid()) AND u.company_id = clients.company_id)
);

CREATE POLICY services_select_tenant ON services FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users u WHERE u.auth_user_id = (SELECT auth.uid()) AND u.company_id = services.company_id)
);
CREATE POLICY services_update_tenant ON services FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users u WHERE u.auth_user_id = (SELECT auth.uid()) AND u.company_id = services.company_id)
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.users u WHERE u.auth_user_id = (SELECT auth.uid()) AND u.company_id = services.company_id)
);
CREATE POLICY services_delete_tenant ON services FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.users u WHERE u.auth_user_id = (SELECT auth.uid()) AND u.company_id = services.company_id)
);
CREATE POLICY services_insert_tenant ON services FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users u WHERE u.auth_user_id = (SELECT auth.uid()) AND u.company_id = services.company_id)
);

CREATE POLICY appointments_select_tenant ON appointments FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users u WHERE u.auth_user_id = (SELECT auth.uid()) AND u.company_id = appointments.company_id)
);
CREATE POLICY appointments_update_tenant ON appointments FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users u WHERE u.auth_user_id = (SELECT auth.uid()) AND u.company_id = appointments.company_id)
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.users u WHERE u.auth_user_id = (SELECT auth.uid()) AND u.company_id = appointments.company_id)
);
CREATE POLICY appointments_delete_tenant ON appointments FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.users u WHERE u.auth_user_id = (SELECT auth.uid()) AND u.company_id = appointments.company_id)
);
CREATE POLICY appointments_insert_tenant ON appointments FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users u WHERE u.auth_user_id = (SELECT auth.uid()) AND u.company_id = appointments.company_id)
);

CREATE POLICY conversation_threads_select_tenant ON conversation_threads FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users u WHERE u.auth_user_id = (SELECT auth.uid()) AND u.company_id = conversation_threads.company_id)
);
CREATE POLICY conversation_threads_update_tenant ON conversation_threads FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users u WHERE u.auth_user_id = (SELECT auth.uid()) AND u.company_id = conversation_threads.company_id)
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.users u WHERE u.auth_user_id = (SELECT auth.uid()) AND u.company_id = conversation_threads.company_id)
);
CREATE POLICY conversation_threads_delete_tenant ON conversation_threads FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.users u WHERE u.auth_user_id = (SELECT auth.uid()) AND u.company_id = conversation_threads.company_id)
);
CREATE POLICY conversation_threads_insert_tenant ON conversation_threads FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users u WHERE u.auth_user_id = (SELECT auth.uid()) AND u.company_id = conversation_threads.company_id)
);

CREATE POLICY interactions_select_tenant ON interactions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users u WHERE u.auth_user_id = (SELECT auth.uid()) AND u.company_id = interactions.company_id)
);
CREATE POLICY interactions_update_tenant ON interactions FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users u WHERE u.auth_user_id = (SELECT auth.uid()) AND u.company_id = interactions.company_id)
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.users u WHERE u.auth_user_id = (SELECT auth.uid()) AND u.company_id = interactions.company_id)
);
CREATE POLICY interactions_delete_tenant ON interactions FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.users u WHERE u.auth_user_id = (SELECT auth.uid()) AND u.company_id = interactions.company_id)
);
CREATE POLICY interactions_insert_tenant ON interactions FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users u WHERE u.auth_user_id = (SELECT auth.uid()) AND u.company_id = interactions.company_id)
);

CREATE POLICY insights_select_tenant ON insights FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users u WHERE u.auth_user_id = (SELECT auth.uid()) AND u.company_id = insights.company_id)
);
CREATE POLICY insights_update_tenant ON insights FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users u WHERE u.auth_user_id = (SELECT auth.uid()) AND u.company_id = insights.company_id)
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.users u WHERE u.auth_user_id = (SELECT auth.uid()) AND u.company_id = insights.company_id)
);
CREATE POLICY insights_delete_tenant ON insights FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.users u WHERE u.auth_user_id = (SELECT auth.uid()) AND u.company_id = insights.company_id)
);
CREATE POLICY insights_insert_tenant ON insights FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users u WHERE u.auth_user_id = (SELECT auth.uid()) AND u.company_id = insights.company_id)
);

CREATE POLICY payments_select_tenant ON payments FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users u WHERE u.auth_user_id = (SELECT auth.uid()) AND u.company_id = payments.company_id)
);
CREATE POLICY payments_update_tenant ON payments FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users u WHERE u.auth_user_id = (SELECT auth.uid()) AND u.company_id = payments.company_id)
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.users u WHERE u.auth_user_id = (SELECT auth.uid()) AND u.company_id = payments.company_id)
);
CREATE POLICY payments_delete_tenant ON payments FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.users u WHERE u.auth_user_id = (SELECT auth.uid()) AND u.company_id = payments.company_id)
);
CREATE POLICY payments_insert_tenant ON payments FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users u WHERE u.auth_user_id = (SELECT auth.uid()) AND u.company_id = payments.company_id)
);

CREATE POLICY settings_select_tenant ON settings FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users u WHERE u.auth_user_id = (SELECT auth.uid()) AND u.company_id = settings.company_id)
);
CREATE POLICY settings_update_tenant ON settings FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users u WHERE u.auth_user_id = (SELECT auth.uid()) AND u.company_id = settings.company_id)
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.users u WHERE u.auth_user_id = (SELECT auth.uid()) AND u.company_id = settings.company_id)
);
CREATE POLICY settings_delete_tenant ON settings FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.users u WHERE u.auth_user_id = (SELECT auth.uid()) AND u.company_id = settings.company_id)
);
CREATE POLICY settings_insert_tenant ON settings FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users u WHERE u.auth_user_id = (SELECT auth.uid()) AND u.company_id = settings.company_id)
);

CREATE POLICY ai_context_snapshots_select_tenant ON ai_context_snapshots FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users u WHERE u.auth_user_id = (SELECT auth.uid()) AND u.company_id = ai_context_snapshots.company_id)
);
CREATE POLICY ai_context_snapshots_update_tenant ON ai_context_snapshots FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users u WHERE u.auth_user_id = (SELECT auth.uid()) AND u.company_id = ai_context_snapshots.company_id)
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.users u WHERE u.auth_user_id = (SELECT auth.uid()) AND u.company_id = ai_context_snapshots.company_id)
);
CREATE POLICY ai_context_snapshots_delete_tenant ON ai_context_snapshots FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.users u WHERE u.auth_user_id = (SELECT auth.uid()) AND u.company_id = ai_context_snapshots.company_id)
);
CREATE POLICY ai_context_snapshots_insert_tenant ON ai_context_snapshots FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users u WHERE u.auth_user_id = (SELECT auth.uid()) AND u.company_id = ai_context_snapshots.company_id)
);

-- Indexes: covering foreign keys for performance
CREATE INDEX IF NOT EXISTS idx_ai_context_snapshots_company_id ON ai_context_snapshots (company_id);
CREATE INDEX IF NOT EXISTS idx_ai_context_snapshots_client_id ON ai_context_snapshots (client_id);
CREATE INDEX IF NOT EXISTS idx_ai_context_snapshots_source_conversation_id ON ai_context_snapshots (source_conversation_id);

CREATE INDEX IF NOT EXISTS idx_appointments_company_id ON appointments (company_id);
CREATE INDEX IF NOT EXISTS idx_appointments_client_id ON appointments (client_id);
CREATE INDEX IF NOT EXISTS idx_appointments_user_id ON appointments (user_id);
CREATE INDEX IF NOT EXISTS idx_appointments_service_id ON appointments (service_id);

CREATE INDEX IF NOT EXISTS idx_clients_company_id ON clients (company_id);

CREATE INDEX IF NOT EXISTS idx_conversation_threads_company_id ON conversation_threads (company_id);
CREATE INDEX IF NOT EXISTS idx_conversation_threads_client_id ON conversation_threads (client_id);
CREATE INDEX IF NOT EXISTS idx_conversation_threads_assigned_user_id ON conversation_threads (assigned_user_id);

CREATE INDEX IF NOT EXISTS idx_insights_company_id ON insights (company_id);
CREATE INDEX IF NOT EXISTS idx_insights_client_id ON insights (client_id);

CREATE INDEX IF NOT EXISTS idx_interactions_company_id ON interactions (company_id);
CREATE INDEX IF NOT EXISTS idx_interactions_client_id ON interactions (client_id);
CREATE INDEX IF NOT EXISTS idx_interactions_conversation_id ON interactions (conversation_id);

CREATE INDEX IF NOT EXISTS idx_payments_company_id ON payments (company_id);
CREATE INDEX IF NOT EXISTS idx_payments_client_id ON payments (client_id);
CREATE INDEX IF NOT EXISTS idx_payments_appointment_id ON payments (appointment_id);

CREATE INDEX IF NOT EXISTS idx_services_company_id ON services (company_id);

CREATE INDEX IF NOT EXISTS idx_users_company_id ON users (company_id);

-- Seeds (minimal demo)
INSERT INTO companies (name, owner_name, email, phone, address, cnpj)
VALUES ('Clínica Demo', 'Dra. Ana Demo', 'contato@clinicademo.com', '(11) 99999-0000', 'Rua das Clínicas, 123 - Centro', '00.000.000/0000-00')
ON CONFLICT DO NOTHING;

-- Fetch demo company id
WITH c AS (
  SELECT id FROM companies WHERE email = 'contato@clinicademo.com' LIMIT 1
)
INSERT INTO users (company_id, auth_user_id, name, email, password_hash, role)
SELECT c.id, gen_random_uuid(), 'Admin Demo', 'admin@clinicademo.com', '$2b$12$6pVxM7r5QeXhWcG8l2uHDeZ.KH7pva6Bv8Qqk2xFqXrJjQY9yq8j6', 'admin' FROM c
ON CONFLICT DO NOTHING;

WITH c AS (
  SELECT id FROM companies WHERE email = 'contato@clinicademo.com' LIMIT 1
)
INSERT INTO users (company_id, auth_user_id, name, email, password_hash, role)
SELECT c.id, gen_random_uuid(), 'Staff Demo', 'staff@clinicademo.com', '$2b$12$6pVxM7r5QeXhWcG8l2uHDeZ.KH7pva6Bv8Qqk2xFqXrJjQY9yq8j6', 'staff' FROM c
ON CONFLICT DO NOTHING;

WITH c AS (
  SELECT id FROM companies WHERE email = 'contato@clinicademo.com' LIMIT 1
)
INSERT INTO clients (company_id, full_name, phone, email)
SELECT c.id, 'Maria Silva', '(11) 99999-0001', 'maria@demo.com' FROM c
ON CONFLICT DO NOTHING;

WITH c AS (
  SELECT id FROM companies WHERE email = 'contato@clinicademo.com' LIMIT 1
)
INSERT INTO clients (company_id, full_name, phone, email)
SELECT c.id, 'João Santos', '(11) 99999-0002', 'joao@demo.com' FROM c
ON CONFLICT DO NOTHING;

WITH c AS (
  SELECT id FROM companies WHERE email = 'contato@clinicademo.com' LIMIT 1
)
INSERT INTO services (company_id, name, description, price, duration_minutes)
SELECT c.id, 'Limpeza de Pele', 'Procedimento de limpeza facial', 199.90, 60 FROM c
ON CONFLICT DO NOTHING;

WITH c AS (
  SELECT id FROM companies WHERE email = 'contato@clinicademo.com' LIMIT 1
)
INSERT INTO settings (company_id, working_hours, contact_email, contact_phone, support_ticket_enabled, payment_status)
SELECT c.id,
       '{"mon_fri":"08:00-18:00","sat":"08:00-14:00"}'::jsonb,
       'contato@clinicademo.com',
       '(11) 99999-0000',
       TRUE,
       'active'
FROM c
ON CONFLICT (company_id) DO NOTHING;


