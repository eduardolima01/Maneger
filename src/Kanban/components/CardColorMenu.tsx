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
      className="bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 border border-neutral-300 dark:border-neutral-600"
      style={{
        position: 'fixed', top: y, left: x,
        borderRadius: 6, boxShadow: '0 2px 12px rgba(0,0,0,0.15)', zIndex: 1000, padding: 10,
        display: 'flex', flexDirection: 'column', gap: 8, minWidth: 160,
      }}
    >
      <label className="text-neutral-500 dark:text-neutral-400" style={{ fontSize: 11, fontWeight: 600 }}>Cor do card</label>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {LABEL_COLOR_PALETTE.map((c) => (
          <button
            key={c}
            onClick={() => { onSave(c); onClose(); }}
            className={value === c ? 'border-2 border-black dark:border-white' : 'border border-black/15 dark:border-white/25'}
            style={{ width: 20, height: 20, borderRadius: 4, backgroundColor: c, cursor: 'pointer', padding: 0 }}
          />
        ))}
      </div>

      <div className="border-t border-neutral-200 dark:border-neutral-700" style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 8 }}>
        <input
          type="color"
          value={value ?? '#cccccc'}
          onChange={(e) => onSave(e.target.value)}
          className="border border-neutral-300 dark:border-neutral-600" style={{ width: 28, height: 28, padding: 0, borderRadius: 4, cursor: 'pointer' }}
        />
        <span className="text-neutral-500 dark:text-neutral-400" style={{ fontSize: 12 }}>Cor personalizada</span>
      </div>

      {value && (
        <button
          onClick={() => { onSave(null); onClose(); }}
          className="text-red-600 dark:text-red-400"
          style={{ fontSize: 12, border: 'none', background: 'none', cursor: 'pointer', padding: '4px 0', textAlign: 'left' }}
        >
          Remover cor
        </button>
      )}
    </div>
  );
}
