import { STATUS_LABELS, STATUS_COLORS } from '@/types/kanban.types';
import type { TaskStatus } from '@/types/kanban.types';

interface CardStatusMenuProps {
  x: number;
  y: number;
  value: TaskStatus | null;
  onSave: (status: TaskStatus | null) => void;
  onClose: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

const STATUS_ORDER: TaskStatus[] = ['pendente', 'fazer', 'fazendo', 'revisao', 'feito'];

export default function CardStatusMenu({ x, y, value, onSave, onClose, onMouseEnter, onMouseLeave }: CardStatusMenuProps) {
  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 border border-neutral-300 dark:border-neutral-600"
      style={{
        position: 'fixed', left: x, top: y, zIndex: 1000,
        borderRadius: 6,
        padding: 4, boxShadow: '0 2px 8px rgba(0,0,0,0.15)', minWidth: 140,
      }}
    >
      <button
        onClick={() => { onSave(null); onClose(); }}
        className={value === null ? 'bg-indigo-50 dark:bg-indigo-950 text-neutral-500 dark:text-neutral-400' : 'text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700'}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, width: '100%', textAlign: 'left',
          fontSize: 12, padding: '6px 8px', border: 'none', borderRadius: 4, cursor: 'pointer',
        }}
      >
        <span className="bg-neutral-300 dark:bg-neutral-600" style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0 }} />
        Nenhum
      </button>
      {STATUS_ORDER.map((status) => (
        <button
          key={status}
          onClick={() => { onSave(status); onClose(); }}
          className={value === status ? 'bg-indigo-50 dark:bg-indigo-950 text-neutral-900 dark:text-neutral-100' : 'text-neutral-900 dark:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-700'}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, width: '100%', textAlign: 'left',
            fontSize: 12, padding: '6px 8px', border: 'none', borderRadius: 4, cursor: 'pointer',
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: STATUS_COLORS[status], flexShrink: 0 }} />
          {STATUS_LABELS[status]}
        </button>
      ))}
    </div>
  );
}
