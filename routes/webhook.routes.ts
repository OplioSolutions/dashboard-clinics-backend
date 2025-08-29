import { Router } from 'express'
import { WebhookController } from '../controllers/webhook.controller'
import { OutboundCallbackController } from '../controllers/outbound-callback.controller'
import { dynamicWebhookAuth } from '../middleware/webhook-auth'
import { outboundCallbackAuth } from '../middleware/outbound-callback-auth'
import { getSupabaseClient } from '../lib/db-helpers'
import { Channel } from '../schemas/message'

const router = Router()
const webhookController = new WebhookController(getSupabaseClient())
const callbackController = new OutboundCallbackController(getSupabaseClient())

// Sistema multi-tenant puro - credenciais vêm da tabela integrations por empresa

// Middleware de parsing para raw body (necessário para HMAC)
import express from 'express'

// Middleware para capturar o body raw para validação HMAC
const rawBodyMiddleware = express.raw({ type: 'application/json' })

// Converter raw body de volta para JSON após validação
const parseJsonAfterValidation = (req: any, res: any, next: any) => {
  if (req.body && Buffer.isBuffer(req.body)) {
    try {
      req.body = JSON.parse(req.body.toString())
      next()
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: 'Invalid JSON in request body'
      })
    }
  } else {
    next()
  }
}

// Configurar middleware de autenticação dinâmica (pura multi-tenant)
function getAuthMiddleware(channel: Channel) {
  // Sempre usar autenticação dinâmica - cada empresa deve ter integração configurada
  return dynamicWebhookAuth(channel)
}

/**
 * POST /webhooks/whatsapp
 * Recebe mensagens do WhatsApp via n8n
 * 
 * Payload esperado:
 * {
 *   "company_id": "uuid-da-clinica",
 *   "channel": "whatsapp",
 *   "external_id": "5511999999999",
 *   "message": {
 *     "type": "text|image|audio",
 *     "content": "..."
 *   },
 *   "timestamp": "2024-01-01T12:00:00Z"
 * }
 */
router.post('/whatsapp', 
  rawBodyMiddleware,
  getAuthMiddleware(Channel.WHATSAPP),
  parseJsonAfterValidation,
  async (req, res) => {
    await webhookController.handleWhatsApp(req, res)
  }
)

/**
 * POST /webhooks/instagram
 * Recebe mensagens do Instagram via n8n
 * 
 * Payload esperado: mesmo formato do WhatsApp, mas com channel: "instagram"
 * e external_id como handle (@perfil)
 */
router.post('/instagram',
  rawBodyMiddleware,
  getAuthMiddleware(Channel.INSTAGRAM),
  parseJsonAfterValidation,
  async (req, res) => {
    await webhookController.handleInstagram(req, res)
  }
)

/**
 * POST /webhooks/outbound-callback
 * Callback para n8n reportar status de entrega das mensagens outbound
 * 
 * Payload esperado:
 * {
 *   "interaction_id": 123,
 *   "company_id": "uuid-da-clinica",
 *   "status": "sent|delivered|read|failed",
 *   "error_message": "...", // opcional, só para failed
 *   "delivered_at": "2024-01-01T12:00:00Z", // opcional
 *   "read_at": "2024-01-01T12:00:00Z", // opcional
 *   "external_message_id": "whatsapp-msg-id" // opcional
 * }
 */
router.post('/outbound-callback',
  rawBodyMiddleware,
  outboundCallbackAuth,
  parseJsonAfterValidation,
  async (req, res) => {
    await callbackController.handleCallback(req, res)
  }
)

/**
 * GET /webhooks/health
 * Endpoint para verificar se o serviço de webhooks está funcionando
 */
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Webhook service is healthy',
    timestamp: new Date().toISOString()
  })
})

export { router as webhookRoutes }
