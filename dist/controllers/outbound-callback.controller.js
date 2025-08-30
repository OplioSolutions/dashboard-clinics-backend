"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OutboundCallbackController = void 0;
const base_1 = require("./base");
const errors_1 = require("../lib/errors");
const message_1 = require("../schemas/message");
const zod_1 = require("zod");
// Schema para validação do callback do n8n
const callbackSchema = zod_1.z.object({
    interaction_id: zod_1.z.number().int().positive(),
    company_id: zod_1.z.string().min(1), // Necessário para isolamento multi-tenant
    status: zod_1.z.nativeEnum(message_1.MessageStatus),
    error_message: zod_1.z.string().optional(),
    delivered_at: zod_1.z.string().datetime().optional(),
    read_at: zod_1.z.string().datetime().optional(),
    external_message_id: zod_1.z.string().optional(), // ID da mensagem no canal (WhatsApp, Instagram)
    metadata: zod_1.z.record(zod_1.z.unknown()).optional()
});
class OutboundCallbackController extends base_1.BaseController {
    constructor(supabase) {
        super('interactions', supabase);
    }
    /**
     * POST /webhooks/outbound-callback
     * Endpoint para n8n reportar status de entrega das mensagens
     * Rota pública mas com autenticação via secret compartilhado
     */
    async handleCallback(req, res) {
        try {
            // Validar payload
            const validatedData = callbackSchema.parse(req.body);
            const { interaction_id, company_id, status, error_message, delivered_at, read_at, external_message_id, metadata } = validatedData;
            // Criar request com tenant scope para usar helpers do BaseController
            const tenantReq = this.createTenantRequest(req, company_id);
            // Verificar se a interaction existe e pertence à empresa
            const { data: interaction, error: fetchError } = await this.getSupabase(tenantReq)
                .from('interactions')
                .select('id, status, direction, conversation_id')
                .eq('id', interaction_id)
                .eq('company_id', company_id)
                .eq('direction', 'outbound') // Só atualizamos interactions outbound
                .single();
            if (fetchError || !interaction) {
                throw new errors_1.AppError(404, `Interaction ${interaction_id} not found for company ${company_id}`);
            }
            // Preparar dados para atualização
            const updateData = {
                status,
                updated_at: new Date().toISOString()
            };
            // Adicionar timestamps específicos conforme o status
            if (status === message_1.MessageStatus.DELIVERED && delivered_at) {
                updateData.delivered_at = delivered_at;
            }
            if (status === message_1.MessageStatus.READ && read_at) {
                updateData.read_at = read_at;
            }
            // Adicionar metadata se fornecido
            if (metadata || external_message_id) {
                updateData.metadata = {
                    ...(interaction.metadata || {}),
                    ...(metadata || {}),
                    ...(external_message_id && { external_message_id })
                };
            }
            // Se houve erro, adicionar detalhes
            if (status === message_1.MessageStatus.FAILED && error_message) {
                updateData.metadata = {
                    ...(updateData.metadata || {}),
                    error_message,
                    failed_at: new Date().toISOString()
                };
            }
            // Atualizar a interaction
            const { error: updateError } = await this.getSupabase(tenantReq)
                .from('interactions')
                .update(updateData)
                .eq('id', interaction_id)
                .eq('company_id', company_id);
            if (updateError) {
                throw new errors_1.AppError(500, `Failed to update interaction: ${updateError.message}`);
            }
            console.log(`Interaction ${interaction_id} status updated to ${status} for company ${company_id}`);
            return res.status(200).json({
                success: true,
                interaction_id,
                status,
                message: 'Status updated successfully'
            });
        }
        catch (error) {
            console.error('Outbound callback error:', error);
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
    /**
     * Cria uma request fake com tenant scope para reutilizar métodos do BaseController
     */
    createTenantRequest(originalReq, companyId) {
        return {
            ...originalReq,
            tenant: { company_id: companyId },
            supabase: this.supabase || originalReq.supabase
        };
    }
}
exports.OutboundCallbackController = OutboundCallbackController;
