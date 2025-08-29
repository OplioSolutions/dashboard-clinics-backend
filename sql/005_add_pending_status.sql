-- Sprint 7: Adicionar status 'pending' para interactions
-- Necessário para registrar mensagens antes do envio via n8n

-- Adicionar 'pending' ao enum interaction_status
ALTER TYPE interaction_status ADD VALUE 'pending';

-- O PostgreSQL adiciona novos valores ao final do enum
-- Ordem final será: 'sent', 'delivered', 'read', 'failed', 'pending'
