-- Primeiro, remover valores não utilizados do enum
ALTER TYPE interaction_channel RENAME TO interaction_channel_old;
CREATE TYPE interaction_channel AS ENUM ('whatsapp', 'instagram');

-- Converter dados existentes
ALTER TABLE interactions 
  ALTER COLUMN channel TYPE interaction_channel 
  USING (
    CASE 
      WHEN channel::text = 'whatsapp' THEN 'whatsapp'::interaction_channel
      ELSE 'whatsapp'::interaction_channel -- Converter email/sms para whatsapp como fallback
    END
  );

-- Remover enum antigo
DROP TYPE interaction_channel_old;
