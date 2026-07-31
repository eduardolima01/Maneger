import { createPortal } from 'react-dom';
import ChatWindow from './ChatWindow';

interface ChatOverlayProps {
  open: boolean;
  focusToken: number;
  onClose: () => void;
}

export default function ChatOverlay({ open, focusToken, onClose }: ChatOverlayProps) {
  return createPortal(
    <>
      {open && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.08)',
            zIndex: 2147483645,
          }}
        />
      )}

      <div
        style={{
          position: 'fixed',
          bottom: 24,
          left: 24,
          width: 380,
          maxWidth: 'calc(100vw - 48px)',
          height: 520,
          maxHeight: 'calc(100vh - 120px)',
          backgroundColor: '#fff',
          borderRadius: 14,
          boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
          zIndex: 2147483646,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          transformOrigin: 'bottom left',
          transform: open ? 'scale(1) translateY(0)' : 'scale(0.9) translateY(12px)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'transform 0.18s ease, opacity 0.18s ease',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid #eee', backgroundColor: '#fafafa' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#333' }}>💬 Chat</span>
          <button
            onClick={onClose}
            style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 14, color: '#999' }}
          >
            ✕
          </button>
        </div>

        <div style={{ flex: 1, overflow: 'hidden' }}>
          <ChatWindow focusToken={focusToken} />
        </div>
      </div>
    </>,
    document.body
  );
}
