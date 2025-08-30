"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.messageSchema = exports.defaultMessageConfigs = exports.ChannelSelectionStrategy = exports.MessageStatus = exports.MessageDirection = exports.MessageType = exports.Channel = void 0;
const zod_1 = require("zod");
var Channel;
(function (Channel) {
    Channel["WHATSAPP"] = "whatsapp";
    Channel["INSTAGRAM"] = "instagram";
})(Channel || (exports.Channel = Channel = {}));
var MessageType;
(function (MessageType) {
    MessageType["GENERAL"] = "general";
    MessageType["APPOINTMENT_REMINDER"] = "appointment_reminder";
    MessageType["MARKETING"] = "marketing";
    MessageType["FOLLOW_UP"] = "follow_up";
    MessageType["PROMOTION"] = "promotion";
    MessageType["BIRTHDAY"] = "birthday";
})(MessageType || (exports.MessageType = MessageType = {}));
var MessageDirection;
(function (MessageDirection) {
    MessageDirection["INBOUND"] = "inbound";
    MessageDirection["OUTBOUND"] = "outbound";
})(MessageDirection || (exports.MessageDirection = MessageDirection = {}));
var MessageStatus;
(function (MessageStatus) {
    MessageStatus["PENDING"] = "pending";
    MessageStatus["SENT"] = "sent";
    MessageStatus["DELIVERED"] = "delivered";
    MessageStatus["READ"] = "read";
    MessageStatus["FAILED"] = "failed";
})(MessageStatus || (exports.MessageStatus = MessageStatus = {}));
var ChannelSelectionStrategy;
(function (ChannelSelectionStrategy) {
    ChannelSelectionStrategy["LAST_USED"] = "last_used";
    ChannelSelectionStrategy["MOST_USED"] = "most_used";
    ChannelSelectionStrategy["MANUAL"] = "manual";
    ChannelSelectionStrategy["PREDEFINED"] = "predefined";
})(ChannelSelectionStrategy || (exports.ChannelSelectionStrategy = ChannelSelectionStrategy = {}));
// Configurações padrão por tipo de mensagem
exports.defaultMessageConfigs = {
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
};
exports.messageSchema = zod_1.z.object({
    conversation_id: zod_1.z.string().uuid(),
    channel: zod_1.z.nativeEnum(Channel),
    direction: zod_1.z.nativeEnum(MessageDirection),
    message: zod_1.z.string().min(1),
    status: zod_1.z.nativeEnum(MessageStatus),
    timestamp: zod_1.z.string().datetime(),
    type: zod_1.z.nativeEnum(MessageType),
    metadata: zod_1.z.record(zod_1.z.unknown()).optional()
});
