import { useEffect, useRef, useState } from 'react';

interface DueDateMenuProps {
  x: number;
  y: number;
  value: string | null;
  onSave: (value: string | null) => void;
  onClose: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export default function DueDateMenu({ x, y, value, onSave, onClose, onMouseEnter, onMouseLeave }: DueDateMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(value ?? '');

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  useEffect(() => {
    const el = inputRef.current;
    if (el && typeof el.showPicker === 'function') {
      try { el.showPicker(); } catch { /* alguns navegadores exigem gesto do usuário; ignora */ }
    }
  }, []);

  function handleSave() {
    onSave(draft || null);
    onClose();
  }

  function handleClear() {
    onSave(null);
    onClose();
  }

  return (
    <div
      ref={ref}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        position: 'fixed', top: y, left: x, backgroundColor: '#fff', border: '1px solid #ddd',
        borderRadius: 6, boxShadow: '0 2px 12px rgba(0,0,0,0.15)', zIndex: 1000, padding: 10,
        display: 'flex', flexDirection: 'column', gap: 8, minWidth: 180,
      }}
    >
      <label style={{ fontSize: 11, fontWeight: 600, color: '#666' }}>Definir data do card</label>
      <input
        type="date"
        ref={inputRef}
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleSave()}
        style={{ padding: 6, fontSize: 13 }}
      />
      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        {value && (
          <button onClick={handleClear} style={{ fontSize: 12, color: '#c62828', border: 'none', background: 'none', cursor: 'pointer', padding: '4px 8px' }}>
            Remover
          </button>
        )}
        <button onClick={handleSave} style={{ fontSize: 12, color: '#1a73e8', border: 'none', background: 'none', cursor: 'pointer', padding: '4px 8px', fontWeight: 600 }}>
          Salvar
        </button>
      </div>
    </div>
  );
}
