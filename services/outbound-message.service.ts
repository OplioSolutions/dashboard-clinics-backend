import { Channel } from '../schemas/message'
import { IntegrationHelper } from '../lib/integration-helper'
import { getSupabaseClient } from '../lib/db-helpers'
import { AppError } from '../lib/errors'

export interface OutboundMessagePayload {
  companyId: string
  channel: Channel
  clientContact: string
  message: string
  interactionId: number
}

export interface N8nOutboundPayload {
  company_id: string
  channel: Channel
  client_contact: string
  message: string
  interaction_id: number
  timestamp: string
  metadata?: {
    [key: string]: any
  }
}

export class OutboundMessageService {
  private integrationHelper: IntegrationHelper

  constructor() {
    this.integrationHelper = new IntegrationHelper(getSupabaseClient())
  }

  /**
   * Envia mensagem via webhook do n8n
   */
  async sendMessage(payload: OutboundMessagePayload): Promise<void> {
    const { companyId, channel, clientContact, message, interactionId } = payload

    try {
      // 1. Buscar credenciais da empresa para o canal
      const credentials = await this.integrationHelper.getCompanyCredentials(companyId, channel)
      
      if (!credentials) {
        throw new AppError(404, `No credentials found for company ${companyId} and channel ${channel}`)
      }

      // 2. Preparar payload para n8n
      const n8nPayload: N8nOutboundPayload = {
        company_id: companyId,
        channel,
        client_contact: clientContact,
        message,
        interaction_id: interactionId,
        timestamp: new Date().toISOString(),
        metadata: {
          // Incluir metadados específicos do canal se necessário
          api_key: credentials.apiKey // n8n precisará da api_key para enviar
        }
      }

      // 3. Obter URL do webhook n8n (placeholder - será configurável)
      const webhookUrl = this.getN8nWebhookUrl()

      // 4. Enviar requisição para n8n
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-webhook-source': 'dashboard-backend',
          // Adicionar autenticação se necessário
          ...(this.getN8nAuthHeaders())
        },
        body: JSON.stringify(n8nPayload)
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new AppError(
          response.status, 
          `n8n webhook failed: ${response.status} ${response.statusText} - ${errorText}`
        )
      }

      console.log(`Message sent successfully via n8n for interaction ${interactionId}`)
      
    } catch (error) {
      console.error(`Failed to send message via n8n:`, error)
      throw error
    }
  }

  /**
   * Obtém URL do webhook n8n para envio de mensagens
   * TODO: Tornar configurável por empresa ou via env vars
   */
  private getN8nWebhookUrl(): string {
    // Por enquanto usar env var, mas pode ser configurável por empresa no futuro
    const baseUrl = process.env.N8N_OUTBOUND_WEBHOOK_URL || 'http://localhost:5678/webhook/send-message'
    return baseUrl
  }

  /**
   * Headers de autenticação para n8n se necessário
   */
  private getN8nAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {}

    // Se n8n require autenticação por token
    const authToken = process.env.N8N_AUTH_TOKEN
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`
    }

    // Se n8n require secret específico
    const webhookSecret = process.env.N8N_WEBHOOK_SECRET
    if (webhookSecret) {
      headers['x-webhook-secret'] = webhookSecret
    }

    return headers
  }

  /**
   * Método para testar conectividade com n8n
   */
  async testConnection(): Promise<boolean> {
    try {
      const testUrl = this.getN8nWebhookUrl().replace('/send-message', '/health')
      
      const response = await fetch(testUrl, {
        method: 'GET',
        headers: this.getN8nAuthHeaders()
      })

      return response.ok
    } catch (error) {
      console.error('n8n connection test failed:', error)
      return false
    }
  }
}
