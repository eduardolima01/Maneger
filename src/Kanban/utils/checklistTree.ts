import type { KanbanChecklistItem } from '@/types/kanban.types';

export interface ChecklistTreeNode extends KanbanChecklistItem {
  children: ChecklistTreeNode[];
}

export function buildChecklistTree(items: KanbanChecklistItem[]): ChecklistTreeNode[] {
  const byParent = new Map<string | null, KanbanChecklistItem[]>();
  for (const item of items) {
    const list = byParent.get(item.parentItemId) ?? [];
    list.push(item);
    byParent.set(item.parentItemId, list);
  }
  for (const list of byParent.values()) list.sort((a, b) => a.position - b.position);

  function attach(parentId: string | null): ChecklistTreeNode[] {
    return (byParent.get(parentId) ?? []).map((item) => ({ ...item, children: attach(item.id) }));
  }

  return attach(null);
}
