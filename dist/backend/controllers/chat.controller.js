"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatController = void 0;
const base_1 = require("./base");
const errors_1 = require("../lib/errors");
const message_1 = require("../schemas/message");
const outbound_message_service_1 = require("../services/outbound-message.service");
const zod_1 = require("zod");
// Schema de validação para o endpoint de envio
const sendMessageSchema = zod_1.z.object({
    conversation_id: zod_1.z.number().int().positive(),
    message: zod_1.z.string().min(1).max(4000),
    channel: zod_1.z.nativeEnum(message_1.Channel).optional(), // Opcional - será determinado automaticamente se não fornecido
    type: zod_1.z.nativeEnum(message_1.MessageType).optional().default(message_1.MessageType.GENERAL)
});
class ChatController extends base_1.BaseController {
    constructor(supabase) {
        super('interactions', supabase);
        this.outboundService = new outbound_message_service_1.OutboundMessageService();
    }
    // POST /api/chat/send
    async sendMessage(req, res) {
        return this.handleRequest(req, res, async () => {
            // Validar entrada
            const validatedData = sendMessageSchema.parse(req.body);
            const { conversation_id, message, channel, type } = validatedData;
            const companyId = this.getTenantId(req);
            const userId = req.user?.id;
            // 1. Verificar se a conversa existe e está ativa
            const { data: conversation, error: conversationError } = await this.getSupabase(req)
                .from('conversation_threads')
                .select(`
          id, 
          status, 
          client_id, 
          channels_used,
          clients!inner(id, name, phone, email, instagram_handle)
        `)
                .eq('id', conversation_id)
                .eq('company_id', companyId)
                .single();
            if (conversationError || !conversation) {
                throw new errors_1.AppError(404, 'Conversation not found');
            }
            if (conversation.status === 'closed') {
                throw new errors_1.AppError(400, 'Cannot send message to closed conversation');
            }
            // 2. Determinar o canal se não foi especificado
            let selectedChannel = channel;
            if (!selectedChannel) {
                // Usar o primeiro canal disponível na conversa ou inferir do cliente
                const channelsUsed = conversation.channels_used;
                if (channelsUsed && channelsUsed.length > 0) {
                    selectedChannel = channelsUsed[0];
                }
                else {
                    // Fallback: determinar baseado nos dados do cliente
                    const client = conversation.clients;
                    if (client.phone) {
                        selectedChannel = message_1.Channel.WHATSAPP;
                    }
                    else if (client.instagram_handle) {
                        selectedChannel = message_1.Channel.INSTAGRAM;
                    }
                    else {
                        throw new errors_1.AppError(400, 'Cannot determine channel for message. Please specify channel explicitly.');
                    }
                }
            }
            // 3. Criar a interaction outbound primeiro (antes de enviar)
            const newInteraction = {
                company_id: companyId,
                conversation_id,
                client_id: conversation.client_id,
                message,
                channel: selectedChannel,
                type,
                direction: message_1.MessageDirection.OUTBOUND,
                status: message_1.MessageStatus.PENDING, // Inicialmente pending
                timestamp: new Date().toISOString()
            };
            const { data: interaction, error: interactionError } = await this.getSupabase(req)
                .from('interactions')
                .insert(newInteraction)
                .select()
                .single();
            if (interactionError) {
                throw new errors_1.AppError(500, `Failed to create interaction: ${interactionError.message}`);
            }
            // 4. Atualizar channels_used na conversa se necessário
            const currentChannels = conversation.channels_used || [];
            if (!currentChannels.includes(selectedChannel)) {
                await this.getSupabase(req)
                    .from('conversation_threads')
                    .update({
                    channels_used: [...currentChannels, selectedChannel],
                    updated_at: new Date().toISOString()
                })
                    .eq('id', conversation_id)
                    .eq('company_id', companyId);
            }
            // 5. Enviar via n8n (não bloquear resposta)
            this.outboundService.sendMessage({
                companyId,
                channel: selectedChannel,
                clientContact: this.getClientContact(conversation.clients, selectedChannel),
                message,
                interactionId: interaction.id
            }).catch(error => {
                console.error(`Failed to send message via n8n for interaction ${interaction.id}:`, error);
                // Atualizar status para failed
                this.updateInteractionStatus(req, interaction.id, message_1.MessageStatus.FAILED);
            });
            return {
                success: true,
                interaction_id: interaction.id,
                conversation_id,
                channel: selectedChannel,
                status: message_1.MessageStatus.PENDING,
                message: 'Message queued for sending'
            };
        });
    }
    // POST /api/chat/callback (opcional - para n8n reportar status)
    async handleDeliveryCallback(req, res) {
        return this.handleRequest(req, res, async () => {
            const { interaction_id, status, error_message } = req.body;
            if (!interaction_id || !status) {
                throw new errors_1.AppError(400, 'Missing interaction_id or status');
            }
            // Atualizar status da interaction
            await this.updateInteractionStatus(req, interaction_id, status, error_message);
            return { success: true, message: 'Status updated' };
        });
    }
    /**
     * Helper para extrair contato do cliente baseado no canal
     */
    getClientContact(client, channel) {
        switch (channel) {
            case message_1.Channel.WHATSAPP:
                if (!client.phone) {
                    throw new errors_1.AppError(400, 'Client phone not found for WhatsApp channel');
                }
                return client.phone;
            case message_1.Channel.INSTAGRAM:
                if (!client.instagram_handle) {
                    throw new errors_1.AppError(400, 'Client Instagram handle not found for Instagram channel');
                }
                return client.instagram_handle;
            default:
                throw new errors_1.AppError(400, `Unsupported channel: ${channel}`);
        }
    }
    /**
     * Helper para atualizar status de uma interaction
     */
    async updateInteractionStatus(req, interactionId, status, errorMessage) {
        const updateData = {
            status,
            updated_at: new Date().toISOString()
        };
        // Se for erro, podemos armazenar detalhes em um campo metadata futuramente
        if (errorMessage) {
            console.error(`Interaction ${interactionId} failed: ${errorMessage}`);
        }
        const { error } = await this.getSupabase(req)
            .from('interactions')
            .update(updateData)
            .eq('id', interactionId)
            .eq('company_id', this.getTenantId(req));
        if (error) {
            console.error(`Failed to update interaction ${interactionId} status:`, error);
        }
    }
}
exports.ChatController = ChatController;
