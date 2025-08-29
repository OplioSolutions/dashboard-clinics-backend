import { Request, Response } from 'express'
import { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { BaseController } from './base'
import { AppError } from '../lib/errors'
import { Channel } from '../schemas/message'
import { IntegrationHelper, IntegrationCredentials } from '../lib/integration-helper'

// Schemas de validação
const integrationCreateSchema = z.object({
  channel: z.nativeEnum(Channel),
  api_key: z.string().optional(),
  webhook_secret: z.string().optional(),
  status: z.enum(['active', 'inactive']).default('active'),
  metadata: z.record(z.unknown()).default({})
})

const integrationUpdateSchema = integrationCreateSchema.partial()

const integrationStatusSchema = z.object({
  status: z.enum(['active', 'inactive'])
})

/**
 * Controller para gerenciar integrações de canais por empresa
 * Usado pelo Painel-ADM para configurar credenciais por clínica
 */
export class IntegrationController extends BaseController {
  private integrationHelper: IntegrationHelper

  constructor(supabase?: SupabaseClient) {
    super('integrations', supabase)
    this.integrationHelper = new IntegrationHelper(supabase || this.supabase)
  }

  // GET /api/integrations
  async listIntegrations(req: Request, res: Response) {
    return this.handleRequest(req, res, async () => {
      const companyId = this.getTenantId(req)
      
      const integrations = await this.integrationHelper.getCompanyIntegrations(companyId)
      
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
      }))

      return res.json(sanitizedIntegrations)
    })
  }

  // GET /api/integrations/:channel
  async getIntegration(req: Request, res: Response) {
    return this.handleRequest(req, res, async () => {
      const { channel } = req.params
      const companyId = this.getTenantId(req)

      if (!Object.values(Channel).includes(channel as Channel)) {
        throw new AppError(400, 'Invalid channel')
      }

      const integration = await this.integrationHelper.getIntegrationCredentials(
        companyId, 
        channel as Channel
      )

      if (!integration) {
        throw new AppError(404, 'Integration not found')
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
      }

      return res.json(sanitizedIntegration)
    })
  }

  // POST /api/integrations
  async createIntegration(req: Request, res: Response) {
    return this.handleRequest(req, res, async () => {
      // Apenas admins podem criar/gerenciar integrações
      if (req.user?.role !== 'admin') {
        throw new AppError(403, 'Only admins can manage integrations')
      }

      const data = integrationCreateSchema.parse(req.body)
      const companyId = this.getTenantId(req)

      // Verificar se já existe integração para este canal
      const existing = await this.integrationHelper.getIntegrationCredentials(
        companyId,
        data.channel
      )

      if (existing) {
        throw new AppError(409, `Integration for channel ${data.channel} already exists. Use PUT to update.`)
      }

      const integration = await this.integrationHelper.upsertIntegration(
        companyId,
        data.channel,
        {
          apiKey: data.api_key,
          webhookSecret: data.webhook_secret,
          status: data.status,
          metadata: data.metadata
        }
      )

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
      }

      return res.status(201).json(sanitizedIntegration)
    })
  }

  // PUT /api/integrations/:channel
  async updateIntegration(req: Request, res: Response) {
    return this.handleRequest(req, res, async () => {
      // Apenas admins podem criar/gerenciar integrações
      if (req.user?.role !== 'admin') {
        throw new AppError(403, 'Only admins can manage integrations')
      }

      const { channel } = req.params
      const data = integrationUpdateSchema.parse(req.body)
      const companyId = this.getTenantId(req)

      if (!Object.values(Channel).includes(channel as Channel)) {
        throw new AppError(400, 'Invalid channel')
      }

      // Verificar se integração existe
      const existing = await this.integrationHelper.getIntegrationCredentials(
        companyId,
        channel as Channel
      )

      if (!existing) {
        throw new AppError(404, 'Integration not found')
      }

      const integration = await this.integrationHelper.upsertIntegration(
        companyId,
        channel as Channel,
        {
          apiKey: data.api_key,
          webhookSecret: data.webhook_secret,
          status: data.status,
          metadata: data.metadata
        }
      )

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
      }

      return res.json(sanitizedIntegration)
    })
  }

  // PATCH /api/integrations/:channel/status
  async updateIntegrationStatus(req: Request, res: Response) {
    return this.handleRequest(req, res, async () => {
      // Apenas admins podem gerenciar status
      if (req.user?.role !== 'admin') {
        throw new AppError(403, 'Only admins can manage integrations')
      }

      const { channel } = req.params
      const { status } = integrationStatusSchema.parse(req.body)
      const companyId = this.getTenantId(req)

      if (!Object.values(Channel).includes(channel as Channel)) {
        throw new AppError(400, 'Invalid channel')
      }

      let success = false
      if (status === 'active') {
        success = await this.integrationHelper.activateIntegration(companyId, channel as Channel)
      } else {
        success = await this.integrationHelper.deactivateIntegration(companyId, channel as Channel)
      }

      if (!success) {
        throw new AppError(500, 'Failed to update integration status')
      }

      return res.json({ success: true, status })
    })
  }

  // POST /api/integrations/:channel/rotate-secret
  async rotateWebhookSecret(req: Request, res: Response) {
    return this.handleRequest(req, res, async () => {
      // Apenas admins podem rotacionar secrets
      if (req.user?.role !== 'admin') {
        throw new AppError(403, 'Only admins can manage integrations')
      }

      const { channel } = req.params
      const companyId = this.getTenantId(req)

      if (!Object.values(Channel).includes(channel as Channel)) {
        throw new AppError(400, 'Invalid channel')
      }

      const newSecret = await this.integrationHelper.rotateWebhookSecret(
        companyId, 
        channel as Channel
      )

      if (!newSecret) {
        throw new AppError(500, 'Failed to rotate webhook secret')
      }

      return res.json({ 
        success: true, 
        message: 'Webhook secret rotated successfully',
        newSecret // Retornar o novo secret para configuração no n8n
      })
    })
  }

  // DELETE /api/integrations/:channel
  async deleteIntegration(req: Request, res: Response) {
    return this.handleRequest(req, res, async () => {
      // Apenas admins podem deletar integrações
      if (req.user?.role !== 'admin') {
        throw new AppError(403, 'Only admins can manage integrations')
      }

      const { channel } = req.params
      const companyId = this.getTenantId(req)

      if (!Object.values(Channel).includes(channel as Channel)) {
        throw new AppError(400, 'Invalid channel')
      }

      // Soft delete: apenas desativar
      const success = await this.integrationHelper.deactivateIntegration(
        companyId, 
        channel as Channel
      )

      if (!success) {
        throw new AppError(500, 'Failed to delete integration')
      }

      return res.json({ success: true, message: 'Integration deleted successfully' })
    })
  }

  // GET /api/integrations/test/:channel
  async testIntegration(req: Request, res: Response) {
    return this.handleRequest(req, res, async () => {
      const { channel } = req.params
      const companyId = this.getTenantId(req)

      if (!Object.values(Channel).includes(channel as Channel)) {
        throw new AppError(400, 'Invalid channel')
      }

      const isValid = await this.integrationHelper.validateIntegration(
        companyId,
        channel as Channel
      )

      return res.json({
        channel,
        companyId,
        isValid,
        status: isValid ? 'active' : 'invalid',
        message: isValid 
          ? 'Integration is properly configured and active'
          : 'Integration is not properly configured or inactive'
      })
    })
  }

  // GET /api/integrations/available-channels
  async getAvailableChannels(req: Request, res: Response) {
    return this.handleRequest(req, res, async () => {
      const channels = Object.values(Channel).map(channel => ({
        id: channel,
        name: channel.charAt(0).toUpperCase() + channel.slice(1),
        description: this.getChannelDescription(channel)
      }))

      return res.json(channels)
    })
  }

  private getChannelDescription(channel: Channel): string {
    const descriptions = {
      [Channel.WHATSAPP]: 'WhatsApp Business API integration for messaging',
      [Channel.INSTAGRAM]: 'Instagram Business API integration for direct messages'
    }

    return descriptions[channel] || 'Channel integration'
  }
}
