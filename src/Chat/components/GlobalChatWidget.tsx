import { useEffect } from 'react';
import ChatFloatingButton from './ChatFloatingButton';
import ChatOverlay from './ChatOverlay';
import { useChatWidgetState } from '../hooks/useChatWidgetState';
import { isTypingContext } from '../utils/focusContext';

export default function GlobalChatWidget() {
  const { open, openChat, closeChat, toggleChat, openToken } = useChatWidgetState();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === '/' && !open) {
        if (isTypingContext(document.activeElement)) return;
        e.preventDefault();
        openChat();
        return;
      }
      if (e.key === 'Escape' && open) {
        closeChat();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, openChat, closeChat]);

  return (
    <>
      <ChatFloatingButton open={open} onClick={toggleChat} />
      <ChatOverlay open={open} focusToken={openToken} onClose={closeChat} />
    </>
  );
}
