import { useEffect, useRef, useState } from 'react';

type Mode = 'numbered' | 'dates';
import { generateDailyDates } from '@/Kanban/utils/kanbanGenerators';

export type DuplicateMultipleMode =
  | { kind: 'numbered'; count: number; startAt: number }
  | { kind: 'dates'; startDate: string; endDate: string };

interface DuplicateMenuProps {
  x: number;
  y: number;
  onDuplicateOnce: () => void;
  onDuplicateMultiple: (mode: DuplicateMultipleMode) => void;
  onClose: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export default function DuplicateMenu({ x, y, onDuplicateOnce, onDuplicateMultiple, onClose, onMouseEnter, onMouseLeave }: DuplicateMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [mode, setMode] = useState<Mode>('numbered');
  const [count, setCount] = useState(3);
  const [startAt, setStartAt] = useState(1);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function handleEscape(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  function submitMultiple() {
    if (mode === 'numbered') {
      if (count < 1) return;
      onDuplicateMultiple({ kind: 'numbered', count, startAt });
      onClose();
      return;
    }
    if (!startDate || !endDate || generateDailyDates(startDate, endDate).length === 0) return;
    onDuplicateMultiple({ kind: 'dates', startDate, endDate });
    onClose();
  }

  return (
    <div
      ref={ref}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        position: 'fixed', top: y, left: x, backgroundColor: '#fff', border: '1px solid #ddd',
        borderRadius: 6, boxShadow: '0 2px 12px rgba(0,0,0,0.15)', zIndex: 1000, minWidth: 220, padding: 6,
      }}
    >
      <button
        onClick={() => { onDuplicateOnce(); onClose(); }}
        style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 8px', fontSize: 13, border: 'none', background: 'none', cursor: 'pointer', borderRadius: 4 }}
      >
        ⧉ Duplicar
      </button>
      <button
        onClick={() => setExpanded((v) => !v)}
        style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 8px', fontSize: 13, border: 'none', background: 'none', cursor: 'pointer', borderRadius: 4, color: '#1a73e8' }}
      >
        ⧉ Duplicar várias vezes... {expanded ? '▲' : '▼'}
      </button>

      {expanded && (
        <div style={{ borderTop: '1px solid #eee', marginTop: 4, paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 6px' }}>
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={() => setMode('numbered')} style={{ flex: 1, fontSize: 11, padding: 6, border: mode === 'numbered' ? '1px solid #1a73e8' : '1px solid #ddd', borderRadius: 4, background: mode === 'numbered' ? '#eef2ff' : '#fff', cursor: 'pointer' }}>Numerado</button>
            <button onClick={() => setMode('dates')} style={{ flex: 1, fontSize: 11, padding: 6, border: mode === 'dates' ? '1px solid #1a73e8' : '1px solid #ddd', borderRadius: 4, background: mode === 'dates' ? '#eef2ff' : '#fff', cursor: 'pointer' }}>Datas</button>
          </div>

          {mode === 'numbered' && (
            <div>
              <label style={{ fontSize: 11, color: '#666', display: 'block', marginBottom: 2 }}>Quantidade</label>
              <input type="number" min={1} max={50} value={count} onChange={(e) => setCount(Number(e.target.value))} style={{ width: '100%', padding: 4, fontSize: 12 }} />
            </div>
          )}

          {mode === 'numbered' ? (
            <div>
              <label style={{ fontSize: 11, color: '#666', display: 'block', marginBottom: 2 }}>Começar em</label>
              <input type="number" value={startAt} onChange={(e) => setStartAt(Number(e.target.value))} style={{ width: '100%', padding: 4, fontSize: 12 }} />
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 6 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: '#666', display: 'block', marginBottom: 2 }}>De</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ width: '100%', padding: 4, fontSize: 12 }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: '#666', display: 'block', marginBottom: 2 }}>Até</label>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ width: '100%', padding: 4, fontSize: 12 }} />
              </div>
            </div>
          )}

          {mode === 'dates' && startDate && endDate && (
            <p style={{ fontSize: 11, color: '#666', margin: 0 }}>
              {generateDailyDates(startDate, endDate).length > 0
                ? `${generateDailyDates(startDate, endDate).length} cópia(s), 1 por dia`
                : 'Data final precisa ser depois da inicial'}
            </p>
          )}

          <button
            onClick={submitMultiple}
            style={{ fontSize: 12, padding: '6px 8px', border: 'none', borderRadius: 4, backgroundColor: '#1a73e8', color: '#fff', cursor: 'pointer' }}
          >
            Duplicar
          </button>
        </div>
      )}
    </div>
  );
}
