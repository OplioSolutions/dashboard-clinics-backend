# Sistema de Integrações Multi-Tenant

## 📋 Visão Geral

O sistema de integrações permite que **cada empresa tenha suas próprias credenciais** de API e webhook secrets, garantindo verdadeiro isolamento multi-tenant.

## 🚀 Arquitetura

### Componentes Principais
- **`integrations` table**: Armazena credenciais criptografadas por empresa
- **`IntegrationSecurityService`**: Criptografia AES-256-GCM com chaves derivadas
- **`IntegrationHelper`**: API para gerenciar credenciais
- **`dynamicWebhookAuth`**: Middleware de autenticação por empresa

### Fluxo de Autenticação
1. **n8n** envia webhook com `company_id` no payload
2. **Backend** busca credenciais específicas da empresa na tabela `integrations`
3. **Validação HMAC** usando webhook secret da empresa
4. **Processamento** da mensagem com isolamento garantido

## 🔧 Configuração

### 1. Variáveis de Ambiente Obrigatórias

```bash
# Chave mestra para criptografia (OBRIGATÓRIO em produção)
INTEGRATION_MASTER_KEY=sua-chave-mestra-super-segura-256-bits

# Fallback alternativo (não recomendado)
SUPABASE_JWT_SECRET=sua-jwt-secret
```

### 2. Configuração de Empresa

**Cada empresa DEVE ter uma integração configurada antes de usar webhooks.**

#### Via API (Painel-ADM):
```bash
POST /api/integrations
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "channel": "whatsapp",
  "api_key": "token-da-empresa-no-whatsapp",
  "webhook_secret": "secret-personalizado-opcional",
  "metadata": {
    "phone_number": "+5511999999999",
    "business_account_id": "123456789"
  }
}
```

#### Resposta:
```json
{
  "id": 1,
  "companyId": "123",
  "channel": "whatsapp",
  "status": "active",
  "hasApiKey": true,
  "hasWebhookSecret": true,
  "metadata": { "phone_number": "+5511999999999" },
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z"
}
```

### 3. Configuração do n8n

**CRÍTICO:** O n8n DEVE sempre incluir `company_id` no payload:

```json
{
  "company_id": "uuid-da-empresa",
  "channel": "whatsapp",
  "external_id": "5511999999999",
  "message": {
    "type": "text",
    "content": "Mensagem do cliente"
  },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

### 4. Geração de Assinatura HMAC

O n8n deve assinar o payload com o webhook secret da empresa:

```javascript
const crypto = require('crypto');

function generateSignature(payload, secret) {
  const body = JSON.stringify(payload);
  const signature = crypto
    .createHmac('sha256', secret)
    .update(body, 'utf8')
    .digest('hex');
  
  return `sha256=${signature}`;
}

// Usar no header
headers['x-webhook-signature'] = generateSignature(payload, webhookSecret);
```

## 🔐 Segurança

### Criptografia
- **Algoritmo**: AES-256-GCM
- **Chaves**: Derivadas por empresa usando PBKDF2 (100.000 iterações)
- **Salt/IV**: Únicos por valor criptografado
- **Timing Attacks**: Protegido via `crypto.timingSafeEqual`

### Isolamento
- Cada empresa tem chaves de criptografia derivadas únicas
- RLS garante acesso apenas aos dados próprios
- Validação HMAC específica por empresa
- Impossível cross-tenant data access

## 🛡️ Validações

### Webhook Payload
- ✅ `company_id` obrigatório (UUID válido)
- ✅ `channel` deve corresponder à rota
- ✅ Integração ativa deve existir
- ✅ Assinatura HMAC válida

### Integração Ativa
- Status = 'active'
- Webhook secret configurado
- Empresa existe e está ativa

## 📚 Endpoints da API

### Listar Integrações
```bash
GET /api/integrations
Authorization: Bearer <token>
```

### Criar Integração
```bash
POST /api/integrations
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "channel": "whatsapp|instagram",
  "api_key": "opcional",
  "webhook_secret": "opcional-gerado-automaticamente",
  "status": "active|inactive",
  "metadata": {}
}
```

### Rotacionar Secret
```bash
POST /api/integrations/:channel/rotate-secret
Authorization: Bearer <admin-token>
```

### Testar Integração
```bash
GET /api/integrations/test/:channel
Authorization: Bearer <token>
```

### Canais Disponíveis
```bash
GET /api/integrations/available-channels
Authorization: Bearer <token>
```

## ⚠️ Requisitos Críticos

### Para n8n
1. **SEMPRE incluir `company_id`** no payload
2. **Usar webhook secret específico** da empresa
3. **Assinar payload completo** com HMAC SHA-256
4. **Header correto**: `x-webhook-signature: sha256=<hash>`

### Para Painel-ADM
1. **Configurar integração** antes do primeiro webhook
2. **Gerenciar credenciais** via API protegida
3. **Rotacionar secrets** periodicamente
4. **Monitorar status** das integrações

### Para Empresas
1. **Credenciais isoladas** - nunca compartilhadas
2. **Setup obrigatório** via admin
3. **Canais independentes** por empresa
4. **Secrets únicos** por canal

## 🚨 Erros Comuns

### `Missing company_id in payload`
- n8n não está enviando company_id
- Verificar configuração do workflow

### `No valid credentials found`
- Empresa não tem integração configurada
- Criar integração via admin panel

### `Invalid webhook signature`
- Secret incorreto ou payload alterado
- Verificar configuração no n8n
- Rotacionar secret se necessário

### `Channel mismatch`
- Payload com canal diferente da rota
- Verificar roteamento no n8n

## 🔄 Migração de Sistema Legado

### Remoção do Fallback Global
- ❌ **Removido**: Credenciais globais via env vars
- ✅ **Novo**: Credenciais isoladas por empresa
- 🔐 **Segurança**: Sem bypass possível

### Antes (Legado)
```bash
# Todas empresas usavam
WEBHOOK_SECRET=global-secret
WHATSAPP_API_KEY=global-key
```

### Agora (Multi-Tenant)
```sql
-- Cada empresa tem suas próprias credenciais
SELECT * FROM integrations WHERE company_id = 'empresa-123';
```

## 📊 Monitoramento

### Logs Importantes
- `No integration found for company X` - Configurar integração
- `Invalid webhook signature` - Verificar secret
- `Missing company_id` - Corrigir n8n

### Métricas Sugeridas
- Webhooks por empresa
- Erros de autenticação
- Status das integrações
- Rotação de secrets

---

**⚡ Sistema Multi-Tenant Puro - Cada empresa é completamente isolada!**
