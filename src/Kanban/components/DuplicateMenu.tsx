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

const INPUT_CLS = 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 dark:border-neutral-600 dark:[color-scheme:dark]';
const ROW_HOVER_CLS = 'hover:bg-neutral-100 dark:hover:bg-neutral-700';

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
      className="bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 border border-neutral-300 dark:border-neutral-600"
      style={{
        position: 'fixed', top: y, left: x,
        borderRadius: 6, boxShadow: '0 2px 12px rgba(0,0,0,0.15)', zIndex: 1000, minWidth: 220, padding: 6,
      }}
    >
      <button
        onClick={() => { onDuplicateOnce(); onClose(); }}
        className={ROW_HOVER_CLS}
        style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 8px', fontSize: 13, border: 'none', cursor: 'pointer', borderRadius: 4 }}
      >
        ⧉ Duplicar
      </button>
      <button
        onClick={() => setExpanded((v) => !v)}
        className={`text-blue-600 dark:text-blue-400 ${ROW_HOVER_CLS}`}
        style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 8px', fontSize: 13, border: 'none', cursor: 'pointer', borderRadius: 4 }}
      >
        ⧉ Duplicar várias vezes... {expanded ? '▲' : '▼'}
      </button>

      {expanded && (
        <div className="border-t border-neutral-200 dark:border-neutral-700" style={{ marginTop: 4, paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 6px' }}>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              onClick={() => setMode('numbered')}
              className={
                mode === 'numbered'
                  ? 'border border-blue-600 dark:border-blue-400 bg-indigo-50 dark:bg-indigo-950 text-neutral-900 dark:text-neutral-100'
                  : 'border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100'
              }
              style={{ flex: 1, fontSize: 11, padding: 6, borderRadius: 4, cursor: 'pointer' }}
            >Numerado</button>
            <button
              onClick={() => setMode('dates')}
              className={
                mode === 'dates'
                  ? 'border border-blue-600 dark:border-blue-400 bg-indigo-50 dark:bg-indigo-950 text-neutral-900 dark:text-neutral-100'
                  : 'border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100'
              }
              style={{ flex: 1, fontSize: 11, padding: 6, borderRadius: 4, cursor: 'pointer' }}
            >Datas</button>
          </div>

          {mode === 'numbered' && (
            <div>
              <label className="text-neutral-500 dark:text-neutral-400" style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>Quantidade</label>
              <input type="number" min={1} max={50} value={count} onChange={(e) => setCount(Number(e.target.value))} className={INPUT_CLS} style={{ width: '100%', padding: 4, fontSize: 12 }} />
            </div>
          )}

          {mode === 'numbered' ? (
            <div>
              <label className="text-neutral-500 dark:text-neutral-400" style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>Começar em</label>
              <input type="number" value={startAt} onChange={(e) => setStartAt(Number(e.target.value))} className={INPUT_CLS} style={{ width: '100%', padding: 4, fontSize: 12 }} />
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 6 }}>
              <div style={{ flex: 1 }}>
                <label className="text-neutral-500 dark:text-neutral-400" style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>De</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={INPUT_CLS} style={{ width: '100%', padding: 4, fontSize: 12 }} />
              </div>
              <div style={{ flex: 1 }}>
                <label className="text-neutral-500 dark:text-neutral-400" style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>Até</label>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={INPUT_CLS} style={{ width: '100%', padding: 4, fontSize: 12 }} />
              </div>
            </div>
          )}

          {mode === 'dates' && startDate && endDate && (
            <p className="text-neutral-500 dark:text-neutral-400" style={{ fontSize: 11, margin: 0 }}>
              {generateDailyDates(startDate, endDate).length > 0
                ? `${generateDailyDates(startDate, endDate).length} cópia(s), 1 por dia`
                : 'Data final precisa ser depois da inicial'}
            </p>
          )}

          <button
            onClick={submitMultiple}
            className="bg-blue-600 text-white"
            style={{ fontSize: 12, padding: '6px 8px', border: 'none', borderRadius: 4, cursor: 'pointer' }}
          >
            Duplicar
          </button>
        </div>
      )}
    </div>
  );
}
