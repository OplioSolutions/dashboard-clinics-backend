import { IntegrationSecurityService } from '../../services/integration-security.service'

describe('IntegrationSecurityService', () => {
  let service: IntegrationSecurityService

  beforeEach(() => {
    service = new IntegrationSecurityService()
  })

  describe('Encryption/Decryption', () => {
    it('should encrypt and decrypt values correctly', () => {
      const companyId = 'test-company-123'
      const value = 'super-secret-webhook-key'

      const encrypted = service.encrypt(value, companyId)
      const decrypted = service.decrypt(encrypted, companyId)

      expect(decrypted).toBe(value)
      expect(encrypted).not.toBe(value)
      expect(service.isEncrypted(encrypted)).toBe(true)
    })

    it('should fail to decrypt with wrong company ID', () => {
      const companyId1 = 'company-1'
      const companyId2 = 'company-2'
      const value = 'secret-value'

      const encrypted = service.encrypt(value, companyId1)

      expect(() => {
        service.decrypt(encrypted, companyId2)
      }).toThrow()
    })

    it('should generate different encrypted values for same input', () => {
      const companyId = 'test-company'
      const value = 'same-value'

      const encrypted1 = service.encrypt(value, companyId)
      const encrypted2 = service.encrypt(value, companyId)

      expect(encrypted1).not.toBe(encrypted2) // Different due to random salt/IV
      expect(service.decrypt(encrypted1, companyId)).toBe(value)
      expect(service.decrypt(encrypted2, companyId)).toBe(value)
    })

    it('should handle empty values gracefully', () => {
      const companyId = 'test-company'

      expect(() => {
        service.encrypt('', companyId)
      }).toThrow()

      expect(() => {
        service.encrypt('valid', '')
      }).toThrow()
    })
  })

  describe('Webhook Secret Generation', () => {
    it('should generate unique webhook secrets', () => {
      const companyId = 'test-company'
      const channel = 'whatsapp'

      const secret1 = service.generateWebhookSecret(companyId, channel)
      const secret2 = service.generateWebhookSecret(companyId, channel)

      expect(secret1).not.toBe(secret2)
      expect(secret1).toHaveLength(32)
      expect(secret2).toHaveLength(32)
      expect(secret1).toMatch(/^[a-f0-9]{32}$/)
    })

    it('should generate different secrets for different companies', () => {
      const channel = 'whatsapp'
      
      const secret1 = service.generateWebhookSecret('company-1', channel)
      const secret2 = service.generateWebhookSecret('company-2', channel)

      expect(secret1).not.toBe(secret2)
    })
  })

  describe('Hash and Verification', () => {
    it('should hash and verify values correctly', () => {
      const companyId = 'test-company'
      const value = 'password-to-hash'

      const hash = service.hash(value, companyId)
      
      expect(service.verifyHash(value, hash, companyId)).toBe(true)
      expect(service.verifyHash('wrong-value', hash, companyId)).toBe(false)
      expect(service.verifyHash(value, hash, 'wrong-company')).toBe(false)
    })

    it('should generate consistent hashes for same input', () => {
      const companyId = 'test-company'
      const value = 'consistent-value'

      const hash1 = service.hash(value, companyId)
      const hash2 = service.hash(value, companyId)

      expect(hash1).toBe(hash2)
    })
  })

  describe('Utility Functions', () => {
    it('should correctly identify encrypted values', () => {
      const companyId = 'test-company'
      const value = 'test-value'

      const encrypted = service.encrypt(value, companyId)
      
      expect(service.isEncrypted(encrypted)).toBe(true)
      expect(service.isEncrypted(value)).toBe(false)
      expect(service.isEncrypted('invalid-base64')).toBe(false)
    })

    it('should generate valid API keys', () => {
      const apiKey1 = service.generateApiKey()
      const apiKey2 = service.generateApiKey()

      expect(apiKey1).not.toBe(apiKey2)
      expect(apiKey1).toHaveLength(64) // 32 bytes = 64 hex chars
      expect(apiKey1).toMatch(/^[a-f0-9]{64}$/)
    })

    it('should rotate encryption correctly', () => {
      const companyId = 'test-company'
      const value = 'value-to-rotate'

      const encrypted1 = service.encrypt(value, companyId)
      const rotated = service.rotateEncryption(encrypted1, companyId)

      expect(encrypted1).not.toBe(rotated)
      expect(service.decrypt(rotated, companyId)).toBe(value)
    })
  })

  describe('Error Handling', () => {
    it('should handle invalid encrypted data gracefully', () => {
      const companyId = 'test-company'

      expect(() => {
        service.decrypt('invalid-encrypted-data', companyId)
      }).toThrow()

      expect(() => {
        service.decrypt('', companyId)
      }).toThrow()
    })

    it('should handle corrupted base64 data', () => {
      const companyId = 'test-company'
      
      expect(service.verifyHash('value', 'invalid-hash', companyId)).toBe(false)
      expect(service.isEncrypted('not-base64-!@#')).toBe(false)
    })
  })
})
