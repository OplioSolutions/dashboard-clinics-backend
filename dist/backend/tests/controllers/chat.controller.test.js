"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chat_controller_1 = require("../../controllers/chat.controller");
const outbound_message_service_1 = require("../../services/outbound-message.service");
const message_1 = require("../../schemas/message");
const setup_1 = require("../setup");
// Mock do OutboundMessageService
jest.mock('../../services/outbound-message.service');
describe('ChatController', () => {
    let controller;
    let mockSupabase;
    let mockRequest;
    let mockResponse;
    let mockOutboundService;
    beforeEach(() => {
        mockSupabase = (0, setup_1.createMockSupabaseClient)();
        controller = new chat_controller_1.ChatController(mockSupabase);
        mockRequest = (0, setup_1.createMockRequest)();
        mockResponse = (0, setup_1.createMockResponse)();
        // Setup mock do OutboundMessageService
        mockOutboundService = new outbound_message_service_1.OutboundMessageService();
        mockOutboundService.sendMessage = jest.fn().mockResolvedValue(undefined);
        controller.outboundService = mockOutboundService;
    });
    describe('sendMessage', () => {
        const validPayload = {
            conversation_id: 1,
            message: 'Hello, world!',
            channel: message_1.Channel.WHATSAPP,
            type: message_1.MessageType.GENERAL
        };
        const mockConversation = {
            id: 1,
            status: 'active',
            client_id: 123,
            channels_used: [message_1.Channel.WHATSAPP],
            clients: {
                id: 123,
                name: 'John Doe',
                phone: '+5511999999999',
                email: 'john@example.com',
                instagram_handle: null
            }
        };
        beforeEach(() => {
            mockRequest.body = validPayload;
            mockRequest.tenant = { company_id: 'test-company' };
            mockRequest.user = { id: 1 };
            // Mock do Supabase para conversation
            mockSupabase.from.mockImplementation((table) => {
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
                    };
                }
                if (table === 'interactions') {
                    return {
                        insert: jest.fn().mockReturnValue({
                            select: jest.fn().mockReturnValue({
                                single: jest.fn().mockResolvedValue({
                                    data: { id: 456, ...validPayload, status: message_1.MessageStatus.PENDING },
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
                    };
                }
                return {
                    update: jest.fn().mockReturnValue({
                        eq: jest.fn().mockReturnValue({
                            eq: jest.fn().mockReturnValue({
                                error: null
                            })
                        })
                    })
                };
            });
        });
        it('should send message successfully', async () => {
            await controller.sendMessage(mockRequest, mockResponse);
            expect(mockResponse.json).toHaveBeenCalledWith({
                success: true,
                interaction_id: 456,
                conversation_id: 1,
                channel: message_1.Channel.WHATSAPP,
                status: message_1.MessageStatus.PENDING,
                message: 'Message queued for sending'
            });
        });
        it('should fail if conversation not found', async () => {
            mockSupabase.from.mockImplementation((table) => {
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
                    };
                }
                return {};
            });
            await controller.sendMessage(mockRequest, mockResponse);
            expect(mockResponse.status).toHaveBeenCalledWith(404);
        });
        it('should fail if conversation is closed', async () => {
            const closedConversation = { ...mockConversation, status: 'closed' };
            mockSupabase.from.mockImplementation((table) => {
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
                    };
                }
                return {};
            });
            await controller.sendMessage(mockRequest, mockResponse);
            expect(mockResponse.status).toHaveBeenCalledWith(400);
        });
        it('should validate input schema', async () => {
            mockRequest.body = {
                conversation_id: 'invalid', // Should be number
                message: '', // Should not be empty
            };
            await controller.sendMessage(mockRequest, mockResponse);
            expect(mockResponse.status).toHaveBeenCalledWith(expect.any(Number));
            expect(mockResponse.status).not.toHaveBeenCalledWith(200);
        });
        it('should call outbound service with correct payload', async () => {
            await controller.sendMessage(mockRequest, mockResponse);
            expect(mockOutboundService.sendMessage).toHaveBeenCalledWith({
                companyId: 'test-company',
                channel: message_1.Channel.WHATSAPP,
                clientContact: '+5511999999999',
                message: 'Hello, world!',
                interactionId: 456
            });
        });
    });
    describe('handleDeliveryCallback', () => {
        const validCallbackPayload = {
            interaction_id: 456,
            status: message_1.MessageStatus.DELIVERED,
            delivered_at: '2024-01-01T12:00:00Z'
        };
        beforeEach(() => {
            mockRequest.body = validCallbackPayload;
            mockRequest.tenant = { company_id: 'test-company' };
            // Mock do Supabase para interaction update
            mockSupabase.from.mockImplementation(() => ({
                update: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        eq: jest.fn().mockReturnValue({
                            error: null
                        })
                    })
                })
            }));
        });
        it('should update interaction status successfully', async () => {
            await controller.handleDeliveryCallback(mockRequest, mockResponse);
            expect(mockResponse.json).toHaveBeenCalledWith({
                success: true,
                message: 'Status updated'
            });
        });
        it('should fail with missing data', async () => {
            mockRequest.body = { interaction_id: 456 }; // Missing status
            await controller.handleDeliveryCallback(mockRequest, mockResponse);
            expect(mockResponse.status).toHaveBeenCalledWith(400);
        });
    });
});
