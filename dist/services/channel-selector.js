"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChannelSelector = void 0;
const message_1 = require("../schemas/message");
class ChannelSelector {
    constructor(supabase, companyId) {
        this.supabase = supabase;
        this.companyId = companyId;
    }
    async determineChannel(clientId, messageType, senderType, manualChannel) {
        // 1. Se for seleção manual por humano e o tipo permite override
        const config = message_1.defaultMessageConfigs[messageType];
        if (senderType === 'human' &&
            manualChannel &&
            config.allowOverride) {
            return manualChannel;
        }
        // 2. Se tem canal predefinido e não permite override
        if (config.strategy === message_1.ChannelSelectionStrategy.PREDEFINED &&
            config.defaultChannel) {
            return config.defaultChannel;
        }
        // 3. Verificar preferências específicas do cliente
        const { data: preferences } = await this.supabase
            .from('client_preferences')
            .select('channel_preferences')
            .eq('client_id', clientId)
            .single();
        if (preferences?.channel_preferences?.[messageType]) {
            return preferences.channel_preferences[messageType];
        }
        // 4. Usar estratégia configurada
        switch (config.strategy) {
            case message_1.ChannelSelectionStrategy.LAST_USED:
                return await this.getLastUsedChannel(clientId);
            case message_1.ChannelSelectionStrategy.MOST_USED:
                return await this.getMostUsedChannel(clientId);
            default:
                return config.defaultChannel || message_1.Channel.WHATSAPP; // Fallback seguro
        }
    }
    async getLastUsedChannel(clientId) {
        const { data } = await this.supabase
            .from('interactions')
            .select('channel')
            .eq('client_id', clientId)
            .eq('company_id', this.companyId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
        return data?.channel || message_1.Channel.WHATSAPP;
    }
    async getMostUsedChannel(clientId) {
        // Análise dos últimos 30 dias
        const { data: interactions } = await this.supabase
            .from('interactions')
            .select('channel')
            .eq('client_id', clientId)
            .eq('company_id', this.companyId)
            .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
        if (!interactions?.length) {
            return message_1.Channel.WHATSAPP;
        }
        const channelCounts = interactions.reduce((acc, { channel }) => {
            acc[channel] = (acc[channel] || 0) + 1;
            return acc;
        }, {});
        return Object.entries(channelCounts)
            .sort(([, a], [, b]) => b - a)[0][0];
    }
}
exports.ChannelSelector = ChannelSelector;
