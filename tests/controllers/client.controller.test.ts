import { Request, Response } from 'express'
import { ClientController } from '../../controllers/client.controller'
import { mockSupabaseClient, createMockQueryBuilder } from '../setup'

describe('ClientController', () => {
  let controller: ClientController
  let mockReq: Partial<Request>
  let mockRes: Partial<Response>
  let mockJson: jest.Mock
  let mockStatus: jest.Mock
  let mockQueryBuilder: ReturnType<typeof createMockQueryBuilder>

  beforeEach(() => {
    controller = new ClientController()
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
      query: {}
    }

    // Reset e configurar mock do Supabase
    jest.clearAllMocks()
    mockSupabaseClient.from.mockReturnValue(mockQueryBuilder)
  })

  describe('list', () => {
    it('should list clients', async () => {
      const mockClients = [
        { id: '1', name: 'Test Client 1' },
        { id: '2', name: 'Test Client 2' }
      ]

      mockQueryBuilder.order.mockResolvedValue({ data: mockClients, error: null })

      await controller.list(mockReq as Request, mockRes as Response)

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('clients')
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('company_id', mockReq.tenant!.company_id)
      expect(mockJson).toHaveBeenCalledWith(mockClients)
    })

    it('should handle search query', async () => {
      mockReq.query = { search: 'test' }
      const mockClients = [{ id: '1', name: 'Test Client' }]

      // Configurar o mock para retornar os dados no final da cadeia
      mockQueryBuilder.or.mockReturnThis()
      mockQueryBuilder.order.mockResolvedValue({ data: mockClients, error: null })

      await controller.list(mockReq as Request, mockRes as Response)

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('clients')
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('company_id', mockReq.tenant!.company_id)
      expect(mockQueryBuilder.or).toHaveBeenCalledWith(expect.stringContaining('test'))
      expect(mockJson).toHaveBeenCalledWith(mockClients)
    })
  })

  describe('create', () => {
    it('should create a client', async () => {
      const mockClient = {
        name: 'New Client',
        email: 'client@test.com',
        phone: '1234567890'
      }

      const mockResponse = {
        ...mockClient,
        id: '1',
        company_id: mockReq.tenant!.company_id
      }

      mockReq.body = mockClient
      mockQueryBuilder.single.mockResolvedValue({ data: mockResponse, error: null })

      await controller.create(mockReq as Request, mockRes as Response)

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('clients')
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          ...mockClient,
          company_id: mockReq.tenant!.company_id
        })
      )
      expect(mockJson).toHaveBeenCalledWith(mockResponse)
    })

    it('should validate client data', async () => {
      mockReq.body = { name: '' } // Nome inválido

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