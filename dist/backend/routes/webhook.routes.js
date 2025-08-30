"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.webhookRoutes = void 0;
const express_1 = require("express");
const webhook_controller_1 = require("../controllers/webhook.controller");
const outbound_callback_controller_1 = require("../controllers/outbound-callback.controller");
const webhook_auth_1 = require("../middleware/webhook-auth");
const outbound_callback_auth_1 = require("../middleware/outbound-callback-auth");
const db_helpers_1 = require("../lib/db-helpers");
const message_1 = require("../schemas/message");
const router = (0, express_1.Router)();
exports.webhookRoutes = router;
const webhookController = new webhook_controller_1.WebhookController((0, db_helpers_1.getSupabaseClient)());
const callbackController = new outbound_callback_controller_1.OutboundCallbackController((0, db_helpers_1.getSupabaseClient)());
// Sistema multi-tenant puro - credenciais vêm da tabela integrations por empresa
// Middleware de parsing para raw body (necessário para HMAC)
const express_2 = __importDefault(require("express"));
// Middleware para capturar o body raw para validação HMAC
const rawBodyMiddleware = express_2.default.raw({ type: 'application/json' });
// Converter raw body de volta para JSON após validação
const parseJsonAfterValidation = (req, res, next) => {
    if (req.body && Buffer.isBuffer(req.body)) {
        try {
            req.body = JSON.parse(req.body.toString());
            next();
        }
        catch (error) {
            return res.status(400).json({
                success: false,
                error: 'Invalid JSON in request body'
            });
        }
    }
    else {
        next();
    }
};
// Configurar middleware de autenticação dinâmica (pura multi-tenant)
function getAuthMiddleware(channel) {
    // Sempre usar autenticação dinâmica - cada empresa deve ter integração configurada
    return (0, webhook_auth_1.dynamicWebhookAuth)(channel);
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
router.post('/whatsapp', rawBodyMiddleware, getAuthMiddleware(message_1.Channel.WHATSAPP), parseJsonAfterValidation, async (req, res) => {
    await webhookController.handleWhatsApp(req, res);
});
/**
 * POST /webhooks/instagram
 * Recebe mensagens do Instagram via n8n
 *
 * Payload esperado: mesmo formato do WhatsApp, mas com channel: "instagram"
 * e external_id como handle (@perfil)
 */
router.post('/instagram', rawBodyMiddleware, getAuthMiddleware(message_1.Channel.INSTAGRAM), parseJsonAfterValidation, async (req, res) => {
    await webhookController.handleInstagram(req, res);
});
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
router.post('/outbound-callback', rawBodyMiddleware, outbound_callback_auth_1.outboundCallbackAuth, parseJsonAfterValidation, async (req, res) => {
    await callbackController.handleCallback(req, res);
});
/**
 * GET /webhooks/health
 * Endpoint para verificar se o serviço de webhooks está funcionando
 */
router.get('/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Webhook service is healthy',
        timestamp: new Date().toISOString()
    });
});
