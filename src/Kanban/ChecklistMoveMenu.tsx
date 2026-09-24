import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { KanbanChecklistItem } from '@/types/kanban.types';
import { buildChecklistTree, ChecklistTreeNode } from './utils/checklistTree';

interface ChecklistMoveMenuProps {
  x: number;
  y: number;
  /** Todos os itens do card (lista plana) — o menu monta a árvore e tira o próprio item e os descendentes dele. */
  items: KanbanChecklistItem[];
  movingId: string;
  /** Escolheu um novo pai (null = virar tarefa principal). Vai pro fim dos filhos do destino. */
  onPickParent: (parentId: string | null) => void;
  /** Subir um nível: fica ao lado do antigo pai. Só existe se o item tem pai. */
  onOutdent: () => void;
  onClose: () => void;
}

const INDENT_PX = 12;

interface RowProps {
  depth?: number;
  label: string;
  hint?: string;
  strike?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

function Row({ depth = 0, label, hint, strike, disabled, onClick }: RowProps) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => { if (!disabled) onClick(); }}
      style={{
        display: 'flex', alignItems: 'center', gap: 4, fontSize: 12,
        padding: '4px 8px', paddingLeft: 8 + depth * INDENT_PX,
        cursor: disabled ? 'default' : 'pointer',
        color: disabled ? '#aaa' : '#222',
        backgroundColor: hover && !disabled ? '#e8f0fe' : 'transparent',
      }}
    >
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: strike ? 'line-through' : 'none' }}>
        {label}
      </span>
      {hint && <span style={{ fontSize: 10, color: '#aaa' }}>{hint}</span>}
    </div>
  );
}

const sectionLabel: React.CSSProperties = { padding: '6px 8px 2px', fontSize: 10, fontWeight: 600, color: '#888' };

/**
 * Menu "Mover item" da checklist: virar tarefa principal, subir um nível, ou virar sub-item de qualquer outro
 * item do card (inclusive de um sub-item). O próprio item e tudo que está dentro dele NÃO aparecem como destino —
 * mover um item pra dentro de si mesmo criaria um ciclo.
 */
export default function ChecklistMoveMenu({ x, y, items, movingId, onPickParent, onOutdent, onClose }: ChecklistMoveMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });

  const moving = items.find((i) => i.id === movingId);
  const currentParentId = moving?.parentItemId ?? null;
  const tree = useMemo(() => buildChecklistTree(items), [items]);

  function renderTargets(nodes: ChecklistTreeNode[], depth: number): ReactNode {
    return nodes
      .filter((n) => n.id !== movingId) // tirar o item já tira a subárvore inteira dele
      .map((n) => (
        <div key={n.id}>
          <Row
            depth={depth}
            label={n.title}
            strike={n.checked}
            hint={n.id === currentParentId ? '(atual)' : undefined}
            disabled={n.id === currentParentId}
            onClick={() => onPickParent(n.id)}
          />
          {renderTargets(n.children, depth + 1)}
        </div>
      ));
  }

  const hasTargets = items.some((i) => i.id !== movingId);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({
      left: Math.max(8, Math.min(x, window.innerWidth - r.width - 8)),
      top: Math.max(8, Math.min(y, window.innerHeight - r.height - 8)),
    });
  }, [x, y]);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      e.stopPropagation(); // senão o Esc também fecharia o modal de detalhes do card
      onClose();
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
      style={{
        position: 'fixed', left: pos.left, top: pos.top, zIndex: 20000,
        width: 240, maxHeight: 'min(360px, calc(100vh - 16px))', overflowY: 'auto',
        backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: 6,
        boxShadow: '0 4px 14px rgba(0,0,0,0.18)', padding: '4px 0',
      }}
    >
      {moving?.parentItemId && (
        <>
          <Row label="↰ Subir um nível" onClick={onOutdent} />
          <Row label="📌 Tornar tarefa principal" onClick={() => onPickParent(null)} />
        </>
      )}

      <div style={sectionLabel}>Tornar sub-item de…</div>
      {hasTargets ? renderTargets(tree, 0) : (
        <div style={{ padding: '4px 8px', fontSize: 12, color: '#999' }}>Não há outro item no card.</div>
      )}
    </div>
  );
}
