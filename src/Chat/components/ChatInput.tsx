import { useEffect, useRef, useState } from 'react';

export default function ChatInput({ onSend, disabled, focusToken }: { onSend: (text: string) => void; disabled?: boolean; focusToken?: number }) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (focusToken !== undefined) inputRef.current?.focus();
  }, [focusToken]);

  function handleSend() {
    if (!value.trim()) return;
    onSend(value);
    setValue('');
  }

  return (
    <div style={{ display: 'flex', gap: 8, padding: 12, borderTop: '1px solid #e0e0e0' }}>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
        placeholder='Digite uma mensagem ou !note "sua nota"'
        disabled={disabled}
        style={{ flex: 1, padding: 10, fontSize: 14, border: '1px solid #ccc', borderRadius: 6, fontFamily: 'monospace' }}
      />
      <button
        onClick={handleSend}
        disabled={disabled || !value.trim()}
        style={{ padding: '10px 16px', fontSize: 14, border: 'none', borderRadius: 6, backgroundColor: value.trim() ? '#1a73e8' : '#ccc', color: '#fff', cursor: value.trim() ? 'pointer' : 'default' }}
      >
        Enviar
      </button>
    </div>
  );
}
