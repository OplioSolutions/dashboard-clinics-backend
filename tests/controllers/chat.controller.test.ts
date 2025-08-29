import { Request, Response } from 'express'
import { ChatController } from '../../controllers/chat.controller'
import { OutboundMessageService } from '../../services/outbound-message.service'
import { Channel, MessageDirection, MessageStatus, MessageType } from '../../schemas/message'
import { createMockSupabaseClient, createMockRequest, createMockResponse } from '../setup'

// Mock do OutboundMessageService
jest.mock('../../services/outbound-message.service')

describe('ChatController', () => {
  let controller: ChatController
  let mockSupabase: any
  let mockRequest: Partial<Request>
  let mockResponse: Partial<Response>
  let mockOutboundService: jest.Mocked<OutboundMessageService>

  beforeEach(() => {
    mockSupabase = createMockSupabaseClient()
    controller = new ChatController(mockSupabase)
    mockRequest = createMockRequest()
    mockResponse = createMockResponse()

    // Setup mock do OutboundMessageService
    mockOutboundService = new OutboundMessageService() as jest.Mocked<OutboundMessageService>
    mockOutboundService.sendMessage = jest.fn().mockResolvedValue(undefined)
    
    // Substituir a instância no controller
    ;(controller as any).outboundService = mockOutboundService
  })

  describe('sendMessage', () => {
    const validPayload = {
      conversation_id: 1,
      message: 'Hello, world!',
      channel: Channel.WHATSAPP,
      type: MessageType.GENERAL
    }

    const mockConversation = {
      id: 1,
      status: 'active',
      client_id: 123,
      channels_used: [Channel.WHATSAPP],
      clients: {
        id: 123,
        name: 'John Doe',
        phone: '+5511999999999',
        email: 'john@example.com',
        instagram_handle: null
      }
    }

    beforeEach(() => {
      mockRequest.body = validPayload
      mockRequest.tenant = { company_id: 'test-company' }
      mockRequest.user = { id: 1 }

      // Mock do Supabase para conversation
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'conversation_threads') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: mockConversation,
                    error: null
                  })
                })
              })
            })
          }
        }
        
        if (table === 'interactions') {
          return {
            insert: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { id: 456, ...validPayload, status: MessageStatus.PENDING },
                  error: null
                })
              })
            }),
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  error: null
                })
              })
            })
          }
        }

        return {
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                error: null
              })
            })
          })
        }
      })
    })

    it('should send message successfully', async () => {
      await controller.sendMessage(mockRequest as Request, mockResponse as Response)

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        interaction_id: 456,
        conversation_id: 1,
        channel: Channel.WHATSAPP,
        status: MessageStatus.PENDING,
        message: 'Message queued for sending'
      })
    })

    it('should fail if conversation not found', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'conversation_threads') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: null,
                    error: { message: 'Not found' }
                  })
                })
              })
            })
          }
        }
        return {}
      })

      await controller.sendMessage(mockRequest as Request, mockResponse as Response)

      expect(mockResponse.status).toHaveBeenCalledWith(404)
    })

    it('should fail if conversation is closed', async () => {
      const closedConversation = { ...mockConversation, status: 'closed' }
      
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'conversation_threads') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: closedConversation,
                    error: null
                  })
                })
              })
            })
          }
        }
        return {}
      })

      await controller.sendMessage(mockRequest as Request, mockResponse as Response)

      expect(mockResponse.status).toHaveBeenCalledWith(400)
    })

    it('should validate input schema', async () => {
      mockRequest.body = {
        conversation_id: 'invalid', // Should be number
        message: '',  // Should not be empty
      }

      await controller.sendMessage(mockRequest as Request, mockResponse as Response)

      expect(mockResponse.status).toHaveBeenCalledWith(expect.any(Number))
      expect(mockResponse.status).not.toHaveBeenCalledWith(200)
    })

    it('should call outbound service with correct payload', async () => {
      await controller.sendMessage(mockRequest as Request, mockResponse as Response)

      expect(mockOutboundService.sendMessage).toHaveBeenCalledWith({
        companyId: 'test-company',
        channel: Channel.WHATSAPP,
        clientContact: '+5511999999999',
        message: 'Hello, world!',
        interactionId: 456
      })
    })
  })

  describe('handleDeliveryCallback', () => {
    const validCallbackPayload = {
      interaction_id: 456,
      status: MessageStatus.DELIVERED,
      delivered_at: '2024-01-01T12:00:00Z'
    }

    beforeEach(() => {
      mockRequest.body = validCallbackPayload
      mockRequest.tenant = { company_id: 'test-company' }

      // Mock do Supabase para interaction update
      mockSupabase.from.mockImplementation(() => ({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              error: null
            })
          })
        })
      }))
    })

    it('should update interaction status successfully', async () => {
      await controller.handleDeliveryCallback(mockRequest as Request, mockResponse as Response)

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'Status updated'
      })
    })

    it('should fail with missing data', async () => {
      mockRequest.body = { interaction_id: 456 } // Missing status

      await controller.handleDeliveryCallback(mockRequest as Request, mockResponse as Response)

      expect(mockResponse.status).toHaveBeenCalledWith(400)
    })
  })
})
