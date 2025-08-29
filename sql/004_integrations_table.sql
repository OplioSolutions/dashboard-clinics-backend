-- Sprint 6.5: Integrations Multi-Tenant (Credenciais por Empresa)
-- Objetivo: permitir que cada empresa tenha suas próprias credenciais para canais

-- Enum para status das integrações
CREATE TYPE integration_status AS ENUM ('active', 'inactive');

-- Tabela de integrações por empresa
CREATE TABLE IF NOT EXISTS integrations (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    channel interaction_channel NOT NULL,
    api_key TEXT, -- Chave da API do canal (encriptada)
    webhook_secret TEXT NOT NULL, -- Secret para validação HMAC (encriptado)
    status integration_status NOT NULL DEFAULT 'active',
    metadata JSONB DEFAULT '{}', -- Configurações específicas por canal
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    -- Garantir uma integração por canal por empresa
    UNIQUE(company_id, channel)
);

-- Habilitar RLS
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;

-- Policies RLS: isolamento por company_id
CREATE POLICY integrations_select_tenant ON integrations FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users u WHERE u.auth_user_id = (SELECT auth.uid()) AND u.company_id = integrations.company_id)
);

CREATE POLICY integrations_update_tenant ON integrations FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users u WHERE u.auth_user_id = (SELECT auth.uid()) AND u.company_id = integrations.company_id)
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.users u WHERE u.auth_user_id = (SELECT auth.uid()) AND u.company_id = integrations.company_id)
);

CREATE POLICY integrations_delete_tenant ON integrations FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.users u WHERE u.auth_user_id = (SELECT auth.uid()) AND u.company_id = integrations.company_id)
);

CREATE POLICY integrations_insert_tenant ON integrations FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users u WHERE u.auth_user_id = (SELECT auth.uid()) AND u.company_id = integrations.company_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_integrations_company_id ON integrations (company_id);
CREATE INDEX IF NOT EXISTS idx_integrations_company_channel ON integrations (company_id, channel);
CREATE INDEX IF NOT EXISTS idx_integrations_status ON integrations (status);

-- Seeds básicos: integrações para empresa demo
-- Buscar empresa demo existente
WITH demo_company AS (
  SELECT id FROM companies WHERE email = 'contato@clinicademo.com' LIMIT 1
)
INSERT INTO integrations (company_id, channel, webhook_secret, status, metadata)
SELECT 
  dc.id,
  'whatsapp'::interaction_channel,
  'demo_whatsapp_secret_' || dc.id::text, -- Secret temporário para demo
  'active'::integration_status,
  '{"phone_number": "+5511999999999", "business_account_id": "demo_123"}'::jsonb
FROM demo_company dc
ON CONFLICT (company_id, channel) DO NOTHING;

-- Integração Instagram para empresa demo
WITH demo_company AS (
  SELECT id FROM companies WHERE email = 'contato@clinicademo.com' LIMIT 1
)
INSERT INTO integrations (company_id, channel, webhook_secret, status, metadata)
SELECT 
  dc.id,
  'instagram'::interaction_channel,
  'demo_instagram_secret_' || dc.id::text, -- Secret temporário para demo
  'active'::integration_status,
  '{"instagram_business_account": "@clinicademo", "page_id": "demo_page_123"}'::jsonb
FROM demo_company dc
ON CONFLICT (company_id, channel) DO NOTHING;
