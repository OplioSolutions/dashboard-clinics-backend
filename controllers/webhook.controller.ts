import { Request, Response } from 'express'
import { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { BaseController } from './base'
import { AppError } from '../lib/errors'
import { Channel, MessageType, MessageDirection, MessageStatus } from '../schemas/message'
import { ConversationController } from './conversation.controller'
import { InteractionController } from './interaction.controller'

// Schema para validar o payload normalizado do n8n
const webhookPayloadSchema = z.object({
  company_id: z.string().uuid(),
  channel: z.nativeEnum(Channel),
  external_id: z.string().min(1),
  message: z.object({
    type: z.enum(['text', 'image', 'audio']),
    content: z.string().min(1)
  }),
  timestamp: z.string().datetime()
})

export class WebhookController extends BaseController {
  private conversationController: ConversationController
  private interactionController: InteractionController

  constructor(supabase?: SupabaseClient) {
    super('clients', supabase)
    this.conversationController = new ConversationController(supabase)
    this.interactionController = new InteractionController(supabase)
  }

  // POST /webhooks/whatsapp
  async handleWhatsApp(req: Request, res: Response) {
    return this.processWebhook(req, res, Channel.WHATSAPP)
  }

  // POST /webhooks/instagram
  async handleInstagram(req: Request, res: Response) {
    return this.processWebhook(req, res, Channel.INSTAGRAM)
  }

  private async processWebhook(req: Request, res: Response, expectedChannel: Channel) {
    try {
      // Validar payload
      const payload = webhookPayloadSchema.parse(req.body)
      
      // Verificar se o canal corresponde à rota
      if (payload.channel !== expectedChannel) {
        throw new AppError(400, `Channel mismatch. Expected ${expectedChannel}, got ${payload.channel}`)
      }

      // Usar informações da integração validada pelo middleware
      const companyId = req.integration?.companyId || payload.company_id
      
      // Criar uma fake request com tenant para usar os controllers existentes
      const tenantReq = this.createTenantRequest(req, companyId)

      // 1. Identificar ou criar cliente
      const client = await this.findOrCreateClient(tenantReq, payload)

      // 2. Verificar/criar conversa ativa
      const conversation = await this.findOrCreateActiveConversation(tenantReq, client.id, payload.channel)

      // 3. Criar interação
      await this.createInboundInteraction(tenantReq, conversation.id, client.id, payload)

      return res.status(200).json({ 
        success: true, 
        conversation_id: conversation.id,
        client_id: client.id 
      })

    } catch (error) {
      console.error(`Webhook ${expectedChannel} error:`, error)
      
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

  private createTenantRequest(originalReq: Request, companyId: string): Request {
    // Criar uma request modificada com tenant info para usar controllers existentes
    const tenantReq = {
      ...originalReq,
      tenant: {
        company_id: companyId,
        user_id: 'webhook-system', // ID especial para identificar requisições via webhook
        role: 'system'
      }
    } as Request

    return tenantReq
  }

  private async findOrCreateClient(req: Request, payload: any) {
    const { external_id, channel } = payload

    // Buscar cliente existente baseado no identificador do canal
    let whereClause = {}
    if (channel === Channel.WHATSAPP) {
      whereClause = { phone: external_id }
    } else if (channel === Channel.INSTAGRAM) {
      // Para Instagram, vamos armazenar o handle no campo notes por enquanto
      // até termos uma migração que adicione o campo instagram_handle
      whereClause = { notes: `Instagram: ${external_id}` }
    }

    const { data: existingClient } = await this.getSupabase(req)
      .from('clients')
      .select('*')
      .eq('company_id', req.tenant!.company_id)
      .match(whereClause)
      .single()

    if (existingClient) {
      return existingClient
    }

    // Criar cliente lead automático
    const leadData: any = {
      company_id: req.tenant!.company_id,
      full_name: 'Lead Automático', // Campo correto conforme schema
    }

    if (channel === Channel.WHATSAPP) {
      leadData.phone = external_id
    } else if (channel === Channel.INSTAGRAM) {
      // Armazenar handle no campo notes por enquanto
      leadData.notes = `Instagram: ${external_id}`
    }

    const { data: newClient, error } = await this.getSupabase(req)
      .from('clients')
      .insert(leadData)
      .select()
      .single()

    if (error) {
      throw new AppError(500, `Failed to create client: ${error.message}`)
    }

    return newClient
  }

  private async findOrCreateActiveConversation(req: Request, clientId: string, channel: Channel) {
    // Buscar conversa ativa existente
    const { data: activeConversation } = await this.getSupabase(req)
      .from('conversation_threads')
      .select('*')
      .eq('company_id', req.tenant!.company_id)
      .eq('client_id', clientId)
      .eq('status', 'active')
      .single()

    if (activeConversation) {
      // Verificar janela de 24h para reabertura
      const lastUpdate = new Date(activeConversation.updated_at || activeConversation.started_at)
      const now = new Date()
      const hoursDiff = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60)

      if (hoursDiff < 24) {
        // Conversa ainda está dentro da janela, usar a existente
        return activeConversation
      } else {
        // Fechar conversa antiga e criar nova
        await this.getSupabase(req)
          .from('conversation_threads')
          .update({
            status: 'closed',
            ended_at: new Date().toISOString()
          })
          .eq('id', activeConversation.id)
      }
    }

    // Criar nova conversa
    const newConversation = {
      company_id: req.tenant!.company_id,
      client_id: clientId,
      started_at: new Date().toISOString(),
      channels_used: [channel],
      status: 'active',
      assignment_status: 'unassigned'
    }

    const { data: conversation, error } = await this.getSupabase(req)
      .from('conversation_threads')
      .insert(newConversation)
      .select()
      .single()

    if (error) {
      throw new AppError(500, `Failed to create conversation: ${error.message}`)
    }

    return conversation
  }

  private async createInboundInteraction(req: Request, conversationId: string, clientId: string, payload: any) {
    const interactionData = {
      company_id: req.tenant!.company_id,
      conversation_id: conversationId,
      client_id: clientId,
      message: payload.message.content,
      channel: payload.channel,
      type: MessageType.GENERAL,
      direction: MessageDirection.INBOUND,
      status: MessageStatus.DELIVERED,
      timestamp: payload.timestamp,
      metadata: {
        message_type: payload.message.type,
        webhook_source: true
      }
    }

    const { data: interaction, error } = await this.getSupabase(req)
      .from('interactions')
      .insert(interactionData)
      .select()
      .single()

    if (error) {
      throw new AppError(500, `Failed to create interaction: ${error.message}`)
    }

    // Atualizar timestamp da conversa
    await this.getSupabase(req)
      .from('conversation_threads')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId)

    return interaction
  }
}
