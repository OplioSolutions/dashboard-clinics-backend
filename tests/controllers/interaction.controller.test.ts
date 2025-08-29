import { Request, Response } from 'express'
import { InteractionController } from '../../controllers/interaction.controller'
import { mockSupabaseClient, createMockQueryBuilder } from '../setup'
import { createMockConversation, createMockInteraction } from '../helpers/conversation'
import { Channel, MessageType, MessageDirection, MessageStatus } from '../../schemas/message'

describe('InteractionController', () => {
  let controller: InteractionController
  let mockReq: Partial<Request>
  let mockRes: Partial<Response>
  let mockJson: jest.Mock
  let mockStatus: jest.Mock
  let mockQueryBuilder: ReturnType<typeof createMockQueryBuilder>

  beforeEach(() => {
    controller = new InteractionController()
    mockJson = jest.fn()
    mockStatus = jest.fn().mockReturnThis()
    mockQueryBuilder = createMockQueryBuilder()
    
    mockRes = {
      json: mockJson,
      status: mockStatus
    }
    
    mockReq = {
      supabase: mockSupabaseClient,
      tenant: {
        company_id: '123e4567-e89b-12d3-a456-426614174001'
      },
      query: {},
      params: {},
      body: {}
    }

    jest.clearAllMocks()
    mockSupabaseClient.from.mockReturnValue(mockQueryBuilder)
  })

  describe('createInteraction', () => {
    it('should create new interaction in active conversation', async () => {
      const conversation = createMockConversation()
      const interaction = createMockInteraction()

      // Mock conversa ativa
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: {
          status: 'active',
          channels_used: [Channel.WHATSAPP]
        },
        error: null
      })

      // Mock criação da interação
      mockQueryBuilder.single.mockResolvedValueOnce({ data: interaction, error: null })

      mockReq.body = {
        conversation_id: conversation.id,
        client_id: conversation.client_id,
        message: 'Test message',
        channel: Channel.WHATSAPP,
        type: MessageType.GENERAL,
        direction: MessageDirection.OUTBOUND
      }

      await controller.createInteraction(mockReq as Request, mockRes as Response)

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('interactions')
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          conversation_id: conversation.id,
          client_id: conversation.client_id,
          message: 'Test message',
          channel: Channel.WHATSAPP
        })
      )
      expect(mockStatus).toHaveBeenCalledWith(201)
      expect(mockJson).toHaveBeenCalledWith(interaction)
    })

    it('should fail if conversation is closed', async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: { status: 'closed', channels_used: [Channel.WHATSAPP] },
        error: null
      })

      mockReq.body = {
        conversation_id: 'some-id',
        client_id: 'client-id',
        message: 'Test message'
      }

      await controller.createInteraction(mockReq as Request, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(400)
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Cannot add message to closed conversation'
        })
      )
    })

    it('should update channels_used when using new channel', async () => {
      const conversation = createMockConversation()
      const interaction = createMockInteraction({ channel: Channel.INSTAGRAM })

      // Mock conversa ativa que só usou WhatsApp
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: {
          status: 'active',
          channels_used: [Channel.WHATSAPP]
        },
        error: null
      })

      // Mock criação da interação
      mockQueryBuilder.single.mockResolvedValueOnce({ data: interaction, error: null })

      mockReq.body = {
        conversation_id: conversation.id,
        client_id: conversation.client_id,
        message: 'Test message',
        channel: Channel.INSTAGRAM
      }

      await controller.createInteraction(mockReq as Request, mockRes as Response)

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('conversation_threads')
      expect(mockQueryBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          channels_used: [Channel.WHATSAPP, Channel.INSTAGRAM]
        })
      )
    })
  })

  describe('updateStatus', () => {
    it('should update interaction status', async () => {
      const interaction = createMockInteraction()
      mockQueryBuilder.single.mockResolvedValue({ 
        data: { ...interaction, status: MessageStatus.READ },
        error: null
      })

      mockReq.params = { id: interaction.id }
      mockReq.body = { status: MessageStatus.READ }

      await controller.updateStatus(mockReq as Request, mockRes as Response)

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('interactions')
      expect(mockQueryBuilder.update).toHaveBeenCalledWith({ status: MessageStatus.READ })
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          status: MessageStatus.READ
        })
      )
    })

    it('should fail with invalid status', async () => {
      mockReq.params = { id: 'some-id' }
      mockReq.body = { status: 'invalid-status' }

      await controller.updateStatus(mockReq as Request, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(400)
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Invalid status'
        })
      )
    })
  })

  describe('listInteractions', () => {
    it('should list interactions with pagination', async () => {
      const interactions = [
        createMockInteraction(),
        createMockInteraction({
          id: '123e4567-e89b-12d3-a456-426614174005',
          message: 'Another message'
        })
      ]

      mockQueryBuilder.range.mockResolvedValue({ data: interactions, error: null })

      mockReq.query = {
        conversation_id: 'conv-id',
        page: '1',
        limit: '50'
      }

      await controller.listInteractions(mockReq as Request, mockRes as Response)

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('interactions')
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('conversation_id', 'conv-id')
      expect(mockJson).toHaveBeenCalledWith(interactions)
    })

    it('should require conversation_id', async () => {
      mockReq.query = {}

      await controller.listInteractions(mockReq as Request, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(400)
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'conversation_id is required'
        })
      )
    })
  })
})
