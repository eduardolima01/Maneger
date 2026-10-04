import { CHECKLIST_STATUS_LABELS, CHECKLIST_STATUS_COLORS } from '@/types/kanban.types';
import type { ChecklistItemStatus } from '@/types/kanban.types';

const STATUS_ORDER: ChecklistItemStatus[] = ['not_started', 'in_progress', 'done'];

/** Ícone do estado: círculo vazio (não iniciado), círculo meio preenchido (em andamento) e check (feito). Usa currentColor. */
function StatusIcon({ status, size }: { status: ChecklistItemStatus; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ display: 'block' }}>
      {status === 'not_started' && (
        <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.8" />
      )}
      {status === 'in_progress' && (
        <>
          <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.8" />
          <path d="M8 2.5a5.5 5.5 0 0 1 0 11z" fill="currentColor" />
        </>
      )}
      {status === 'done' && (
        <path d="M3.5 8.5l3 3 6-6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

interface ChecklistStatusButtonsProps {
  status: ChecklistItemStatus;
  onChange: (status: ChecklistItemStatus) => void;
  /** Lado de cada botão em px. 22 no modal, 16 no corpo do card. */
  size?: number;
}

/**
 * Os três estados lado a lado, só com ícone (o nome fica no tooltip): o atual aparece cheio, na cor do estado,
 * e os outros apagados — clicar num deles muda o estado.
 */
export default function ChecklistStatusButtons({ status, onChange, size = 22 }: ChecklistStatusButtonsProps) {
  const iconSize = Math.round(size * 0.66);
  return (
    <div role="group" aria-label="Estado da tarefa" style={{ display: 'inline-flex', gap: size >= 20 ? 3 : 2, flexShrink: 0 }}>
      {STATUS_ORDER.map((s) => {
        const active = s === status;
        const textCls = s === 'not_started' ? 'text-neutral-800' : 'text-white'; // o cinza do "não iniciado" é claro: ícone escuro
        return (
          <button
            key={s}
            type="button"
            onClick={(e) => { e.stopPropagation(); if (!active) onChange(s); }}
            title={CHECKLIST_STATUS_LABELS[s]}
            aria-label={CHECKLIST_STATUS_LABELS[s]}
            aria-pressed={active}
            className={`${textCls} ${active ? '' : 'opacity-40 hover:opacity-70'}`}
            style={{
              width: size, height: size, padding: 0, borderRadius: 4, border: 'none',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              cursor: active ? 'default' : 'pointer', backgroundColor: CHECKLIST_STATUS_COLORS[s],
            }}
          >
            <StatusIcon status={s} size={iconSize} />
          </button>
        );
      })}
    </div>
  );
}
