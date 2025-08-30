"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMockInteraction = exports.createMockConversation = exports.mockInteraction = exports.mockConversation = void 0;
const message_1 = require("../../schemas/message");
exports.mockConversation = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    company_id: '123e4567-e89b-12d3-a456-426614174001',
    client_id: '123e4567-e89b-12d3-a456-426614174002',
    started_at: new Date().toISOString(),
    channels_used: [message_1.Channel.WHATSAPP],
    status: 'active',
    assignment_status: 'unassigned',
    client: {
        id: '123e4567-e89b-12d3-a456-426614174002',
        name: 'Test Client'
    }
};
exports.mockInteraction = {
    id: '123e4567-e89b-12d3-a456-426614174003',
    company_id: '123e4567-e89b-12d3-a456-426614174001',
    conversation_id: '123e4567-e89b-12d3-a456-426614174000',
    client_id: '123e4567-e89b-12d3-a456-426614174002',
    message: 'Test message',
    channel: message_1.Channel.WHATSAPP,
    type: message_1.MessageType.GENERAL,
    direction: message_1.MessageDirection.INBOUND,
    status: message_1.MessageStatus.DELIVERED,
    timestamp: new Date().toISOString()
};
const createMockConversation = (overrides = {}) => ({
    ...exports.mockConversation,
    ...overrides
});
exports.createMockConversation = createMockConversation;
const createMockInteraction = (overrides = {}) => ({
    ...exports.mockInteraction,
    ...overrides
});
exports.createMockInteraction = createMockInteraction;
