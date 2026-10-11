import { useEffect, useState, type ReactNode } from 'react';
import { STATUS_LABELS, STATUS_COLORS, type TaskStatus } from '@/types/kanban.types';

/* ----------------------------------------------------------------------------------------------- */
/* Estado (localStorage + aviso entre componentes): "agrupar por estado" por kanban, e quais seções  */
/* de estado estão recolhidas por escopo (coluna ou grupo).                                         */
/* ----------------------------------------------------------------------------------------------- */
const GROUP_PREFIX = 'kanban-group-by-status:';
const COLLAPSED_PREFIX = 'kanban-status-collapsed:';
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());

function readEnabled(kanbanId: string): boolean {
  try { return localStorage.getItem(GROUP_PREFIX + kanbanId) === '1'; } catch { return false; }
}
function readCollapsed(kanbanId: string, scopeId: string): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(`${COLLAPSED_PREFIX}${kanbanId}:${scopeId}`) ?? '[]') as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch { return []; }
}

function useTick(): void {
  const [, set] = useState(0);
  useEffect(() => {
    const fn = () => set((n) => n + 1);
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  }, []);
}

/** Liga/desliga o agrupamento por estado em todas as colunas/grupos do kanban. */
export function useGroupByStatus(kanbanId: string): [boolean, () => void] {
  useTick();
  const enabled = readEnabled(kanbanId);
  const toggle = () => {
    try { localStorage.setItem(GROUP_PREFIX + kanbanId, enabled ? '0' : '1'); } catch { /* ignora */ }
    notify();
  };
  return [enabled, toggle];
}

/** Botãozinho pra ligar/desligar (vai no cabeçalho da coluna). */
export function GroupByStatusButton({ kanbanId, className, style }: { kanbanId: string; className?: string; style?: React.CSSProperties }) {
  const [enabled, toggle] = useGroupByStatus(kanbanId);
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); toggle(); }}
      onPointerDown={(e) => e.stopPropagation()}
      title={enabled ? 'Desagrupar (voltar à ordem normal)' : 'Agrupar cards por estado'}
      className={className}
      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 11, opacity: enabled ? 1 : 0.6, textDecoration: enabled ? 'underline' : 'none', ...style }}
    >
      ◧ por estado
    </button>
  );
}

const ORDER: Array<TaskStatus | 'none'> = ['fazendo', 'fazer', 'revisao', 'pendente', 'none', 'feito'];

interface WithStatus { id: string; status: TaskStatus | null }

/**
 * Desenha os cards (via `renderCard`) — agrupados por estado, cada seção recolhível, quando o agrupamento está ligado;
 * senão desenha na ordem normal. `scopeId` = coluna ou grupo (cada escopo lembra o que recolheu).
 */
export function StatusSections<T extends WithStatus>({ kanbanId, scopeId, cards, renderCard, disabled, indent = 0 }: {
  kanbanId: string;
  scopeId: string;
  cards: T[];
  renderCard: (card: T) => ReactNode;
  disabled?: boolean;
  /** Recuo (px) do cabeçalho de cada seção — a árvore recua os cards por nível. */
  indent?: number;
}) {
  useTick();
  const enabled = !disabled && readEnabled(kanbanId);
  if (!enabled) return <>{cards.map((c) => renderCard(c))}</>;

  const collapsed = new Set(readCollapsed(kanbanId, scopeId));
  const toggle = (key: string) => {
    const next = new Set(collapsed);
    if (next.has(key)) next.delete(key); else next.add(key);
    try { localStorage.setItem(`${COLLAPSED_PREFIX}${kanbanId}:${scopeId}`, JSON.stringify([...next])); } catch { /* ignora */ }
    notify();
  };

  return (
    <>
      {ORDER.map((key) => {
        const list = cards.filter((c) => (c.status ?? 'none') === key);
        if (list.length === 0) return null;
        const isCollapsed = collapsed.has(key);
        const label = key === 'none' ? 'Sem estado' : STATUS_LABELS[key];
        const color = key === 'none' ? '#9e9e9e' : STATUS_COLORS[key];
        return (
          <div key={`status-section:${scopeId}:${key}`}>
            <button
              type="button"
              onClick={() => toggle(key)}
              onPointerDown={(e) => e.stopPropagation()}
              title={isCollapsed ? 'Expandir' : 'Recolher'}
              className="text-neutral-600 dark:text-neutral-300 hover:bg-black/5 dark:hover:bg-white/10"
              style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', border: 'none', background: 'none', cursor: 'pointer', padding: `3px 4px 3px ${4 + indent}px`, margin: '4px 0 2px', borderRadius: 4, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, textAlign: 'left' }}
            >
              <span style={{ fontSize: 9, width: 10 }}>{isCollapsed ? '▶' : '▼'}</span>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
              <span style={{ flex: 1 }}>{label}</span>
              <span style={{ fontWeight: 500, opacity: 0.7 }}>{list.length}</span>
            </button>
            {!isCollapsed && list.map((c) => renderCard(c))}
          </div>
        );
      })}
    </>
  );
}
