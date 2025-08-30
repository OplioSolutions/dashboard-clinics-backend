import crypto from 'crypto'
import { AppError } from '../lib/errors'

/**
 * Service responsável pela criptografia/descriptografia de credenciais de integração
 * Cada empresa tem suas credenciais criptografadas com uma chave derivada única
 */
export class IntegrationSecurityService {
  private readonly algorithm = 'aes-256-gcm'
  private readonly keyLength = 32 // 256 bits
  private readonly ivLength = 16  // 128 bits
  private readonly tagLength = 16 // 128 bits
  private readonly saltLength = 32 // 256 bits

  // Master key derivada das variáveis de ambiente
  private getMasterKey(): string {
    const masterKey = process.env.INTEGRATION_MASTER_KEY || process.env.SUPABASE_JWT_SECRET || 'dev-master-key-change-in-production'
    
    if (process.env.NODE_ENV === 'production' && !process.env.INTEGRATION_MASTER_KEY) {
      console.warn('WARNING: Using fallback master key. Set INTEGRATION_MASTER_KEY in production!')
    }
    
    return masterKey
  }

  /**
   * Deriva uma chave específica para a empresa usando PBKDF2
   */
  private deriveCompanyKey(companyId: string, salt: Buffer): Buffer {
    const masterKey = this.getMasterKey()
    const keyMaterial = `${masterKey}:company:${companyId}`
    
    return crypto.pbkdf2Sync(keyMaterial, salt, 100000, this.keyLength, 'sha512')
  }

  /**
   * Criptografa um valor usando a chave específica da empresa
   */
  encrypt(value: string, companyId: string): string {
    try {
      if (!value || !companyId) {
        throw new AppError(400, 'Value and companyId are required for encryption')
      }

      // Gerar salt e IV aleatórios
      const salt = crypto.randomBytes(this.saltLength)
      const iv = crypto.randomBytes(this.ivLength)
      
      // Derivar chave específica da empresa
      const key = this.deriveCompanyKey(companyId, salt)
      
      // Criptografar usando AES-GCM
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
      cipher.setAAD(Buffer.from(companyId, 'utf8')) // Additional authenticated data
      
      let encrypted = cipher.update(value, 'utf8', 'hex')
      encrypted += cipher.final('hex')
      
      const tag = cipher.getAuthTag()
      
      // Combinar salt + iv + tag + encrypted em uma string base64
      const combined = Buffer.concat([salt, iv, tag, Buffer.from(encrypted, 'hex')])
      return combined.toString('base64')
      
    } catch (error) {
      console.error('Encryption error:', error)
      throw new AppError(500, 'Failed to encrypt value')
    }
  }

  /**
   * Descriptografa um valor usando a chave específica da empresa
   */
  decrypt(encryptedValue: string, companyId: string): string {
    try {
      if (!encryptedValue || !companyId) {
        throw new AppError(400, 'EncryptedValue and companyId are required for decryption')
      }

      // Decodificar base64 e extrair componentes
      const combined = Buffer.from(encryptedValue, 'base64')
      
      if (combined.length < this.saltLength + this.ivLength + this.tagLength) {
        throw new AppError(400, 'Invalid encrypted value format')
      }
      
      const salt = combined.subarray(0, this.saltLength)
      const iv = combined.subarray(this.saltLength, this.saltLength + this.ivLength)
      const tag = combined.subarray(this.saltLength + this.ivLength, this.saltLength + this.ivLength + this.tagLength)
      const encrypted = combined.subarray(this.saltLength + this.ivLength + this.tagLength)
      
      // Derivar a mesma chave
      const key = this.deriveCompanyKey(companyId, salt)
      
      // Descriptografar usando AES-GCM
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
      decipher.setAAD(Buffer.from(companyId, 'utf8'))
      decipher.setAuthTag(tag)
      
      let decrypted = decipher.update(encrypted.toString('hex'), 'hex', 'utf8')
      decrypted += decipher.final('utf8')
      
      return decrypted
      
    } catch (error) {
      console.error('Decryption error:', error)
      throw new AppError(500, 'Failed to decrypt value')
    }
  }

  /**
   * Gera um webhook secret seguro para uma empresa
   */
  generateWebhookSecret(companyId: string, channel: string): string {
    const randomBytes = crypto.randomBytes(32)
    const timestamp = Date.now().toString()
    const data = `${companyId}:${channel}:${timestamp}:${randomBytes.toString('hex')}`
    
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 32)
  }

  /**
   * Valida se uma string é um valor criptografado válido
   */
  isEncrypted(value: string): boolean {
    try {
      const combined = Buffer.from(value, 'base64')
      return combined.length >= this.saltLength + this.ivLength + this.tagLength
    } catch {
      return false
    }
  }

  /**
   * Gera uma API key segura (para armazenar tokens de terceiros criptografados)
   */
  generateApiKey(): string {
    return crypto.randomBytes(32).toString('hex')
  }

  /**
   * Hash seguro para comparação (para casos onde não precisamos descriptografar)
   */
  hash(value: string, companyId: string): string {
    const salt = crypto.createHash('sha256').update(companyId).digest()
    return crypto.pbkdf2Sync(value, salt, 100000, 32, 'sha512').toString('hex')
  }

  /**
   * Verifica se um valor corresponde ao hash
   */
  verifyHash(value: string, hash: string, companyId: string): boolean {
    try {
      const computedHash = this.hash(value, companyId)
      return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(computedHash, 'hex'))
    } catch {
      return false
    }
  }

  /**
   * Rotaciona a criptografia de um valor (re-criptografa com nova salt/iv)
   * Útil para rotação periódica de segurança
   */
  rotateEncryption(encryptedValue: string, companyId: string): string {
    const decrypted = this.decrypt(encryptedValue, companyId)
    return this.encrypt(decrypted, companyId)
  }
}
