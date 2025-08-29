import React, { useState } from 'react'
import { Channel, MessageType, ChannelSelectionStrategy, defaultMessageConfigs } from '../schemas/message'

interface Props {
  onSend: (message: string, channel: Channel) => void;
  defaultType?: MessageType;
}

export const MessageComposer: React.FC<Props> = ({ 
  onSend, 
  defaultType = MessageType.GENERAL 
}) => {
  const [messageType, setMessageType] = useState<MessageType>(defaultType);
  const [channelStrategy, setChannelStrategy] = useState<ChannelSelectionStrategy>(
    ChannelSelectionStrategy.LAST_USED
  );
  const [manualChannel, setManualChannel] = useState<Channel | null>(null);
  const [message, setMessage] = useState('');
  
  const config = defaultMessageConfigs[messageType];

  const handleSend = () => {
    if (!message.trim()) return;
    
    // Canal será determinado pelo backend usando a estratégia selecionada
    onSend(message, manualChannel || Channel.WHATSAPP);
    setMessage('');
  };

  return (
    <div className="p-4 space-y-4">
      {/* Tipo da mensagem */}
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Tipo de Mensagem
        </label>
        <select
          value={messageType}
          onChange={e => setMessageType(e.target.value as MessageType)}
          className="mt-1 block w-full rounded-md border-gray-300"
        >
          {Object.values(MessageType).map(type => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>

      {/* Estratégia de canal */}
      {config.allowOverride && (
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Seleção de Canal
          </label>
          <select
            value={channelStrategy}
            onChange={e => setChannelStrategy(e.target.value as ChannelSelectionStrategy)}
            className="mt-1 block w-full rounded-md border-gray-300"
          >
            <option value={ChannelSelectionStrategy.LAST_USED}>
              Último Canal Usado
            </option>
            <option value={ChannelSelectionStrategy.MOST_USED}>
              Canal Mais Usado
            </option>
            <option value={ChannelSelectionStrategy.MANUAL}>
              Escolher Manualmente
            </option>
          </select>
        </div>
      )}

      {/* Seleção manual de canal */}
      {channelStrategy === ChannelSelectionStrategy.MANUAL && config.allowOverride && (
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Canal
          </label>
          <select
            value={manualChannel || ''}
            onChange={e => setManualChannel(e.target.value as Channel)}
            className="mt-1 block w-full rounded-md border-gray-300"
          >
            <option value={Channel.WHATSAPP}>WhatsApp</option>
            <option value={Channel.INSTAGRAM}>Instagram</option>
          </select>
        </div>
      )}

      {/* Indicador de canal que será usado */}
      <div className="text-sm text-gray-500">
        {config.strategy === ChannelSelectionStrategy.PREDEFINED ? (
          <span>Mensagem será enviada via {config.defaultChannel}</span>
        ) : channelStrategy === ChannelSelectionStrategy.MANUAL ? (
          <span>Mensagem será enviada via {manualChannel}</span>
        ) : (
          <span>Canal será determinado automaticamente ({channelStrategy})</span>
        )}
      </div>

      {/* Campo de mensagem */}
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Mensagem
        </label>
        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300"
          rows={4}
          placeholder="Digite sua mensagem..."
        />
      </div>

      {/* Botão de envio */}
      <button
        onClick={handleSend}
        disabled={!message.trim()}
        className="w-full bg-clinic-blue text-white py-2 px-4 rounded-md disabled:opacity-50"
      >
        Enviar
      </button>
    </div>
  );
};
