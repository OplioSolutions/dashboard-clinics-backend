"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const interaction_controller_1 = require("../../controllers/interaction.controller");
const setup_1 = require("../setup");
const conversation_1 = require("../helpers/conversation");
const message_1 = require("../../schemas/message");
describe('InteractionController', () => {
    let controller;
    let mockReq;
    let mockRes;
    let mockJson;
    let mockStatus;
    let mockQueryBuilder;
    beforeEach(() => {
        controller = new interaction_controller_1.InteractionController();
        mockJson = jest.fn();
        mockStatus = jest.fn().mockReturnThis();
        mockQueryBuilder = (0, setup_1.createMockQueryBuilder)();
        mockRes = {
            json: mockJson,
            status: mockStatus
        };
        mockReq = {
            supabase: setup_1.mockSupabaseClient,
            tenant: {
                company_id: '123e4567-e89b-12d3-a456-426614174001'
            },
            query: {},
            params: {},
            body: {}
        };
        jest.clearAllMocks();
        setup_1.mockSupabaseClient.from.mockReturnValue(mockQueryBuilder);
    });
    describe('createInteraction', () => {
        it('should create new interaction in active conversation', async () => {
            const conversation = (0, conversation_1.createMockConversation)();
            const interaction = (0, conversation_1.createMockInteraction)();
            // Mock conversa ativa
            mockQueryBuilder.single.mockResolvedValueOnce({
                data: {
                    status: 'active',
                    channels_used: [message_1.Channel.WHATSAPP]
                },
                error: null
            });
            // Mock criação da interação
            mockQueryBuilder.single.mockResolvedValueOnce({ data: interaction, error: null });
            mockReq.body = {
                conversation_id: conversation.id,
                client_id: conversation.client_id,
                message: 'Test message',
                channel: message_1.Channel.WHATSAPP,
                type: message_1.MessageType.GENERAL,
                direction: message_1.MessageDirection.OUTBOUND
            };
            await controller.createInteraction(mockReq, mockRes);
            expect(setup_1.mockSupabaseClient.from).toHaveBeenCalledWith('interactions');
            expect(mockQueryBuilder.insert).toHaveBeenCalledWith(expect.objectContaining({
                conversation_id: conversation.id,
                client_id: conversation.client_id,
                message: 'Test message',
                channel: message_1.Channel.WHATSAPP
            }));
            expect(mockStatus).toHaveBeenCalledWith(201);
            expect(mockJson).toHaveBeenCalledWith(interaction);
        });
        it('should fail if conversation is closed', async () => {
            mockQueryBuilder.single.mockResolvedValue({
                data: { status: 'closed', channels_used: [message_1.Channel.WHATSAPP] },
                error: null
            });
            mockReq.body = {
                conversation_id: 'some-id',
                client_id: 'client-id',
                message: 'Test message'
            };
            await controller.createInteraction(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(400);
            expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({
                error: 'Cannot add message to closed conversation'
            }));
        });
        it('should update channels_used when using new channel', async () => {
            const conversation = (0, conversation_1.createMockConversation)();
            const interaction = (0, conversation_1.createMockInteraction)({ channel: message_1.Channel.INSTAGRAM });
            // Mock conversa ativa que só usou WhatsApp
            mockQueryBuilder.single.mockResolvedValueOnce({
                data: {
                    status: 'active',
                    channels_used: [message_1.Channel.WHATSAPP]
                },
                error: null
            });
            // Mock criação da interação
            mockQueryBuilder.single.mockResolvedValueOnce({ data: interaction, error: null });
            mockReq.body = {
                conversation_id: conversation.id,
                client_id: conversation.client_id,
                message: 'Test message',
                channel: message_1.Channel.INSTAGRAM
            };
            await controller.createInteraction(mockReq, mockRes);
            expect(setup_1.mockSupabaseClient.from).toHaveBeenCalledWith('conversation_threads');
            expect(mockQueryBuilder.update).toHaveBeenCalledWith(expect.objectContaining({
                channels_used: [message_1.Channel.WHATSAPP, message_1.Channel.INSTAGRAM]
            }));
        });
    });
    describe('updateStatus', () => {
        it('should update interaction status', async () => {
            const interaction = (0, conversation_1.createMockInteraction)();
            mockQueryBuilder.single.mockResolvedValue({
                data: { ...interaction, status: message_1.MessageStatus.READ },
                error: null
            });
            mockReq.params = { id: interaction.id };
            mockReq.body = { status: message_1.MessageStatus.READ };
            await controller.updateStatus(mockReq, mockRes);
            expect(setup_1.mockSupabaseClient.from).toHaveBeenCalledWith('interactions');
            expect(mockQueryBuilder.update).toHaveBeenCalledWith({ status: message_1.MessageStatus.READ });
            expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({
                status: message_1.MessageStatus.READ
            }));
        });
        it('should fail with invalid status', async () => {
            mockReq.params = { id: 'some-id' };
            mockReq.body = { status: 'invalid-status' };
            await controller.updateStatus(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(400);
            expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({
                error: 'Invalid status'
            }));
        });
    });
    describe('listInteractions', () => {
        it('should list interactions with pagination', async () => {
            const interactions = [
                (0, conversation_1.createMockInteraction)(),
                (0, conversation_1.createMockInteraction)({
                    id: '123e4567-e89b-12d3-a456-426614174005',
                    message: 'Another message'
                })
            ];
            mockQueryBuilder.range.mockResolvedValue({ data: interactions, error: null });
            mockReq.query = {
                conversation_id: 'conv-id',
                page: '1',
                limit: '50'
            };
            await controller.listInteractions(mockReq, mockRes);
            expect(setup_1.mockSupabaseClient.from).toHaveBeenCalledWith('interactions');
            expect(mockQueryBuilder.eq).toHaveBeenCalledWith('conversation_id', 'conv-id');
            expect(mockJson).toHaveBeenCalledWith(interactions);
        });
        it('should require conversation_id', async () => {
            mockReq.query = {};
            await controller.listInteractions(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(400);
            expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({
                error: 'conversation_id is required'
            }));
        });
    });
});
