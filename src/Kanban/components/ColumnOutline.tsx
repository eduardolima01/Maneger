import { useMemo } from 'react';
import type { KanbanCard, KanbanCardGroup, KanbanColumn } from '@/types/kanban.types';

interface ColumnOutlineProps {
  column: KanbanColumn;
  /** Todos os grupos E subgrupos desta coluna (subgrupo se reconhece por `parentGroupId`). */
  groups: KanbanCardGroup[];
  cardsByGroup: Map<string, KanbanCard[]>;
  /** Cards da coluna que não estão em nenhum grupo. */
  looseCardCount: number;
  collapsedGroupIds: Set<string>;
  onChangeCollapsed: (nextCollapsedIds: string[]) => void;
  onExit: () => void;
}

const INDENT_PX = 12;

/**
 * Painel lateral do "modo foco" de uma coluna: mostra a árvore de grupos e subgrupos (com a contagem de cards de
 * cada um, contando os subgrupos) e leva até o bloco ao clicar. Existe porque, com a coluna aberta em tela cheia, achar
 * um subgrupo no meio de muitos blocos é justamente o que atrapalha.
 */
export default function ColumnOutline({ column, groups, cardsByGroup, looseCardCount, collapsedGroupIds, onChangeCollapsed, onExit }: ColumnOutlineProps) {
  const { topGroups, childrenByParent, parentById } = useMemo(() => {
    const children = new Map<string, KanbanCardGroup[]>();
    const parents = new Map<string, string | null>();
    const top: KanbanCardGroup[] = [];
    for (const g of groups) {
      parents.set(g.id, g.parentGroupId);
      if (g.parentGroupId) {
        const list = children.get(g.parentGroupId) ?? [];
        list.push(g);
        children.set(g.parentGroupId, list);
      } else {
        top.push(g);
      }
    }
    top.sort((a, b) => a.position - b.position);
    for (const list of children.values()) list.sort((a, b) => a.position - b.position);
    return { topGroups: top, childrenByParent: children, parentById: parents };
  }, [groups]);

  /** Cards do grupo + de todos os subgrupos dele (qualquer profundidade). */
  function countCards(groupId: string): number {
    let total = cardsByGroup.get(groupId)?.length ?? 0;
    for (const child of childrenByParent.get(groupId) ?? []) total += countCards(child.id);
    return total;
  }

  const totalCards = looseCardCount + topGroups.reduce((sum, g) => sum + countCards(g.id), 0);
  const topIds = topGroups.map((g) => g.id);

  function scrollToGroup(groupId: string) {
    const el = document.querySelector<HTMLElement>(`[data-group-id="${groupId}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // pisca um contorno pra mostrar qual foi — animação direta no elemento, sem estado
    el.animate(
      [{ boxShadow: '0 0 0 3px #1a73e8' }, { boxShadow: '0 0 0 0 rgba(26,115,232,0)' }],
      { duration: 1400, easing: 'ease-out' }
    );
  }

  function goTo(groupId: string) {
    // subgrupo dentro de um grupo recolhido nem existe no DOM: abre os ancestrais e rola depois do render
    const ancestors = new Set<string>();
    let cursor = parentById.get(groupId) ?? null;
    while (cursor && !ancestors.has(cursor)) {
      ancestors.add(cursor);
      cursor = parentById.get(cursor) ?? null;
    }
    const mustExpand = Array.from(ancestors).filter((id) => collapsedGroupIds.has(id));
    if (mustExpand.length > 0) {
      onChangeCollapsed(Array.from(collapsedGroupIds).filter((id) => !mustExpand.includes(id)));
      setTimeout(() => scrollToGroup(groupId), 120);
    } else {
      scrollToGroup(groupId);
    }
  }

  function renderGroup(g: KanbanCardGroup, depth: number): React.ReactNode {
    const kids = childrenByParent.get(g.id) ?? [];
    const collapsed = collapsedGroupIds.has(g.id);
    return (
      <div key={g.id}>
        <div
          onClick={() => goTo(g.id)}
          title={g.name}
          className="hover:bg-blue-50 dark:hover:bg-neutral-700"
          style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '4px 6px', paddingLeft: 6 + depth * INDENT_PX,
            fontSize: 12, cursor: 'pointer', borderRadius: 4,
          }}
        >
          <span style={{ flexShrink: 0, fontSize: 12 }}>{g.emoji ?? (depth === 0 ? '📁' : '↳')}</span>
          <span className="text-neutral-900 dark:text-neutral-100" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: depth === 0 ? 600 : 400 }}>
            {g.name}
          </span>
          {collapsed && <span title="Grupo recolhido" className="text-neutral-400 dark:text-neutral-500" style={{ fontSize: 9 }}>▶</span>}
          <span className="text-neutral-400 dark:text-neutral-500" style={{ fontSize: 10 }}>{countCards(g.id)}</span>
        </div>
        {kids.map((k) => renderGroup(k, depth + 1))}
      </div>
    );
  }

  const btn: React.CSSProperties = {
    fontSize: 11, background: 'none', border: 'none', cursor: 'pointer', padding: 0,
  };
  const BTN_CLS = 'text-blue-600 dark:text-blue-400';

  return (
    <div
      onMouseDown={(e) => e.stopPropagation()} // o quadro tem seleção por arrastar; clicar aqui não deve começar uma
      className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700"
      style={{
        width: 230, flexShrink: 0, alignSelf: 'flex-start', position: 'sticky', top: 8,
        maxHeight: 'calc(100vh - 24px)', overflowY: 'auto',
        borderRadius: 8, padding: 8,
      }}
    >
      <button onClick={onExit} className={BTN_CLS} style={{ ...btn, marginBottom: 6 }}>← Todas as colunas</button>
      <div className="text-neutral-900 dark:text-neutral-100" style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={column.name}>
        {column.icon ? `${column.icon} ` : ''}{column.name}
      </div>
      <div className="text-neutral-500 dark:text-neutral-400" style={{ fontSize: 11, marginBottom: 6 }}>
        {topGroups.length} grupo{topGroups.length !== 1 ? 's' : ''} · {totalCards} card{totalCards !== 1 ? 's' : ''}
      </div>

      {topGroups.length > 0 && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 6 }}>
          <button onClick={() => onChangeCollapsed(Array.from(new Set([...collapsedGroupIds, ...topIds])))} className={BTN_CLS} style={btn}>Recolher grupos</button>
          <button onClick={() => onChangeCollapsed(Array.from(collapsedGroupIds).filter((id) => !topIds.includes(id)))} className={BTN_CLS} style={btn}>Expandir grupos</button>
        </div>
      )}

      <div className="border-t border-neutral-200 dark:border-neutral-700" style={{ paddingTop: 4 }}>
        {topGroups.length === 0 && <div className="text-neutral-400 dark:text-neutral-500" style={{ fontSize: 12, padding: '4px 6px' }}>Esta coluna não tem grupos.</div>}
        {topGroups.map((g) => renderGroup(g, 0))}
        {looseCardCount > 0 && (
          <div className="text-neutral-400 dark:text-neutral-500" style={{ fontSize: 11, padding: '6px 6px 2px' }}>
            + {looseCardCount} card{looseCardCount !== 1 ? 's' : ''} sem grupo
          </div>
        )}
      </div>
    </div>
  );
}
