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
      className="bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 border border-neutral-300 dark:border-neutral-600"
      style={{
        position: 'fixed', top: y, left: x,
        borderRadius: 6, boxShadow: '0 2px 12px rgba(0,0,0,0.15)', zIndex: 1000, padding: 10,
        display: 'flex', flexDirection: 'column', gap: 8, minWidth: 180,
      }}
    >
      <label className="text-neutral-500 dark:text-neutral-400" style={{ fontSize: 11, fontWeight: 600 }}>Definir data do card</label>
      <input
        type="date"
        ref={inputRef}
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleSave()}
        className="bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 dark:border-neutral-600 dark:[color-scheme:dark]"
        style={{ padding: 6, fontSize: 13 }}
      />
      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        {value && (
          <button onClick={handleClear} className="text-red-600 dark:text-red-400" style={{ fontSize: 12, border: 'none', background: 'none', cursor: 'pointer', padding: '4px 8px' }}>
            Remover
          </button>
        )}
        <button onClick={handleSave} className="text-blue-600 dark:text-blue-400" style={{ fontSize: 12, border: 'none', background: 'none', cursor: 'pointer', padding: '4px 8px', fontWeight: 600 }}>
          Salvar
        </button>
      </div>
    </div>
  );
}
