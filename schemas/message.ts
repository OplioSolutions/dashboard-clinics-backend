import { z } from 'zod'

export enum Channel {
  WHATSAPP = 'whatsapp',
  INSTAGRAM = 'instagram'
}

export enum MessageType {
  GENERAL = 'general',
  APPOINTMENT_REMINDER = 'appointment_reminder',
  MARKETING = 'marketing',
  FOLLOW_UP = 'follow_up',
  PROMOTION = 'promotion',
  BIRTHDAY = 'birthday'
}

export enum MessageDirection {
  INBOUND = 'inbound',
  OUTBOUND = 'outbound'
}

export enum MessageStatus {
  PENDING = 'pending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
  FAILED = 'failed'
}

export enum ChannelSelectionStrategy {
  LAST_USED = 'last_used',
  MOST_USED = 'most_used',
  MANUAL = 'manual',
  PREDEFINED = 'predefined'
}

export interface MessageConfig {
  type: MessageType;
  defaultChannel?: Channel;
  allowOverride?: boolean;
  strategy: ChannelSelectionStrategy;
}

// Configurações padrão por tipo de mensagem
export const defaultMessageConfigs: Record<MessageType, MessageConfig> = {
  [MessageType.APPOINTMENT_REMINDER]: {
    type: MessageType.APPOINTMENT_REMINDER,
    defaultChannel: Channel.WHATSAPP,
    allowOverride: false,
    strategy: ChannelSelectionStrategy.PREDEFINED
  },
  [MessageType.MARKETING]: {
    type: MessageType.MARKETING,
    defaultChannel: Channel.INSTAGRAM,
    allowOverride: true,
    strategy: ChannelSelectionStrategy.PREDEFINED
  },
  [MessageType.PROMOTION]: {
    type: MessageType.PROMOTION,
    defaultChannel: Channel.INSTAGRAM,
    allowOverride: true,
    strategy: ChannelSelectionStrategy.PREDEFINED
  },
  [MessageType.FOLLOW_UP]: {
    type: MessageType.FOLLOW_UP,
    defaultChannel: Channel.WHATSAPP,
    allowOverride: true,
    strategy: ChannelSelectionStrategy.LAST_USED
  },
  [MessageType.BIRTHDAY]: {
    type: MessageType.BIRTHDAY,
    defaultChannel: Channel.WHATSAPP,
    allowOverride: true,
    strategy: ChannelSelectionStrategy.PREDEFINED
  },
  [MessageType.GENERAL]: {
    type: MessageType.GENERAL,
    allowOverride: true,
    strategy: ChannelSelectionStrategy.LAST_USED
  }
}

export const messageSchema = z.object({
  conversation_id: z.string().uuid(),
  channel: z.nativeEnum(Channel),
  direction: z.nativeEnum(MessageDirection),
  message: z.string().min(1),
  status: z.nativeEnum(MessageStatus),
  timestamp: z.string().datetime(),
  type: z.nativeEnum(MessageType),
  metadata: z.record(z.unknown()).optional()
})
