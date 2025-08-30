"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntegrationController = void 0;
const zod_1 = require("zod");
const base_1 = require("./base");
const errors_1 = require("../lib/errors");
const message_1 = require("../schemas/message");
const integration_helper_1 = require("../lib/integration-helper");
// Schemas de validação
const integrationCreateSchema = zod_1.z.object({
    channel: zod_1.z.nativeEnum(message_1.Channel),
    api_key: zod_1.z.string().optional(),
    webhook_secret: zod_1.z.string().optional(),
    status: zod_1.z.enum(['active', 'inactive']).default('active'),
    metadata: zod_1.z.record(zod_1.z.unknown()).default({})
});
const integrationUpdateSchema = integrationCreateSchema.partial();
const integrationStatusSchema = zod_1.z.object({
    status: zod_1.z.enum(['active', 'inactive'])
});
/**
 * Controller para gerenciar integrações de canais por empresa
 * Usado pelo Painel-ADM para configurar credenciais por clínica
 */
class IntegrationController extends base_1.BaseController {
    constructor(supabase) {
        super('integrations', supabase);
        this.integrationHelper = new integration_helper_1.IntegrationHelper(supabase || this.supabase);
    }
    // GET /api/integrations
    async listIntegrations(req, res) {
        return this.handleRequest(req, res, async () => {
            const companyId = this.getTenantId(req);
            const integrations = await this.integrationHelper.getCompanyIntegrations(companyId);
            // Sanitizar response (não enviar credenciais para o frontend)
            const sanitizedIntegrations = integrations.map(integration => ({
                id: integration.id,
                companyId: integration.companyId,
                channel: integration.channel,
                status: integration.status,
                metadata: integration.metadata,
                hasApiKey: !!integration.apiKey,
                hasWebhookSecret: !!integration.webhookSecret,
                createdAt: integration.createdAt,
                updatedAt: integration.updatedAt
            }));
            return res.json(sanitizedIntegrations);
        });
    }
    // GET /api/integrations/:channel
    async getIntegration(req, res) {
        return this.handleRequest(req, res, async () => {
            const { channel } = req.params;
            const companyId = this.getTenantId(req);
            if (!Object.values(message_1.Channel).includes(channel)) {
                throw new errors_1.AppError(400, 'Invalid channel');
            }
            const integration = await this.integrationHelper.getIntegrationCredentials(companyId, channel);
            if (!integration) {
                throw new errors_1.AppError(404, 'Integration not found');
            }
            // Sanitizar response
            const sanitizedIntegration = {
                id: integration.id,
                companyId: integration.companyId,
                channel: integration.channel,
                status: integration.status,
                metadata: integration.metadata,
                hasApiKey: !!integration.apiKey,
                hasWebhookSecret: !!integration.webhookSecret,
                createdAt: integration.createdAt,
                updatedAt: integration.updatedAt
            };
            return res.json(sanitizedIntegration);
        });
    }
    // POST /api/integrations
    async createIntegration(req, res) {
        return this.handleRequest(req, res, async () => {
            // Apenas admins podem criar/gerenciar integrações
            if (req.user?.role !== 'admin') {
                throw new errors_1.AppError(403, 'Only admins can manage integrations');
            }
            const data = integrationCreateSchema.parse(req.body);
            const companyId = this.getTenantId(req);
            // Verificar se já existe integração para este canal
            const existing = await this.integrationHelper.getIntegrationCredentials(companyId, data.channel);
            if (existing) {
                throw new errors_1.AppError(409, `Integration for channel ${data.channel} already exists. Use PUT to update.`);
            }
            const integration = await this.integrationHelper.upsertIntegration(companyId, data.channel, {
                apiKey: data.api_key,
                webhookSecret: data.webhook_secret,
                status: data.status,
                metadata: data.metadata
            });
            // Sanitizar response
            const sanitizedIntegration = {
                id: integration.id,
                companyId: integration.companyId,
                channel: integration.channel,
                status: integration.status,
                metadata: integration.metadata,
                hasApiKey: !!integration.apiKey,
                hasWebhookSecret: !!integration.webhookSecret,
                createdAt: integration.createdAt,
                updatedAt: integration.updatedAt
            };
            return res.status(201).json(sanitizedIntegration);
        });
    }
    // PUT /api/integrations/:channel
    async updateIntegration(req, res) {
        return this.handleRequest(req, res, async () => {
            // Apenas admins podem criar/gerenciar integrações
            if (req.user?.role !== 'admin') {
                throw new errors_1.AppError(403, 'Only admins can manage integrations');
            }
            const { channel } = req.params;
            const data = integrationUpdateSchema.parse(req.body);
            const companyId = this.getTenantId(req);
            if (!Object.values(message_1.Channel).includes(channel)) {
                throw new errors_1.AppError(400, 'Invalid channel');
            }
            // Verificar se integração existe
            const existing = await this.integrationHelper.getIntegrationCredentials(companyId, channel);
            if (!existing) {
                throw new errors_1.AppError(404, 'Integration not found');
            }
            const integration = await this.integrationHelper.upsertIntegration(companyId, channel, {
                apiKey: data.api_key,
                webhookSecret: data.webhook_secret,
                status: data.status,
                metadata: data.metadata
            });
            // Sanitizar response
            const sanitizedIntegration = {
                id: integration.id,
                companyId: integration.companyId,
                channel: integration.channel,
                status: integration.status,
                metadata: integration.metadata,
                hasApiKey: !!integration.apiKey,
                hasWebhookSecret: !!integration.webhookSecret,
                createdAt: integration.createdAt,
                updatedAt: integration.updatedAt
            };
            return res.json(sanitizedIntegration);
        });
    }
    // PATCH /api/integrations/:channel/status
    async updateIntegrationStatus(req, res) {
        return this.handleRequest(req, res, async () => {
            // Apenas admins podem gerenciar status
            if (req.user?.role !== 'admin') {
                throw new errors_1.AppError(403, 'Only admins can manage integrations');
            }
            const { channel } = req.params;
            const { status } = integrationStatusSchema.parse(req.body);
            const companyId = this.getTenantId(req);
            if (!Object.values(message_1.Channel).includes(channel)) {
                throw new errors_1.AppError(400, 'Invalid channel');
            }
            let success = false;
            if (status === 'active') {
                success = await this.integrationHelper.activateIntegration(companyId, channel);
            }
            else {
                success = await this.integrationHelper.deactivateIntegration(companyId, channel);
            }
            if (!success) {
                throw new errors_1.AppError(500, 'Failed to update integration status');
            }
            return res.json({ success: true, status });
        });
    }
    // POST /api/integrations/:channel/rotate-secret
    async rotateWebhookSecret(req, res) {
        return this.handleRequest(req, res, async () => {
            // Apenas admins podem rotacionar secrets
            if (req.user?.role !== 'admin') {
                throw new errors_1.AppError(403, 'Only admins can manage integrations');
            }
            const { channel } = req.params;
            const companyId = this.getTenantId(req);
            if (!Object.values(message_1.Channel).includes(channel)) {
                throw new errors_1.AppError(400, 'Invalid channel');
            }
            const newSecret = await this.integrationHelper.rotateWebhookSecret(companyId, channel);
            if (!newSecret) {
                throw new errors_1.AppError(500, 'Failed to rotate webhook secret');
            }
            return res.json({
                success: true,
                message: 'Webhook secret rotated successfully',
                newSecret // Retornar o novo secret para configuração no n8n
            });
        });
    }
    // DELETE /api/integrations/:channel
    async deleteIntegration(req, res) {
        return this.handleRequest(req, res, async () => {
            // Apenas admins podem deletar integrações
            if (req.user?.role !== 'admin') {
                throw new errors_1.AppError(403, 'Only admins can manage integrations');
            }
            const { channel } = req.params;
            const companyId = this.getTenantId(req);
            if (!Object.values(message_1.Channel).includes(channel)) {
                throw new errors_1.AppError(400, 'Invalid channel');
            }
            // Soft delete: apenas desativar
            const success = await this.integrationHelper.deactivateIntegration(companyId, channel);
            if (!success) {
                throw new errors_1.AppError(500, 'Failed to delete integration');
            }
            return res.json({ success: true, message: 'Integration deleted successfully' });
        });
    }
    // GET /api/integrations/test/:channel
    async testIntegration(req, res) {
        return this.handleRequest(req, res, async () => {
            const { channel } = req.params;
            const companyId = this.getTenantId(req);
            if (!Object.values(message_1.Channel).includes(channel)) {
                throw new errors_1.AppError(400, 'Invalid channel');
            }
            const isValid = await this.integrationHelper.validateIntegration(companyId, channel);
            return res.json({
                channel,
                companyId,
                isValid,
                status: isValid ? 'active' : 'invalid',
                message: isValid
                    ? 'Integration is properly configured and active'
                    : 'Integration is not properly configured or inactive'
            });
        });
    }
    // GET /api/integrations/available-channels
    async getAvailableChannels(req, res) {
        return this.handleRequest(req, res, async () => {
            const channels = Object.values(message_1.Channel).map(channel => ({
                id: channel,
                name: channel.charAt(0).toUpperCase() + channel.slice(1),
                description: this.getChannelDescription(channel)
            }));
            return res.json(channels);
        });
    }
    getChannelDescription(channel) {
        const descriptions = {
            [message_1.Channel.WHATSAPP]: 'WhatsApp Business API integration for messaging',
            [message_1.Channel.INSTAGRAM]: 'Instagram Business API integration for direct messages'
        };
        return descriptions[channel] || 'Channel integration';
    }
}
exports.IntegrationController = IntegrationController;
