interface ChatFloatingButtonProps {
  open: boolean;
  onClick: () => void;
}

export default function ChatFloatingButton({ open, onClick }: ChatFloatingButtonProps) {
  return (
    <button
      onClick={onClick}
      aria-label={open ? 'Fechar chat' : 'Abrir chat'}
      title={open ? 'Fechar chat (Esc)' : 'Abrir chat (/)'}
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        width: 52,
        height: 52,
        borderRadius: '50%',
        border: 'none',
        backgroundColor: '#1a73e8',
        color: '#fff',
        fontSize: 22,
        cursor: 'pointer',
        boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2147483647,
        transition: 'transform 0.15s ease, background-color 0.15s ease',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.08)')}
      onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
    >
      {open ? '✕' : '💬'}
    </button>
  );
}

