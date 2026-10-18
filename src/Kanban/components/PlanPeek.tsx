import { useCallback, useEffect, useRef, useState } from 'react';
import { updateCard } from '@/lib/api/kanban/kanbanCards';
import PlanTracker from '@/Kanban/components/PlanTracker';
import type { KanbanCard } from '@/types/kanban.types';

/**
 * Acompanhamento do plano aberto ABAIXO do card (sem abrir o card no painel do lado):
 *  - PlanToggleButton: o botão 📊 do card (liga/desliga);
 *  - PlanPanel: o bloco com gráfico de contribuições, tarefas do dia e relatório, desenhado logo embaixo do card.
 * Marcar um dia grava direto no card (planDayChecks); o quadro atualiza pelo sync normal.
 */
export function PlanToggleButton({ open, onToggle, size = 12, className, style }: {
  open: boolean;
  onToggle: () => void;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <button
      type="button"
      title={open ? 'Fechar o acompanhamento do plano' : 'Abrir o acompanhamento do plano (gráfico, tarefas do dia e relatório)'}
      aria-label={open ? 'Fechar acompanhamento do plano' : 'Abrir acompanhamento do plano'}
      aria-expanded={open}
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      className={className ?? (open
        ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300'
        : 'text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-600')}
      style={{ border: 'none', cursor: 'pointer', borderRadius: 3, padding: '0 3px', fontSize: size, lineHeight: 1.3, flexShrink: 0, background: open ? undefined : 'none', ...style }}
    >
      📊
    </button>
  );
}

export default function PlanPanel({ card, onClose, style }: { card: KanbanCard; onClose: () => void; style?: React.CSSProperties }) {
  // cópia local dos checks: o quadrado muda na hora, sem esperar o arquivo ser regravado e relido
  const [checks, setChecks] = useState<Record<string, string[]>>(card.planDayChecks ?? {});
  useEffect(() => { setChecks(card.planDayChecks ?? {}); }, [card.planDayChecks]);
  const saveChain = useRef<Promise<unknown>>(Promise.resolve());

  const persist = useCallback((patch: { planDayChecks: Record<string, string[]> }) => {
    setChecks(patch.planDayChecks);
    // uma gravação por vez: cada updateCard lê e regrava o JSON inteiro
    saveChain.current = saveChain.current.then(() => updateCard(card.id, patch)).catch(() => { });
  }, [card.id]);

  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <div
      onClick={stop}
      onDoubleClick={stop}
      onPointerDown={stop}
      onContextMenu={stop}
      onKeyDown={stop}
      className="bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 border border-neutral-200 dark:border-neutral-600"
      style={{ padding: 8, borderRadius: 6, marginBottom: 8, boxSizing: 'border-box', cursor: 'default', ...style }}
    >
      <div className="text-neutral-500 dark:text-neutral-400" style={{ display: 'flex', alignItems: 'center', fontSize: 11, fontWeight: 700, marginBottom: 6 }}>
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📊 {card.title}</span>
        <button type="button" onClick={onClose} aria-label="Fechar" style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'inherit', fontSize: 12 }}>✕</button>
      </div>
      <PlanTracker card={{ ...card, planDayChecks: checks }} onUpdate={persist} />
    </div>
  );
}
