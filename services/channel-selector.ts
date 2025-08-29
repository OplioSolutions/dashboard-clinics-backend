import { SupabaseClient } from '@supabase/supabase-js'
import { 
  Channel, 
  MessageType, 
  ChannelSelectionStrategy, 
  defaultMessageConfigs 
} from '../schemas/message'

export class ChannelSelector {
  constructor(
    private supabase: SupabaseClient,
    private companyId: string
  ) {}

  async determineChannel(
    clientId: string,
    messageType: MessageType,
    senderType: 'ai' | 'human',
    manualChannel?: Channel
  ): Promise<Channel> {
    // 1. Se for seleção manual por humano e o tipo permite override
    const config = defaultMessageConfigs[messageType];
    if (senderType === 'human' && 
        manualChannel && 
        config.allowOverride) {
      return manualChannel;
    }

    // 2. Se tem canal predefinido e não permite override
    if (config.strategy === ChannelSelectionStrategy.PREDEFINED && 
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
      case ChannelSelectionStrategy.LAST_USED:
        return await this.getLastUsedChannel(clientId);
      
      case ChannelSelectionStrategy.MOST_USED:
        return await this.getMostUsedChannel(clientId);
      
      default:
        return config.defaultChannel || Channel.WHATSAPP; // Fallback seguro
    }
  }

  private async getLastUsedChannel(clientId: string): Promise<Channel> {
    const { data } = await this.supabase
      .from('interactions')
      .select('channel')
      .eq('client_id', clientId)
      .eq('company_id', this.companyId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    return data?.channel || Channel.WHATSAPP;
  }

  private async getMostUsedChannel(clientId: string): Promise<Channel> {
    // Análise dos últimos 30 dias
    const { data: interactions } = await this.supabase
      .from('interactions')
      .select('channel')
      .eq('client_id', clientId)
      .eq('company_id', this.companyId)
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    if (!interactions?.length) {
      return Channel.WHATSAPP;
    }

    const channelCounts = interactions.reduce((acc, { channel }) => {
      acc[channel] = (acc[channel] || 0) + 1;
      return acc;
    }, {} as Record<Channel, number>);

    return Object.entries(channelCounts)
      .sort(([,a], [,b]) => b - a)[0][0] as Channel;
  }
}
