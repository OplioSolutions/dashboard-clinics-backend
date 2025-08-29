import { Channel, MessageType, MessageDirection, MessageStatus } from '../../schemas/message'

export const mockConversation = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  company_id: '123e4567-e89b-12d3-a456-426614174001',
  client_id: '123e4567-e89b-12d3-a456-426614174002',
  started_at: new Date().toISOString(),
  channels_used: [Channel.WHATSAPP],
  status: 'active',
  assignment_status: 'unassigned',
  client: {
    id: '123e4567-e89b-12d3-a456-426614174002',
    name: 'Test Client'
  }
}

export const mockInteraction = {
  id: '123e4567-e89b-12d3-a456-426614174003',
  company_id: '123e4567-e89b-12d3-a456-426614174001',
  conversation_id: '123e4567-e89b-12d3-a456-426614174000',
  client_id: '123e4567-e89b-12d3-a456-426614174002',
  message: 'Test message',
  channel: Channel.WHATSAPP,
  type: MessageType.GENERAL,
  direction: MessageDirection.INBOUND,
  status: MessageStatus.DELIVERED,
  timestamp: new Date().toISOString()
}

export const createMockConversation = (overrides = {}) => ({
  ...mockConversation,
  ...overrides
})

export const createMockInteraction = (overrides = {}) => ({
  ...mockInteraction,
  ...overrides
})
