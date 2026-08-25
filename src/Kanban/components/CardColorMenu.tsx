import { useEffect, useRef } from 'react';
import { LABEL_COLOR_PALETTE } from '@/Kanban/utils/kanbanLabels';

interface CardColorMenuProps {
  x: number;
  y: number;
  value: string | null;
  onSave: (color: string | null) => void;
  onClose: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export default function CardColorMenu({ x, y, value, onSave, onClose, onMouseEnter, onMouseLeave }: CardColorMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

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

  return (
    <div
      ref={ref}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        position: 'fixed', top: y, left: x, backgroundColor: '#fff', border: '1px solid #ddd',
        borderRadius: 6, boxShadow: '0 2px 12px rgba(0,0,0,0.15)', zIndex: 1000, padding: 10,
        display: 'flex', flexDirection: 'column', gap: 8, minWidth: 160,
      }}
    >
      <label style={{ fontSize: 11, fontWeight: 600, color: '#666' }}>Cor do card</label>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {LABEL_COLOR_PALETTE.map((c) => (
          <button
            key={c}
            onClick={() => { onSave(c); onClose(); }}
            style={{
              width: 20, height: 20, borderRadius: 4, backgroundColor: c, cursor: 'pointer',
              border: value === c ? '2px solid #000' : '1px solid rgba(0,0,0,0.15)', padding: 0,
            }}
          />
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderTop: '1px solid #eee', paddingTop: 8 }}>
        <input
          type="color"
          value={value ?? '#cccccc'}
          onChange={(e) => onSave(e.target.value)}
          style={{ width: 28, height: 28, padding: 0, border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer' }}
        />
        <span style={{ fontSize: 12, color: '#666' }}>Cor personalizada</span>
      </div>

      {value && (
        <button
          onClick={() => { onSave(null); onClose(); }}
          style={{ fontSize: 12, color: '#c62828', border: 'none', background: 'none', cursor: 'pointer', padding: '4px 0', textAlign: 'left' }}
        >
          Remover cor
        </button>
      )}
    </div>
  );
}
