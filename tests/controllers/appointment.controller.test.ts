import { Request, Response } from 'express'
import { AppointmentController } from '../../controllers/appointment.controller'
import { mockSupabaseClient, createMockQueryBuilder } from '../setup'

describe('AppointmentController', () => {
  let controller: AppointmentController
  let mockReq: Partial<Request>
  let mockRes: Partial<Response>
  let mockJson: jest.Mock
  let mockStatus: jest.Mock
  let mockQueryBuilder: ReturnType<typeof createMockQueryBuilder>

  beforeEach(() => {
    controller = new AppointmentController()
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
        role: 'staff',
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
    it('should list appointments with relations', async () => {
      const mockAppointments = [
        {
          id: '1',
          scheduled_at: '2024-03-15T10:00:00Z',
          client: { id: '1', name: 'Test Client' },
          service: { id: '1', name: 'Test Service', duration: 60 },
          staff: { id: '1', name: 'Test Staff' }
        }
      ]

      mockQueryBuilder.order.mockResolvedValue({ data: mockAppointments, error: null })

      await controller.list(mockReq as Request, mockRes as Response)

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('appointments')
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('company_id', mockReq.tenant!.company_id)
      expect(mockJson).toHaveBeenCalledWith(mockAppointments)
    })

    it('should filter by date range', async () => {
      mockReq.query = {
        start_date: '2024-03-15T00:00:00Z',
        end_date: '2024-03-15T23:59:59Z'
      }

      const mockAppointments = [
        {
          id: '1',
          scheduled_at: '2024-03-15T10:00:00Z',
          client: { id: '1', name: 'Test Client' },
          service: { id: '1', name: 'Test Service', duration: 60 },
          staff: { id: '1', name: 'Test Staff' }
        }
      ]

      mockQueryBuilder.order.mockResolvedValue({ data: mockAppointments, error: null })

      await controller.list(mockReq as Request, mockRes as Response)

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('appointments')
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('company_id', mockReq.tenant!.company_id)
      expect(mockQueryBuilder.gte).toHaveBeenCalledWith('scheduled_at', mockReq.query.start_date)
      expect(mockQueryBuilder.lt).toHaveBeenCalledWith('scheduled_at', mockReq.query.end_date)
      expect(mockJson).toHaveBeenCalledWith(mockAppointments)
    })
  })

  describe('create', () => {
    it('should create an appointment when time slot is available', async () => {
      const mockAppointment = {
        client_id: '123e4567-e89b-12d3-a456-426614174001',
        service_id: '123e4567-e89b-12d3-a456-426614174002',
        staff_id: '123e4567-e89b-12d3-a456-426614174003',
        scheduled_at: '2024-03-15T10:00:00Z'
      }

      const mockResponse = {
        ...mockAppointment,
        id: '1',
        company_id: mockReq.tenant!.company_id,
        client: { id: mockAppointment.client_id, name: 'Test Client' },
        service: { id: mockAppointment.service_id, name: 'Test Service', duration: 60 },
        staff: { id: mockAppointment.staff_id, name: 'Test Staff' }
      }

      mockReq.body = mockAppointment

      // Mock verificação de conflitos
      mockQueryBuilder.or.mockResolvedValue({ data: [], error: null })
      mockQueryBuilder.single.mockResolvedValue({ data: mockResponse, error: null })

      await controller.create(mockReq as Request, mockRes as Response)

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('appointments')
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          ...mockAppointment,
          company_id: mockReq.tenant!.company_id
        })
      )
      expect(mockJson).toHaveBeenCalledWith(mockResponse)
    })

    it('should reject when time slot is not available', async () => {
      const mockAppointment = {
        client_id: '123e4567-e89b-12d3-a456-426614174001',
        service_id: '123e4567-e89b-12d3-a456-426614174002',
        staff_id: '123e4567-e89b-12d3-a456-426614174003',
        scheduled_at: '2024-03-15T10:00:00Z'
      }

      mockReq.body = mockAppointment

      // Mock conflito de horário
      mockQueryBuilder.or.mockResolvedValue({
        data: [{ id: 'existing-appointment' }],
        error: null
      })

      await controller.create(mockReq as Request, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(409)
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Time slot not available'
        })
      )
    })
  })
})