"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const conversation_controller_1 = require("../../controllers/conversation.controller");
const setup_1 = require("../setup");
const conversation_1 = require("../helpers/conversation");
const message_1 = require("../../schemas/message");
describe('ConversationController', () => {
    let controller;
    let mockReq;
    let mockRes;
    let mockJson;
    let mockStatus;
    let mockQueryBuilder;
    beforeEach(() => {
        mockJson = jest.fn();
        mockStatus = jest.fn().mockReturnThis();
        mockQueryBuilder = (0, setup_1.createMockQueryBuilder)();
        mockRes = {
            json: mockJson,
            status: mockStatus
        };
        mockReq = {
            tenant: {
                company_id: '123e4567-e89b-12d3-a456-426614174001'
            },
            query: {},
            params: {},
            body: {}
        };
        // Reset e configurar mock do Supabase
        jest.clearAllMocks();
        setup_1.mockSupabaseClient.from.mockReturnValue(mockQueryBuilder);
        // Criar controller com mock do Supabase
        controller = new conversation_controller_1.ConversationController(setup_1.mockSupabaseClient);
    });
    describe('startConversation', () => {
        it('should return existing active conversation', async () => {
            const existingConversation = (0, conversation_1.createMockConversation)();
            mockQueryBuilder.single.mockResolvedValue({ data: existingConversation, error: null });
            mockReq.body = {
                client_id: existingConversation.client_id
            };
            await controller.startConversation(mockReq, mockRes);
            expect(setup_1.mockSupabaseClient.from).toHaveBeenCalledWith('conversation_threads');
            expect(mockQueryBuilder.eq).toHaveBeenCalledWith('company_id', mockReq.tenant.company_id);
            expect(mockJson).toHaveBeenCalledWith(existingConversation);
        });
        it('should create new conversation with initial message', async () => {
            // Simular que não existe conversa ativa
            mockQueryBuilder.single.mockResolvedValueOnce({ data: null, error: null });
            const newConversation = (0, conversation_1.createMockConversation)();
            mockQueryBuilder.single.mockResolvedValueOnce({ data: newConversation, error: null });
            mockReq.body = {
                client_id: newConversation.client_id,
                initial_message: 'Hello',
                channel: message_1.Channel.WHATSAPP
            };
            await controller.startConversation(mockReq, mockRes);
            expect(setup_1.mockSupabaseClient.from).toHaveBeenCalledWith('conversation_threads');
            expect(mockQueryBuilder.insert).toHaveBeenCalledWith(expect.objectContaining({
                client_id: newConversation.client_id,
                company_id: mockReq.tenant.company_id,
                channels_used: [message_1.Channel.WHATSAPP]
            }));
            expect(mockStatus).toHaveBeenCalledWith(201);
            expect(mockJson).toHaveBeenCalledWith(newConversation);
        });
    });
    describe('closeConversation', () => {
        it('should close an active conversation', async () => {
            const conversation = (0, conversation_1.createMockConversation)();
            mockQueryBuilder.single.mockResolvedValue({ data: conversation, error: null });
            mockReq.params = { id: conversation.id };
            await controller.closeConversation(mockReq, mockRes);
            expect(setup_1.mockSupabaseClient.from).toHaveBeenCalledWith('conversation_threads');
            expect(mockQueryBuilder.update).toHaveBeenCalledWith(expect.objectContaining({
                status: 'closed',
                ended_at: expect.any(String)
            }));
            expect(mockJson).toHaveBeenCalledWith(conversation);
        });
        it('should return 404 for non-existent conversation', async () => {
            mockQueryBuilder.single.mockResolvedValue({ data: null, error: null });
            mockReq.params = { id: 'non-existent' };
            await controller.closeConversation(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(404);
            expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({
                error: 'Conversation not found'
            }));
        });
    });
    describe('listConversations', () => {
        it('should list conversations with optional client filter', async () => {
            const conversations = [
                (0, conversation_1.createMockConversation)(),
                (0, conversation_1.createMockConversation)({ id: '123e4567-e89b-12d3-a456-426614174004' })
            ];
            // Configurar mock para retornar os dados no final da cadeia
            mockQueryBuilder.order.mockResolvedValue({ data: conversations, error: null });
            mockReq.query = { client_id: conversations[0].client_id };
            await controller.listConversations(mockReq, mockRes);
            expect(setup_1.mockSupabaseClient.from).toHaveBeenCalledWith('conversation_threads');
            expect(mockQueryBuilder.eq).toHaveBeenCalledWith('company_id', mockReq.tenant.company_id);
            expect(mockJson).toHaveBeenCalledWith(conversations);
        });
    });
    describe('getConversation', () => {
        it('should return conversation with messages', async () => {
            const conversation = (0, conversation_1.createMockConversation)();
            const messages = [
                (0, conversation_1.createMockInteraction)(),
                (0, conversation_1.createMockInteraction)({
                    id: '123e4567-e89b-12d3-a456-426614174005',
                    message: 'Another message'
                })
            ];
            mockQueryBuilder.single.mockResolvedValue({ data: conversation, error: null });
            mockQueryBuilder.range.mockResolvedValue({ data: messages, error: null });
            mockReq.params = { id: conversation.id };
            mockReq.query = { page: '1', limit: '50' };
            await controller.getConversation(mockReq, mockRes);
            expect(setup_1.mockSupabaseClient.from).toHaveBeenCalledWith('conversation_threads');
            expect(mockJson).toHaveBeenCalledWith({
                ...conversation,
                messages
            });
        });
        it('should return 404 for non-existent conversation', async () => {
            mockQueryBuilder.single.mockResolvedValue({ data: null, error: null });
            mockReq.params = { id: 'non-existent' };
            await controller.getConversation(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(404);
            expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({
                error: 'Conversation not found'
            }));
        });
    });
});
