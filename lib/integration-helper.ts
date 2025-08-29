import { SupabaseClient } from '@supabase/supabase-js'
import { Channel } from '../schemas/message'
import { IntegrationSecurityService } from '../services/integration-security.service'
import { AppError } from './errors'

export interface IntegrationCredentials {
  id: number
  companyId: string
  channel: Channel
  apiKey?: string // Descriptografado
  webhookSecret: string // Descriptografado
  status: 'active' | 'inactive'
  metadata: Record<string, any>
  createdAt: string
  updatedAt: string
}

export interface EncryptedIntegration {
  id: number
  company_id: number
  channel: Channel
  api_key?: string // Criptografado
  webhook_secret: string // Criptografado
  status: 'active' | 'inactive'
  metadata: Record<string, any>
  created_at: string
  updated_at: string
}

/**
 * Helper para buscar e gerenciar credenciais de integração
 * Abstrai a lógica de criptografia/descriptografia e consultas ao banco
 */
export class IntegrationHelper {
  private securityService: IntegrationSecurityService
  private supabase: SupabaseClient

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase
    this.securityService = new IntegrationSecurityService()
  }

  /**
   * Busca credenciais de integração por empresa e canal
   * Retorna dados descriptografados prontos para uso
   */
  async getIntegrationCredentials(
    companyId: string, 
    channel: Channel
  ): Promise<IntegrationCredentials | null> {
    try {
      const { data: integration, error } = await this.supabase
        .from('integrations')
        .select('*')
        .eq('company_id', companyId)
        .eq('channel', channel)
        .eq('status', 'active')
        .single()

      if (error || !integration) {
        return null
      }

      return this.decryptIntegration(integration as EncryptedIntegration)
    } catch (error) {
      console.error(`Error fetching integration credentials for company ${companyId}, channel ${channel}:`, error)
      throw new AppError(500, 'Failed to retrieve integration credentials')
    }
  }

  /**
   * Busca todas as integrações ativas de uma empresa
   */
  async getCompanyIntegrations(companyId: string): Promise<IntegrationCredentials[]> {
    try {
      const { data: integrations, error } = await this.supabase
        .from('integrations')
        .select('*')
        .eq('company_id', companyId)
        .eq('status', 'active')
        .order('channel')

      if (error) {
        throw error
      }

      if (!integrations || integrations.length === 0) {
        return []
      }

      return integrations.map(integration => 
        this.decryptIntegration(integration as EncryptedIntegration)
      )
    } catch (error) {
      console.error(`Error fetching company integrations for ${companyId}:`, error)
      throw new AppError(500, 'Failed to retrieve company integrations')
    }
  }

  /**
   * Valida se uma integração existe e está ativa
   */
  async validateIntegration(companyId: string, channel: Channel): Promise<boolean> {
    try {
      const credentials = await this.getIntegrationCredentials(companyId, channel)
      return credentials !== null && credentials.status === 'active'
    } catch {
      return false
    }
  }

  /**
   * Busca webhook secret específico para validação
   * Método otimizado para autenticação de webhooks
   */
  async getWebhookSecret(companyId: string, channel: Channel): Promise<string | null> {
    try {
      const { data: integration, error } = await this.supabase
        .from('integrations')
        .select('webhook_secret')
        .eq('company_id', companyId)
        .eq('channel', channel)
        .eq('status', 'active')
        .single()

      if (error || !integration) {
        return null
      }

      return this.securityService.decrypt(integration.webhook_secret, companyId)
    } catch (error) {
      console.error(`Error fetching webhook secret for company ${companyId}, channel ${channel}:`, error)
      return null
    }
  }

  /**
   * Cria ou atualiza uma integração com credenciais criptografadas
   */
  async upsertIntegration(
    companyId: string,
    channel: Channel,
    credentials: {
      apiKey?: string
      webhookSecret?: string
      status?: 'active' | 'inactive'
      metadata?: Record<string, any>
    }
  ): Promise<IntegrationCredentials> {
    try {
      const encryptedData: any = {
        company_id: companyId,
        channel,
        status: credentials.status || 'active',
        metadata: credentials.metadata || {},
        updated_at: new Date().toISOString()
      }

      // Criptografar credenciais se fornecidas
      if (credentials.apiKey) {
        encryptedData.api_key = this.securityService.encrypt(credentials.apiKey, companyId)
      }

      if (credentials.webhookSecret) {
        encryptedData.webhook_secret = this.securityService.encrypt(credentials.webhookSecret, companyId)
      } else {
        // Gerar novo webhook secret se não fornecido
        const newSecret = this.securityService.generateWebhookSecret(companyId, channel)
        encryptedData.webhook_secret = this.securityService.encrypt(newSecret, companyId)
      }

      const { data: integration, error } = await this.supabase
        .from('integrations')
        .upsert(encryptedData, { 
          onConflict: 'company_id,channel',
          ignoreDuplicates: false 
        })
        .select()
        .single()

      if (error) {
        throw error
      }

      return this.decryptIntegration(integration as EncryptedIntegration)
    } catch (error) {
      console.error(`Error upserting integration for company ${companyId}, channel ${channel}:`, error)
      throw new AppError(500, 'Failed to save integration credentials')
    }
  }

  /**
   * Desativa uma integração (soft delete)
   */
  async deactivateIntegration(companyId: string, channel: Channel): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('integrations')
        .update({ 
          status: 'inactive',
          updated_at: new Date().toISOString()
        })
        .eq('company_id', companyId)
        .eq('channel', channel)

      return !error
    } catch (error) {
      console.error(`Error deactivating integration for company ${companyId}, channel ${channel}:`, error)
      return false
    }
  }

  /**
   * Reativa uma integração
   */
  async activateIntegration(companyId: string, channel: Channel): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('integrations')
        .update({ 
          status: 'active',
          updated_at: new Date().toISOString()
        })
        .eq('company_id', companyId)
        .eq('channel', channel)

      return !error
    } catch (error) {
      console.error(`Error activating integration for company ${companyId}, channel ${channel}:`, error)
      return false
    }
  }

  /**
   * Rotaciona o webhook secret de uma integração
   */
  async rotateWebhookSecret(companyId: string, channel: Channel): Promise<string | null> {
    try {
      const newSecret = this.securityService.generateWebhookSecret(companyId, channel)
      const encryptedSecret = this.securityService.encrypt(newSecret, companyId)

      const { error } = await this.supabase
        .from('integrations')
        .update({ 
          webhook_secret: encryptedSecret,
          updated_at: new Date().toISOString()
        })
        .eq('company_id', companyId)
        .eq('channel', channel)

      if (error) {
        throw error
      }

      return newSecret
    } catch (error) {
      console.error(`Error rotating webhook secret for company ${companyId}, channel ${channel}:`, error)
      return null
    }
  }

  /**
   * Busca credenciais específicas da empresa (sistema multi-tenant puro)
   * Cada empresa DEVE ter suas próprias credenciais configuradas
   */
  async getCompanyCredentials(
    companyId: string, 
    channel: Channel
  ): Promise<{ webhookSecret: string; apiKey?: string } | null> {
    const integration = await this.getIntegrationCredentials(companyId, channel)
    
    if (!integration) {
      console.error(`No integration found for company ${companyId}, channel ${channel}. Please configure integration first via admin panel.`)
      return null
    }

    return {
      webhookSecret: integration.webhookSecret,
      apiKey: integration.apiKey
    }
  }

  /**
   * Descriptografa uma integração do banco para uso interno
   */
  private decryptIntegration(encrypted: EncryptedIntegration): IntegrationCredentials {
    const companyId = encrypted.company_id.toString()
    
    return {
      id: encrypted.id,
      companyId,
      channel: encrypted.channel,
      apiKey: encrypted.api_key ? this.securityService.decrypt(encrypted.api_key, companyId) : undefined,
      webhookSecret: this.securityService.decrypt(encrypted.webhook_secret, companyId),
      status: encrypted.status,
      metadata: encrypted.metadata || {},
      createdAt: encrypted.created_at,
      updatedAt: encrypted.updated_at
    }
  }
}
