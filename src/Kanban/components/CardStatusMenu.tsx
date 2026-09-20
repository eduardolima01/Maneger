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
      style={{
        position: 'fixed', left: x, top: y, zIndex: 1000,
        background: '#fff', border: '1px solid #e0e0e0', borderRadius: 6,
        padding: 4, boxShadow: '0 2px 8px rgba(0,0,0,0.15)', minWidth: 140,
      }}
    >
      <button
        onClick={() => { onSave(null); onClose(); }}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, width: '100%', textAlign: 'left',
          fontSize: 12, padding: '6px 8px', border: 'none', borderRadius: 4, cursor: 'pointer',
          background: value === null ? '#eef2ff' : 'transparent', color: '#666',
        }}
      >
        <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#e0e0e0', flexShrink: 0 }} />
        Nenhum
      </button>
      {STATUS_ORDER.map((status) => (
        <button
          key={status}
          onClick={() => { onSave(status); onClose(); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, width: '100%', textAlign: 'left',
            fontSize: 12, padding: '6px 8px', border: 'none', borderRadius: 4, cursor: 'pointer',
            background: value === status ? '#eef2ff' : 'transparent', color: '#333',
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: STATUS_COLORS[status], flexShrink: 0 }} />
          {STATUS_LABELS[status]}
        </button>
      ))}
    </div>
  );
}
