"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InteractionController = void 0;
const base_1 = require("./base");
const errors_1 = require("../lib/errors");
const message_1 = require("../schemas/message");
const channel_selector_1 = require("../services/channel-selector");
class InteractionController extends base_1.BaseController {
    constructor(supabase) {
        super('interactions', supabase);
        this.channelSelector = new channel_selector_1.ChannelSelector(supabase || {}, '');
    }
    // POST /api/interactions
    async createInteraction(req, res) {
        return this.handleRequest(req, res, async () => {
            const { conversation_id, client_id, message, channel, type = message_1.MessageType.GENERAL, direction = message_1.MessageDirection.OUTBOUND, status = message_1.MessageStatus.SENT } = req.body;
            // Verificar se a conversa existe e está ativa
            const { data: conversation, error: conversationError } = await this.getSupabase(req)
                .from('conversation_threads')
                .select('status, channels_used')
                .eq('id', conversation_id)
                .eq('company_id', req.tenant.company_id)
                .single();
            if (conversationError || !conversation) {
                throw new errors_1.AppError(404, 'Conversation not found');
            }
            if (conversation.status === 'closed') {
                throw new errors_1.AppError(400, 'Cannot add message to closed conversation');
            }
            // Determinar canal apropriado
            const selectedChannel = channel || await this.channelSelector.determineChannel(client_id, type, 'human', // TODO: Passar como parâmetro quando tivermos IA
            undefined);
            // Criar a interação
            const newInteraction = {
                company_id: req.tenant.company_id,
                conversation_id,
                client_id,
                message,
                channel: selectedChannel,
                type,
                direction,
                status,
                timestamp: new Date().toISOString()
            };
            const { data: interaction, error } = await this.getSupabase(req)
                .from(this.tableName)
                .insert(newInteraction)
                .select()
                .single();
            if (error)
                throw error;
            // Atualizar channels_used na conversa se necessário
            if (!conversation.channels_used.includes(selectedChannel)) {
                await this.getSupabase(req)
                    .from('conversation_threads')
                    .update({
                    channels_used: [...conversation.channels_used, selectedChannel],
                    updated_at: new Date().toISOString()
                })
                    .eq('id', conversation_id);
            }
            return res.status(201).json(interaction);
        });
    }
    // PATCH /api/interactions/:id/status
    async updateStatus(req, res) {
        return this.handleRequest(req, res, async () => {
            const { id } = req.params;
            const { status } = req.body;
            if (!Object.values(message_1.MessageStatus).includes(status)) {
                throw new errors_1.AppError(400, 'Invalid status');
            }
            const { data: interaction, error } = await this.createQuery(req)
                .update({ status })
                .eq('id', id)
                .select()
                .single();
            if (error)
                throw error;
            if (!interaction)
                throw new errors_1.AppError(404, 'Interaction not found');
            return res.json(interaction);
        });
    }
    // GET /api/interactions?conversation_id=...
    async listInteractions(req, res) {
        return this.handleRequest(req, res, async () => {
            const { conversation_id, page = 1, limit = 50 } = req.query;
            if (!conversation_id) {
                throw new errors_1.AppError(400, 'conversation_id is required');
            }
            const offset = (Number(page) - 1) * Number(limit);
            const query = this.createQuery(req)
                .select('*')
                .eq('conversation_id', conversation_id)
                .order('timestamp', { ascending: false })
                .range(offset, offset + Number(limit) - 1);
            const { data, error } = await query;
            if (error)
                throw error;
            return res.json(data);
        });
    }
}
exports.InteractionController = InteractionController;
