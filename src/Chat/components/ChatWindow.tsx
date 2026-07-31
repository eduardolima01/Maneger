import { useEffect, useRef } from 'react';
import ChatMessageBubble from './ChatMessageBubble';
import ChatInput from './ChatInput';
import { useChat } from '../hooks/useChat';

export default function ChatWindow({ focusToken }: { focusToken?: number }) {
  const { messages, loading, sending, sendMessage } = useChat();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  if (loading) return <p style={{ padding: 16, color: '#666' }}>Carregando conversa...</p>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {messages.length === 0 && (
          <p style={{ color: '#999', fontSize: 13, textAlign: 'center' }}>
            Nenhuma mensagem ainda. Experimente <code>!note "sua nota"</code>
          </p>
        )}
        {messages.map((m) => <ChatMessageBubble key={m.id} message={m} />)}
        <div ref={bottomRef} />
      </div>
      <ChatInput onSend={sendMessage} disabled={sending} focusToken={focusToken} />
    </div>
  );
}
