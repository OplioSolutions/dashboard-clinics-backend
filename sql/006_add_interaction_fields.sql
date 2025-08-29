-- Sprint 7: Adicionar campos extras para interactions outbound
-- Necessário para armazenar timestamps específicos e metadados das mensagens

-- Adicionar campos para timestamps específicos
ALTER TABLE interactions 
ADD COLUMN delivered_at TIMESTAMP,
ADD COLUMN read_at TIMESTAMP,
ADD COLUMN metadata JSONB DEFAULT '{}';

-- Adicionar comentários para documentação
COMMENT ON COLUMN interactions.delivered_at IS 'Timestamp de quando a mensagem foi entregue (reportado pelo canal)';
COMMENT ON COLUMN interactions.read_at IS 'Timestamp de quando a mensagem foi lida (reportado pelo canal)';
COMMENT ON COLUMN interactions.metadata IS 'Metadados adicionais específicos do canal (IDs externos, erros, etc.)';

-- Criar índice no metadata para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_interactions_metadata_gin ON interactions USING GIN (metadata);

-- Atualizar comentário da tabela
COMMENT ON TABLE interactions IS 'Registro de todas as interações (mensagens) entre empresa e clientes através dos canais omnichannel';
