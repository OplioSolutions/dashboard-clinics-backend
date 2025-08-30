import { Request, Response } from 'express'
import { ServiceController } from '../../controllers/service.controller'
import { mockSupabaseClient, createMockQueryBuilder } from '../setup'

describe('ServiceController', () => {
  let controller: ServiceController
  let mockReq: Partial<Request>
  let mockRes: Partial<Response>
  let mockJson: jest.Mock
  let mockStatus: jest.Mock
  let mockQueryBuilder: ReturnType<typeof createMockQueryBuilder>

  beforeEach(() => {
    controller = new ServiceController()
    mockJson = jest.fn()
    mockStatus = jest.fn().mockReturnThis()
    mockQueryBuilder = createMockQueryBuilder()
    
    mockRes = {
      json: mockJson,
      status: mockStatus
    }
    
    mockReq = {
      supabase: mockSupabaseClient as any,
      tenant: {
        company_id: '123e4567-e89b-12d3-a456-426614174000' // UUID válido para testes
      },
      query: {},
      user: {
        role: 'admin',
        auth_user_id: 'test-user-id',
        company_id: '123e4567-e89b-12d3-a456-426614174000',
        profile_id: 'test-profile-id',
        name: 'Test User',
        email: 'test@example.com'
      }
    }

    // Reset e configurar mock do Supabase
    jest.clearAllMocks()
    mockSupabaseClient.from.mockReturnValue(mockQueryBuilder)
  })

  describe('list', () => {
    it('should list active services by default', async () => {
      const mockServices = [
        { id: '1', name: 'Service 1', active: true },
        { id: '2', name: 'Service 2', active: true }
      ]

      mockQueryBuilder.order.mockResolvedValue({ data: mockServices, error: null })

      await controller.list(mockReq as Request, mockRes as Response)

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('services')
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('company_id', mockReq.tenant!.company_id)
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('active', true)
      expect(mockJson).toHaveBeenCalledWith(mockServices)
    })

    it('should include inactive services when requested', async () => {
      mockReq.query = { includeInactive: 'true' }
      const mockServices = [
        { id: '1', name: 'Service 1', active: true },
        { id: '2', name: 'Service 2', active: false }
      ]

      mockQueryBuilder.order.mockResolvedValue({ data: mockServices, error: null })

      await controller.list(mockReq as Request, mockRes as Response)

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('services')
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('company_id', mockReq.tenant!.company_id)
      expect(mockJson).toHaveBeenCalledWith(mockServices)
    })
  })

  describe('create', () => {
    it('should create a service', async () => {
      const mockService = {
        name: 'New Service',
        duration: 60,
        price: 100,
        description: 'Test service'
      }

      const mockResponse = {
        ...mockService,
        id: '1',
        company_id: mockReq.tenant!.company_id,
        active: true
      }

      mockReq.body = mockService
      mockQueryBuilder.single.mockResolvedValue({ data: mockResponse, error: null })

      await controller.create(mockReq as Request, mockRes as Response)

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('services')
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          ...mockService,
          company_id: mockReq.tenant!.company_id
        })
      )
      expect(mockJson).toHaveBeenCalledWith(mockResponse)
    })

    it('should validate service data', async () => {
      mockReq.body = { name: '', duration: -1 } // Dados inválidos

      await controller.create(mockReq as Request, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(400)
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Validation error'
        })
      )
    })
  })
})