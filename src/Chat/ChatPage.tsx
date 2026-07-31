import ChatWindow from './components/ChatWindow';

export default function ChatPage() {
  return (
    <div style={{ height: 'calc(100vh - 2rem)', maxWidth: 700, margin: '1rem auto', border: '1px solid #e0e0e0', borderRadius: 8, overflow: 'hidden' }}>
      <ChatWindow />
    </div>
  );
}
