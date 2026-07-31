import type { ChatMessage } from '../types/message.types';

export default function ChatMessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.type === 'user';
  const isError = message.status === 'error';

  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
      <div
        style={{
          maxWidth: '70%', padding: '8px 12px', borderRadius: 10, fontSize: 14,
          fontFamily: isUser ? undefined : 'monospace',
          backgroundColor: isUser ? '#1a73e8' : isError ? '#fce8e6' : '#f1f3f4',
          color: isUser ? '#fff' : isError ? '#c62828' : '#333',
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        }}
      >
        {message.text}
      </div>
    </div>
  );
}
