import type { KanbanChecklistItem } from '@/types/kanban.types';

export interface ChecklistTreeNode extends KanbanChecklistItem {
  children: ChecklistTreeNode[];
  /** Item "simples": marcado como lista simples (`simple`) OU dentro de uma. Sem estado e fora da conta de tarefas. */
  isSimple: boolean;
  /** Está DENTRO de uma lista simples marcada num ancestral — herda o modo e não pode alternar por conta própria. */
  inheritedSimple: boolean;
}

export function buildChecklistTree(items: KanbanChecklistItem[]): ChecklistTreeNode[] {
  const byParent = new Map<string | null, KanbanChecklistItem[]>();
  for (const item of items) {
    const list = byParent.get(item.parentItemId) ?? [];
    list.push(item);
    byParent.set(item.parentItemId, list);
  }
  for (const list of byParent.values()) list.sort((a, b) => a.position - b.position);

  function attach(parentId: string | null, inheritedSimple: boolean): ChecklistTreeNode[] {
    return (byParent.get(parentId) ?? []).map((item) => {
      const isSimple = inheritedSimple || !!item.simple;
      return { ...item, isSimple, inheritedSimple, children: attach(item.id, isSimple) };
    });
  }

  return attach(null, false);
}
