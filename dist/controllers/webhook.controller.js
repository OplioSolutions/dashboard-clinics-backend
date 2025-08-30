"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhookController = void 0;
const zod_1 = require("zod");
const base_1 = require("./base");
const errors_1 = require("../lib/errors");
const message_1 = require("../schemas/message");
const conversation_controller_1 = require("./conversation.controller");
const interaction_controller_1 = require("./interaction.controller");
// Schema para validar o payload normalizado do n8n
const webhookPayloadSchema = zod_1.z.object({
    company_id: zod_1.z.string().uuid(),
    channel: zod_1.z.nativeEnum(message_1.Channel),
    external_id: zod_1.z.string().min(1),
    message: zod_1.z.object({
        type: zod_1.z.enum(['text', 'image', 'audio']),
        content: zod_1.z.string().min(1)
    }),
    timestamp: zod_1.z.string().datetime()
});
class WebhookController extends base_1.BaseController {
    constructor(supabase) {
        super('clients', supabase);
        this.conversationController = new conversation_controller_1.ConversationController(supabase);
        this.interactionController = new interaction_controller_1.InteractionController(supabase);
    }
    // POST /webhooks/whatsapp
    async handleWhatsApp(req, res) {
        return this.processWebhook(req, res, message_1.Channel.WHATSAPP);
    }
    // POST /webhooks/instagram
    async handleInstagram(req, res) {
        return this.processWebhook(req, res, message_1.Channel.INSTAGRAM);
    }
    async processWebhook(req, res, expectedChannel) {
        try {
            // Validar payload
            const payload = webhookPayloadSchema.parse(req.body);
            // Verificar se o canal corresponde à rota
            if (payload.channel !== expectedChannel) {
                throw new errors_1.AppError(400, `Channel mismatch. Expected ${expectedChannel}, got ${payload.channel}`);
            }
            // Usar informações da integração validada pelo middleware
            const companyId = req.integration?.companyId || payload.company_id;
            // Criar uma fake request com tenant para usar os controllers existentes
            const tenantReq = this.createTenantRequest(req, companyId);
            // 1. Identificar ou criar cliente
            const client = await this.findOrCreateClient(tenantReq, payload);
            // 2. Verificar/criar conversa ativa
            const conversation = await this.findOrCreateActiveConversation(tenantReq, client.id, payload.channel);
            // 3. Criar interação
            await this.createInboundInteraction(tenantReq, conversation.id, client.id, payload);
            return res.status(200).json({
                success: true,
                conversation_id: conversation.id,
                client_id: client.id
            });
        }
        catch (error) {
            console.error(`Webhook ${expectedChannel} error:`, error);
            if (error instanceof zod_1.z.ZodError) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid payload format',
                    details: error.errors
                });
            }
            if (error instanceof errors_1.AppError) {
                return res.status(error.statusCode).json({
                    success: false,
                    error: error.message
                });
            }
            return res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }
    createTenantRequest(originalReq, companyId) {
        // Criar uma request modificada com tenant info para usar controllers existentes
        const tenantReq = {
            ...originalReq,
            tenant: {
                company_id: companyId,
                user_id: 'webhook-system', // ID especial para identificar requisições via webhook
                role: 'system'
            }
        };
        return tenantReq;
    }
    async findOrCreateClient(req, payload) {
        const { external_id, channel } = payload;
        // Buscar cliente existente baseado no identificador do canal
        let whereClause = {};
        if (channel === message_1.Channel.WHATSAPP) {
            whereClause = { phone: external_id };
        }
        else if (channel === message_1.Channel.INSTAGRAM) {
            // Para Instagram, vamos armazenar o handle no campo notes por enquanto
            // até termos uma migração que adicione o campo instagram_handle
            whereClause = { notes: `Instagram: ${external_id}` };
        }
        const { data: existingClient } = await this.getSupabase(req)
            .from('clients')
            .select('*')
            .eq('company_id', req.tenant.company_id)
            .match(whereClause)
            .single();
        if (existingClient) {
            return existingClient;
        }
        // Criar cliente lead automático
        const leadData = {
            company_id: req.tenant.company_id,
            full_name: 'Lead Automático', // Campo correto conforme schema
        };
        if (channel === message_1.Channel.WHATSAPP) {
            leadData.phone = external_id;
        }
        else if (channel === message_1.Channel.INSTAGRAM) {
            // Armazenar handle no campo notes por enquanto
            leadData.notes = `Instagram: ${external_id}`;
        }
        const { data: newClient, error } = await this.getSupabase(req)
            .from('clients')
            .insert(leadData)
            .select()
            .single();
        if (error) {
            throw new errors_1.AppError(500, `Failed to create client: ${error.message}`);
        }
        return newClient;
    }
    async findOrCreateActiveConversation(req, clientId, channel) {
        // Buscar conversa ativa existente
        const { data: activeConversation } = await this.getSupabase(req)
            .from('conversation_threads')
            .select('*')
            .eq('company_id', req.tenant.company_id)
            .eq('client_id', clientId)
            .eq('status', 'active')
            .single();
        if (activeConversation) {
            // Verificar janela de 24h para reabertura
            const lastUpdate = new Date(activeConversation.updated_at || activeConversation.started_at);
            const now = new Date();
            const hoursDiff = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);
            if (hoursDiff < 24) {
                // Conversa ainda está dentro da janela, usar a existente
                return activeConversation;
            }
            else {
                // Fechar conversa antiga e criar nova
                await this.getSupabase(req)
                    .from('conversation_threads')
                    .update({
                    status: 'closed',
                    ended_at: new Date().toISOString()
                })
                    .eq('id', activeConversation.id);
            }
        }
        // Criar nova conversa
        const newConversation = {
            company_id: req.tenant.company_id,
            client_id: clientId,
            started_at: new Date().toISOString(),
            channels_used: [channel],
            status: 'active',
            assignment_status: 'unassigned'
        };
        const { data: conversation, error } = await this.getSupabase(req)
            .from('conversation_threads')
            .insert(newConversation)
            .select()
            .single();
        if (error) {
            throw new errors_1.AppError(500, `Failed to create conversation: ${error.message}`);
        }
        return conversation;
    }
    async createInboundInteraction(req, conversationId, clientId, payload) {
        const interactionData = {
            company_id: req.tenant.company_id,
            conversation_id: conversationId,
            client_id: clientId,
            message: payload.message.content,
            channel: payload.channel,
            type: message_1.MessageType.GENERAL,
            direction: message_1.MessageDirection.INBOUND,
            status: message_1.MessageStatus.DELIVERED,
            timestamp: payload.timestamp,
            metadata: {
                message_type: payload.message.type,
                webhook_source: true
            }
        };
        const { data: interaction, error } = await this.getSupabase(req)
            .from('interactions')
            .insert(interactionData)
            .select()
            .single();
        if (error) {
            throw new errors_1.AppError(500, `Failed to create interaction: ${error.message}`);
        }
        // Atualizar timestamp da conversa
        await this.getSupabase(req)
            .from('conversation_threads')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', conversationId);
        return interaction;
    }
}
exports.WebhookController = WebhookController;
