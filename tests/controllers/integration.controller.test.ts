import { Request, Response } from 'express'
import { IntegrationController } from '../../controllers/integration.controller'
import { Channel } from '../../schemas/message'
import { mockSupabaseClient, createMockQueryBuilder } from '../setup'

describe('IntegrationController', () => {
  let controller: IntegrationController

  beforeAll(() => {
    // Criar mock mais simples
    const simpleMock = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: null })
          })
        })
      })
    }
    controller = new IntegrationController(simpleMock as any)
  })

  describe('Controller instantiation', () => {
    it('should create integration controller instance', () => {
      expect(controller).toBeInstanceOf(IntegrationController)
    })

    it('should have all required methods', () => {
      expect(typeof controller.listIntegrations).toBe('function')
      expect(typeof controller.createIntegration).toBe('function')
      expect(typeof controller.getIntegration).toBe('function')
      expect(typeof controller.updateIntegration).toBe('function')
      expect(typeof controller.updateIntegrationStatus).toBe('function')
      expect(typeof controller.rotateWebhookSecret).toBe('function')
      expect(typeof controller.deleteIntegration).toBe('function')
      expect(typeof controller.testIntegration).toBe('function')
      expect(typeof controller.getAvailableChannels).toBe('function')
    })
  })

})
