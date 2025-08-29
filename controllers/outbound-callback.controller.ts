import { Request, Response } from 'express'
import { SupabaseClient } from '@supabase/supabase-js'
import { BaseController } from './base'
import { AppError } from '../lib/errors'
import { MessageStatus } from '../schemas/message'
import { z } from 'zod'

// Schema para validação do callback do n8n
const callbackSchema = z.object({
  interaction_id: z.number().int().positive(),
  company_id: z.string().min(1), // Necessário para isolamento multi-tenant
  status: z.nativeEnum(MessageStatus),
  error_message: z.string().optional(),
  delivered_at: z.string().datetime().optional(),
  read_at: z.string().datetime().optional(),
  external_message_id: z.string().optional(), // ID da mensagem no canal (WhatsApp, Instagram)
  metadata: z.record(z.unknown()).optional()
})

export class OutboundCallbackController extends BaseController {
  constructor(supabase?: SupabaseClient) {
    super('interactions', supabase)
  }

  /**
   * POST /webhooks/outbound-callback
   * Endpoint para n8n reportar status de entrega das mensagens
   * Rota pública mas com autenticação via secret compartilhado
   */
  async handleCallback(req: Request, res: Response) {
    try {
      // Validar payload
      const validatedData = callbackSchema.parse(req.body)
      const { interaction_id, company_id, status, error_message, delivered_at, read_at, external_message_id, metadata } = validatedData

      // Criar request com tenant scope para usar helpers do BaseController
      const tenantReq = this.createTenantRequest(req, company_id)

      // Verificar se a interaction existe e pertence à empresa
      const { data: interaction, error: fetchError } = await this.getSupabase(tenantReq)
        .from('interactions')
        .select('id, status, direction, conversation_id')
        .eq('id', interaction_id)
        .eq('company_id', company_id)
        .eq('direction', 'outbound') // Só atualizamos interactions outbound
        .single()

      if (fetchError || !interaction) {
        throw new AppError(404, `Interaction ${interaction_id} not found for company ${company_id}`)
      }

      // Preparar dados para atualização
      const updateData: any = {
        status,
        updated_at: new Date().toISOString()
      }

      // Adicionar timestamps específicos conforme o status
      if (status === MessageStatus.DELIVERED && delivered_at) {
        updateData.delivered_at = delivered_at
      }
      
      if (status === MessageStatus.READ && read_at) {
        updateData.read_at = read_at
      }

      // Adicionar metadata se fornecido
      if (metadata || external_message_id) {
        updateData.metadata = {
          ...(interaction.metadata || {}),
          ...(metadata || {}),
          ...(external_message_id && { external_message_id })
        }
      }

      // Se houve erro, adicionar detalhes
      if (status === MessageStatus.FAILED && error_message) {
        updateData.metadata = {
          ...(updateData.metadata || {}),
          error_message,
          failed_at: new Date().toISOString()
        }
      }

      // Atualizar a interaction
      const { error: updateError } = await this.getSupabase(tenantReq)
        .from('interactions')
        .update(updateData)
        .eq('id', interaction_id)
        .eq('company_id', company_id)

      if (updateError) {
        throw new AppError(500, `Failed to update interaction: ${updateError.message}`)
      }

      console.log(`Interaction ${interaction_id} status updated to ${status} for company ${company_id}`)

      return res.status(200).json({
        success: true,
        interaction_id,
        status,
        message: 'Status updated successfully'
      })

    } catch (error) {
      console.error('Outbound callback error:', error)

      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Invalid payload format',
          details: error.errors
        })
      }

      if (error instanceof AppError) {
        return res.status(error.statusCode).json({
          success: false,
          error: error.message
        })
      }

      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      })
    }
  }

  /**
   * Cria uma request fake com tenant scope para reutilizar métodos do BaseController
   */
  private createTenantRequest(originalReq: Request, companyId: string): Request {
    return {
      ...originalReq,
      tenant: { company_id: companyId },
      supabase: this.supabase || originalReq.supabase
    } as Request
  }
}
