import { Request, Response } from 'express'
import { SupabaseClient } from '@supabase/supabase-js'
import { BaseController } from './base'
import { AppError } from '../lib/errors'
import { Channel, MessageType, MessageDirection, MessageStatus } from '../schemas/message'
import { ChannelSelector } from '../services/channel-selector'

export class InteractionController extends BaseController {
  private channelSelector: ChannelSelector;

  constructor(supabase?: SupabaseClient) {
    super('interactions', supabase)
    this.channelSelector = new ChannelSelector(supabase || {} as SupabaseClient, '')
  }

  // POST /api/interactions
  async createInteraction(req: Request, res: Response) {
    return this.handleRequest(req, res, async () => {
      const {
        conversation_id,
        client_id,
        message,
        channel,
        type = MessageType.GENERAL,
        direction = MessageDirection.OUTBOUND,
        status = MessageStatus.SENT
      } = req.body

      // Verificar se a conversa existe e está ativa
      const { data: conversation, error: conversationError } = await this.getSupabase(req)
        .from('conversation_threads')
        .select('status, channels_used')
        .eq('id', conversation_id)
        .eq('company_id', req.tenant!.company_id)
        .single()

      if (conversationError || !conversation) {
        throw new AppError(404, 'Conversation not found')
      }

      if (conversation.status === 'closed') {
        throw new AppError(400, 'Cannot add message to closed conversation')
      }

      // Determinar canal apropriado
      const selectedChannel = channel || await this.channelSelector.determineChannel(
        client_id,
        type,
        'human', // TODO: Passar como parâmetro quando tivermos IA
        undefined
      )

      // Criar a interação
      const newInteraction = {
        company_id: req.tenant!.company_id,
        conversation_id,
        client_id,
        message,
        channel: selectedChannel,
        type,
        direction,
        status,
        timestamp: new Date().toISOString()
      }

      const { data: interaction, error } = await this.getSupabase(req)
        .from(this.tableName)
        .insert(newInteraction)
        .select()
        .single()

      if (error) throw error

      // Atualizar channels_used na conversa se necessário
      if (!conversation.channels_used.includes(selectedChannel)) {
        await this.getSupabase(req)
          .from('conversation_threads')
          .update({
            channels_used: [...conversation.channels_used, selectedChannel],
            updated_at: new Date().toISOString()
          })
          .eq('id', conversation_id)
      }

      return res.status(201).json(interaction)
    })
  }

  // PATCH /api/interactions/:id/status
  async updateStatus(req: Request, res: Response) {
    return this.handleRequest(req, res, async () => {
      const { id } = req.params
      const { status } = req.body

      if (!Object.values(MessageStatus).includes(status)) {
        throw new AppError(400, 'Invalid status')
      }

      const { data: interaction, error } = await this.createQuery(req)
        .update({ status })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      if (!interaction) throw new AppError(404, 'Interaction not found')

      return res.json(interaction)
    })
  }

  // GET /api/interactions?conversation_id=...
  async listInteractions(req: Request, res: Response) {
    return this.handleRequest(req, res, async () => {
      const { conversation_id, page = 1, limit = 50 } = req.query
      
      if (!conversation_id) {
        throw new AppError(400, 'conversation_id is required')
      }

      const offset = (Number(page) - 1) * Number(limit)
      const query = this.createQuery(req)
        .select('*')
        .eq('conversation_id', conversation_id)
        .order('timestamp', { ascending: false })
        .range(offset, offset + Number(limit) - 1)

      const { data, error } = await query
      if (error) throw error

      return res.json(data)
    })
  }
}