import { Request, Response } from 'express'
import { ConversationController } from '../../controllers/conversation.controller'
import { mockSupabaseClient, createMockQueryBuilder } from '../setup'
import { createMockConversation, createMockInteraction } from '../helpers/conversation'
import { Channel, MessageType, MessageDirection, MessageStatus } from '../../schemas/message'

describe('ConversationController', () => {
  let controller: ConversationController
  let mockReq: Partial<Request>
  let mockRes: Partial<Response>
  let mockJson: jest.Mock
  let mockStatus: jest.Mock
  let mockQueryBuilder: ReturnType<typeof createMockQueryBuilder>

  beforeEach(() => {
    mockJson = jest.fn()
    mockStatus = jest.fn().mockReturnThis()
    mockQueryBuilder = createMockQueryBuilder()
    
    mockRes = {
      json: mockJson,
      status: mockStatus
    }
    
    mockReq = {
      tenant: {
        company_id: '123e4567-e89b-12d3-a456-426614174001'
      },
      query: {},
      params: {},
      body: {}
    }

    // Reset e configurar mock do Supabase
    jest.clearAllMocks()
    mockSupabaseClient.from.mockReturnValue(mockQueryBuilder)
    
    // Criar controller com mock do Supabase
    controller = new ConversationController(mockSupabaseClient)
  })

  describe('startConversation', () => {
    it('should return existing active conversation', async () => {
      const existingConversation = createMockConversation()
      mockQueryBuilder.single.mockResolvedValue({ data: existingConversation, error: null })

      mockReq.body = {
        client_id: existingConversation.client_id
      }

      await controller.startConversation(mockReq as Request, mockRes as Response)

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('conversation_threads')
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('company_id', mockReq.tenant!.company_id)
      expect(mockJson).toHaveBeenCalledWith(existingConversation)
    })

    it('should create new conversation with initial message', async () => {
      // Simular que não existe conversa ativa
      mockQueryBuilder.single.mockResolvedValueOnce({ data: null, error: null })

      const newConversation = createMockConversation()
      mockQueryBuilder.single.mockResolvedValueOnce({ data: newConversation, error: null })

      mockReq.body = {
        client_id: newConversation.client_id,
        initial_message: 'Hello',
        channel: Channel.WHATSAPP
      }

      await controller.startConversation(mockReq as Request, mockRes as Response)

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('conversation_threads')
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          client_id: newConversation.client_id,
          company_id: mockReq.tenant!.company_id,
          channels_used: [Channel.WHATSAPP]
        })
      )
      expect(mockStatus).toHaveBeenCalledWith(201)
      expect(mockJson).toHaveBeenCalledWith(newConversation)
    })
  })

  describe('closeConversation', () => {
    it('should close an active conversation', async () => {
      const conversation = createMockConversation()
      mockQueryBuilder.single.mockResolvedValue({ data: conversation, error: null })

      mockReq.params = { id: conversation.id }

      await controller.closeConversation(mockReq as Request, mockRes as Response)

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('conversation_threads')
      expect(mockQueryBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'closed',
          ended_at: expect.any(String)
        })
      )
      expect(mockJson).toHaveBeenCalledWith(conversation)
    })

    it('should return 404 for non-existent conversation', async () => {
      mockQueryBuilder.single.mockResolvedValue({ data: null, error: null })

      mockReq.params = { id: 'non-existent' }

      await controller.closeConversation(mockReq as Request, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(404)
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Conversation not found'
        })
      )
    })
  })

  describe('listConversations', () => {
    it('should list conversations with optional client filter', async () => {
      const conversations = [
        createMockConversation(),
        createMockConversation({ id: '123e4567-e89b-12d3-a456-426614174004' })
      ]

      // Configurar mock para retornar os dados no final da cadeia
      mockQueryBuilder.order.mockResolvedValue({ data: conversations, error: null })

      mockReq.query = { client_id: conversations[0].client_id }

      await controller.listConversations(mockReq as Request, mockRes as Response)

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('conversation_threads')
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('company_id', mockReq.tenant!.company_id)
      expect(mockJson).toHaveBeenCalledWith(conversations)
    })
  })

  describe('getConversation', () => {
    it('should return conversation with messages', async () => {
      const conversation = createMockConversation()
      const messages = [
        createMockInteraction(),
        createMockInteraction({
          id: '123e4567-e89b-12d3-a456-426614174005',
          message: 'Another message'
        })
      ]

      mockQueryBuilder.single.mockResolvedValue({ data: conversation, error: null })
      mockQueryBuilder.range.mockResolvedValue({ data: messages, error: null })

      mockReq.params = { id: conversation.id }
      mockReq.query = { page: '1', limit: '50' }

      await controller.getConversation(mockReq as Request, mockRes as Response)

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('conversation_threads')
      expect(mockJson).toHaveBeenCalledWith({
        ...conversation,
        messages
      })
    })

    it('should return 404 for non-existent conversation', async () => {
      mockQueryBuilder.single.mockResolvedValue({ data: null, error: null })

      mockReq.params = { id: 'non-existent' }

      await controller.getConversation(mockReq as Request, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(404)
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Conversation not found'
        })
      )
    })
  })
})