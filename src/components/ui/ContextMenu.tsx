import { useEffect, useRef } from 'react';

export interface ContextMenuItem {
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  onHoverStart?: (rect: DOMRect) => void;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

const HOVER_DELAY = 250;

export default function ContextMenu({ x, y, items, onClose, onMouseEnter, onMouseLeave }: ContextMenuProps) {

  const ref = useRef<HTMLDivElement>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        position: 'fixed',
        top: y,
        left: x,
        backgroundColor: '#fff',
        border: '1px solid #ddd',
        borderRadius: 6,
        boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
        zIndex: 1000,
        minWidth: 160,
        padding: 4,
      }}
    >
      {items.map((item) => (
        <button
          key={item.label}
          onClick={() => { if (item.disabled) return; item.onClick(); onClose(); }}
          style={{
            display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: 13,
            border: 'none', background: 'none', cursor: item.disabled ? 'default' : 'pointer', borderRadius: 4,
            color: item.disabled ? '#999' : item.danger ? '#c62828' : '#000',
          }}
          onMouseEnter={(e) => {
            if (item.disabled) return;
            e.currentTarget.style.backgroundColor = '#f5f5f5';
            if (!item.onHoverStart) return;
            const rect = e.currentTarget.getBoundingClientRect();
            if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
            hoverTimerRef.current = setTimeout(() => item.onHoverStart!(rect), HOVER_DELAY);
          }}
          onMouseLeave={(e) => {
            if (item.disabled) return;
            e.currentTarget.style.backgroundColor = 'transparent';
            if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
