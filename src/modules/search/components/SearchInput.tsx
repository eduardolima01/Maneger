import { useEffect, useRef } from 'react';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  focusToken: number;
  loading: boolean;
}

export default function SearchInput({ value, onChange, onKeyDown, focusToken, loading }: SearchInputProps) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select(); // "selecionar todo o texto existente" ao abrir
  }, [focusToken]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 16px', borderBottom: '1px solid #eee' }}>
      <span style={{ fontSize: 16, color: '#999' }}>🔍</span>
      <input
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Pesquisar..."
        style={{ flex: 1, border: 'none', outline: 'none', fontSize: 16, background: 'transparent' }}
      />
      {loading && <span style={{ fontSize: 11, color: '#999' }}>...</span>}
      <kbd style={{ fontSize: 10, color: '#999', border: '1px solid #ddd', borderRadius: 4, padding: '2px 5px' }}>Esc</kbd>
    </div>
  );
}

