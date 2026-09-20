import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { KanbanColumn, KanbanCardGroup } from '@/types/kanban.types';
import { CardMoveTarget } from '@/lib/utils/CardMoveContext';

interface CardMoveMenuProps {
  x: number;
  y: number;
  columns: KanbanColumn[];
  groups: KanbanCardGroup[];
  /** Coluna onde o card está SOLTO agora (fica "atual" e desabilitada). null se está num grupo ou se são vários cards. */
  currentColumnId: string | null;
  /** Grupo/subgrupo onde o card está agora (fica "atual" e desabilitado). null se está solto ou se são vários cards. */
  currentGroupId: string | null;
  /** 1 = card único; >1 = mover em lote (só muda o título do popup). */
  cardCount: number;
  onMove: (target: CardMoveTarget) => void;
  onClose: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

const INDENT_PX = 14;

interface RowProps {
  depth: number;
  hasChildren: boolean;
  collapsed: boolean;
  onToggle: () => void;
  icon: ReactNode;
  label: string;
  bold?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

function Row({ depth, hasChildren, collapsed, onToggle, icon, label, bold, disabled, onClick }: RowProps) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => { if (!disabled) onClick(); }}
      title={disabled ? 'O card já está aqui' : undefined}
      style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '4px 8px', paddingLeft: 8 + depth * INDENT_PX,
        fontSize: 12, cursor: disabled ? 'default' : 'pointer',
        color: disabled ? '#aaa' : '#222',
        fontWeight: bold ? 600 : 400,
        backgroundColor: hover && !disabled ? '#e8f0fe' : 'transparent',
      }}
    >
      {hasChildren ? (
        <span
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          style={{ width: 14, fontSize: 9, color: '#666', textAlign: 'center', cursor: 'pointer', flexShrink: 0 }}
        >
          {collapsed ? '▶' : '▼'}
        </span>
      ) : (
        <span style={{ width: 14, flexShrink: 0 }} />
      )}
      <span style={{ flexShrink: 0 }}>{icon}</span>
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      {disabled && <span style={{ fontSize: 10, color: '#aaa' }}>(atual)</span>}
    </div>
  );
}

export default function CardMoveMenu({
  x, y, columns, groups, currentColumnId, currentGroupId, cardCount,
  onMove, onClose, onMouseEnter, onMouseLeave,
}: CardMoveMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // grupos top-level por coluna, e subgrupos por grupo-pai — ambos já ordenados por posição
  const { topGroupsByColumn, childrenByParent } = useMemo(() => {
    const top = new Map<string, KanbanCardGroup[]>();
    const children = new Map<string, KanbanCardGroup[]>();
    for (const g of groups) {
      const bucket = g.parentGroupId ? children : top;
      const key = g.parentGroupId ?? g.columnId;
      const list = bucket.get(key) ?? [];
      list.push(g);
      bucket.set(key, list);
    }
    for (const map of [top, children]) {
      for (const list of map.values()) list.sort((a, b) => a.position - b.position);
    }
    return { topGroupsByColumn: top, childrenByParent: children };
  }, [groups]);

  function toggle(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // mantém o popup inteiro dentro da janela (recalcula quando a árvore encolhe/expande)
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({
      left: Math.max(8, Math.min(x, window.innerWidth - r.width - 8)),
      top: Math.max(8, Math.min(y, window.innerHeight - r.height - 8)),
    });
  }, [x, y, collapsed]);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      e.stopPropagation(); // senão o Esc também limparia a seleção de cards do quadro
      onClose();
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  function renderGroup(g: KanbanCardGroup, depth: number): ReactNode {
    const kids = childrenByParent.get(g.id) ?? [];
    const isCurrent = g.id === currentGroupId;
    return (
      <div key={g.id}>
        <Row
          depth={depth}
          hasChildren={kids.length > 0}
          collapsed={collapsed.has(g.id)}
          onToggle={() => toggle(g.id)}
          icon={g.emoji ?? '📁'}
          label={g.name}
          disabled={isCurrent}
          onClick={() => onMove({ kind: 'group', groupId: g.id })}
        />
        {!collapsed.has(g.id) && kids.map((k) => renderGroup(k, depth + 1))}
      </div>
    );
  }

  return (
    <div
      ref={ref}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      // o popup fica dentro da árvore React do quadro (que tem handlers de mouse próprios) — não deixa o evento subir
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
      style={{
        position: 'fixed', left: pos.left, top: pos.top, zIndex: 10001,
        width: 240, maxHeight: 'min(420px, calc(100vh - 16px))', overflowY: 'auto',
        backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: 6,
        boxShadow: '0 4px 14px rgba(0,0,0,0.18)', padding: '4px 0',
      }}
    >
      <div style={{ padding: '4px 8px 6px', fontSize: 11, fontWeight: 600, color: '#888', borderBottom: '1px solid #eee', marginBottom: 2 }}>
        {cardCount > 1 ? `Mover ${cardCount} cards para…` : 'Mover para…'}
      </div>

      {columns.length === 0 && (
        <div style={{ padding: '8px', fontSize: 12, color: '#999' }}>Nenhuma coluna visível.</div>
      )}

      {columns.map((col) => {
        const topGroups = topGroupsByColumn.get(col.id) ?? [];
        const isCurrent = col.id === currentColumnId;
        return (
          <div key={col.id}>
            <Row
              depth={0}
              hasChildren={topGroups.length > 0}
              collapsed={collapsed.has(col.id)}
              onToggle={() => toggle(col.id)}
              icon={
                col.icon
                  ? col.icon
                  : <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', backgroundColor: col.color ?? '#bbb' }} />
              }
              label={col.name}
              bold
              disabled={isCurrent}
              onClick={() => onMove({ kind: 'column', columnId: col.id })}
            />
            {!collapsed.has(col.id) && topGroups.map((g) => renderGroup(g, 1))}
          </div>
        );
      })}
    </div>
  );
}
