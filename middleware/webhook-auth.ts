import { Request, Response, NextFunction } from 'express'
import crypto from 'crypto'
import { AppError } from '../lib/errors'
import { IntegrationHelper } from '../lib/integration-helper'
import { getSupabaseClient } from '../lib/db-helpers'
import { Channel } from '../schemas/message'

export interface WebhookAuthConfig {
  secret: string;
  headerName?: string;
  algorithm?: string;
}

/**
 * Middleware para validar assinatura HMAC em webhooks
 * Protege contra requisições não autorizadas
 */
export function webhookAuth(config: WebhookAuthConfig) {
  const {
    secret,
    headerName = 'x-webhook-signature',
    algorithm = 'sha256'
  } = config

  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Obter assinatura do header
      const signature = req.get(headerName)
      if (!signature) {
        throw new AppError(401, 'Missing webhook signature')
      }

      // Obter o corpo da requisição como string
      let body: string
      if (typeof req.body === 'string') {
        body = req.body
      } else if (req.body && typeof req.body === 'object') {
        body = JSON.stringify(req.body)
      } else {
        throw new AppError(400, 'Invalid request body')
      }

      // Calcular assinatura esperada
      const expectedSignature = crypto
        .createHmac(algorithm, secret)
        .update(body, 'utf8')
        .digest('hex')

      // Formato esperado: sha256=<hash>
      const expectedHeader = `${algorithm}=${expectedSignature}`

      // Comparação segura contra timing attacks
      const isValid = crypto.timingSafeEqual(
        Buffer.from(signature, 'utf8'),
        Buffer.from(expectedHeader, 'utf8')
      )

      if (!isValid) {
        throw new AppError(401, 'Invalid webhook signature')
      }

      next()
    } catch (error) {
      console.error('Webhook authentication failed:', error)
      
      if (error instanceof AppError) {
        return res.status(error.statusCode).json({
          success: false,
          error: error.message
        })
      }

      return res.status(500).json({
        success: false,
        error: 'Internal server error during authentication'
      })
    }
  }
}

/**
 * Middleware simplificado para validação apenas com secret (token)
 * Para casos onde não há necessidade de HMAC completo
 */
export function simpleTokenAuth(expectedToken: string, headerName = 'x-webhook-token') {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = req.get(headerName)
      
      if (!token) {
        throw new AppError(401, 'Missing webhook token')
      }

      if (token !== expectedToken) {
        throw new AppError(401, 'Invalid webhook token')
      }

      next()
    } catch (error) {
      console.error('Webhook token authentication failed:', error)
      
      if (error instanceof AppError) {
        return res.status(error.statusCode).json({
          success: false,
          error: error.message
        })
      }

      return res.status(500).json({
        success: false,
        error: 'Internal server error during token authentication'
      })
    }
  }
}

/**
 * Middleware dinâmico que busca credenciais por empresa
 * Substitui o middleware estático em produção
 */
export function dynamicWebhookAuth(channel: Channel) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Obter payload para extrair company_id
      let payload: any
      if (req.body && typeof req.body === 'object') {
        payload = req.body
      } else if (req.body && Buffer.isBuffer(req.body)) {
        try {
          payload = JSON.parse(req.body.toString())
        } catch {
          throw new AppError(400, 'Invalid JSON in request body')
        }
      } else {
        throw new AppError(400, 'Missing request body')
      }

      const companyId = payload.company_id
      if (!companyId) {
        throw new AppError(400, 'Missing company_id in payload')
      }

      // Verificar se o canal do payload corresponde à rota
      if (payload.channel && payload.channel !== channel) {
        throw new AppError(400, `Channel mismatch. Expected ${channel}, got ${payload.channel}`)
      }

      // Buscar credenciais específicas da empresa (sistema multi-tenant puro)
      const integrationHelper = new IntegrationHelper(getSupabaseClient())
      const credentials = await integrationHelper.getCompanyCredentials(companyId, channel)

      if (!credentials) {
        throw new AppError(401, `No valid credentials found for company ${companyId} and channel ${channel}`)
      }

      // Validar assinatura HMAC
      const signature = req.get('x-webhook-signature')
      if (!signature) {
        throw new AppError(401, 'Missing webhook signature')
      }

      const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
      const expectedSignature = crypto
        .createHmac('sha256', credentials.webhookSecret)
        .update(body, 'utf8')
        .digest('hex')

      const expectedHeader = `sha256=${expectedSignature}`

      // Comparação segura contra timing attacks
      // Garantir que os buffers tenham o mesmo tamanho
      const signatureBuffer = Buffer.from(signature, 'utf8')
      const expectedBuffer = Buffer.from(expectedHeader, 'utf8')
      
      if (signatureBuffer.length !== expectedBuffer.length) {
        throw new AppError(401, 'Invalid webhook signature')
      }
      
      const isValid = crypto.timingSafeEqual(signatureBuffer, expectedBuffer)

      if (!isValid) {
        throw new AppError(401, 'Invalid webhook signature')
      }

      // Anexar informações da integração à request para uso posterior
      req.integration = {
        companyId,
        channel,
        credentials
      }

      next()
    } catch (error) {
      console.error(`Dynamic webhook authentication failed for channel ${channel}:`, error)
      
      if (error instanceof AppError) {
        return res.status(error.statusCode).json({
          success: false,
          error: error.message
        })
      }

      return res.status(500).json({
        success: false,
        error: 'Internal server error during authentication'
      })
    }
  }
}

/**
 * Middleware de autenticação pura (removido fallback híbrido)
 * Sistema multi-tenant - cada empresa deve ter integração configurada
 */

/**
 * Helper para gerar assinatura HMAC (útil para testes)
 */
export function generateWebhookSignature(
  payload: string | object,
  secret: string,
  algorithm = 'sha256'
): string {
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload)
  const signature = crypto
    .createHmac(algorithm, secret)
    .update(body, 'utf8')
    .digest('hex')
  
  return `${algorithm}=${signature}`
}
