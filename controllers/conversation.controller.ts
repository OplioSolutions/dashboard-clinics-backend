import { Request, Response } from 'express'
import { SupabaseClient } from '@supabase/supabase-js'
import { BaseController } from './base'
import { AppError } from '../lib/errors'
import { Channel, MessageType, MessageDirection, MessageStatus } from '../schemas/message'
import { ChannelSelector } from '../services/channel-selector'

export class ConversationController extends BaseController {
  private channelSelector: ChannelSelector;

  constructor(supabase?: SupabaseClient) {
    super('conversation_threads', supabase)
    this.channelSelector = new ChannelSelector(supabase || {} as SupabaseClient, '')
  }

  // POST /api/conversations/start
  async startConversation(req: Request, res: Response) {
    return this.handleRequest(req, res, async () => {
      const { client_id, initial_message, channel } = req.body

      // Verificar se já existe conversa ativa
      const { data: activeConversation } = await this.getSupabase(req)
        .from(this.tableName)
        .select('*')
        .eq('company_id', this.getTenantId(req))
        .eq('client_id', client_id)
        .eq('status', 'active')
        .single()

      if (activeConversation) {
        // Se tem mensagem inicial, adiciona à conversa existente
        if (initial_message) {
          await this.getSupabase(req)
            .from('interactions')
            .insert({
              company_id: req.tenant!.company_id,
              client_id,
              conversation_id: activeConversation.id,
              channel: channel || Channel.WHATSAPP,
              direction: MessageDirection.INBOUND,
              message: initial_message,
              status: MessageStatus.DELIVERED,
              timestamp: new Date().toISOString(),
              type: MessageType.GENERAL
            })
        }

        return res.json(activeConversation)
      }

      // Criar nova conversa
      const newConversation = {
        company_id: req.tenant!.company_id,
        client_id,
        started_at: new Date().toISOString(),
        channels_used: channel ? [channel] : [Channel.WHATSAPP],
        status: 'active',
        assignment_status: 'unassigned'
      }

      const { data: conversation, error } = await this.getSupabase(req)
        .from(this.tableName)
        .insert(newConversation)
        .select()
        .single()

      if (error) throw error

      // Se tem mensagem inicial, criar primeira interação
      if (initial_message) {
        await this.getSupabase(req)
          .from('interactions')
          .insert({
            company_id: req.tenant!.company_id,
            client_id,
            conversation_id: conversation.id,
            channel: channel || Channel.WHATSAPP,
            direction: MessageDirection.INBOUND,
            message: initial_message,
            status: MessageStatus.DELIVERED,
            timestamp: new Date().toISOString(),
            type: MessageType.GENERAL
          })
      }

      return res.status(201).json(conversation)
    })
  }

  // PATCH /api/conversations/:id/close
  async closeConversation(req: Request, res: Response) {
    return this.handleRequest(req, res, async () => {
      const { id } = req.params

      const { data: conversation, error } = await this.getSupabase(req)
        .from(this.tableName)
        .update({
          status: 'closed',
          ended_at: new Date().toISOString()
        })
        .eq('company_id', this.getTenantId(req))
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      if (!conversation) throw new AppError(404, 'Conversation not found')

      return res.json(conversation)
    })
  }

  // GET /api/conversations?client_id=...
  async listConversations(req: Request, res: Response) {
    return this.handleRequest(req, res, async () => {
      const { client_id } = req.query
      const query = this.getSupabase(req)
        .from(this.tableName)
        .select(`
          *,
          client:clients(id, name),
          assigned_user:users(id, name),
          last_interaction:interactions(
            message,
            channel,
            timestamp,
            direction,
            status
          )
        `)
        .eq('company_id', this.getTenantId(req))

      if (client_id) {
        query.eq('client_id', client_id)
      }

      const { data, error } = await query.order('updated_at', { ascending: false })
      if (error) throw error

      return res.json(data)
    })
  }

  // GET /api/conversations/:id
  async getConversation(req: Request, res: Response) {
    return this.handleRequest(req, res, async () => {
      const { id } = req.params
      const { page = 1, limit = 50 } = req.query

      // Buscar conversa com informações básicas
      const { data: conversation, error: conversationError } = await this.getSupabase(req)
        .from(this.tableName)
        .select(`
          *,
          client:clients(id, name, phone, email),
          assigned_user:users(id, name)
        `)
        .eq('company_id', this.getTenantId(req))
        .eq('id', id)
        .single()

      if (conversationError || !conversation) {
        throw new AppError(404, 'Conversation not found')
      }

      // Buscar mensagens paginadas
      const offset = (Number(page) - 1) * Number(limit)
      const { data: messages, error: messagesError } = await this.getSupabase(req)
        .from('interactions')
        .select('*')
        .eq('conversation_id', id)
        .eq('company_id', req.tenant!.company_id)
        .order('timestamp', { ascending: false })
        .range(offset, offset + Number(limit) - 1)

      if (messagesError) throw messagesError

      return res.json({
        ...conversation,
        messages: messages || []
      })
    })
  }
}