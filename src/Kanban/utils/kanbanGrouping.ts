import { ProjectTreeNode } from '@/lib/utils/projectTree';
import type { KanbanWithProject } from '@/types/kanban.types';

export interface KanbanTreeGroup {
  project: ProjectTreeNode;
  kanbans: KanbanWithProject[];
  children: KanbanTreeGroup[];
}

/**
 * Monta a árvore de grupos só com os ramos que têm Kanban (próprio ou em
 * algum descendente) — projeto sem nenhum Kanban em toda a subárvore nem
 * aparece.
 */
export function buildKanbanGroupTree(
  tree: ProjectTreeNode[],
  kanbansByProjectId: Map<string, KanbanWithProject[]>
): KanbanTreeGroup[] {
  function hasKanbanInSubtree(node: ProjectTreeNode): boolean {
    if ((kanbansByProjectId.get(node.id)?.length ?? 0) > 0) return true;
    return node.children.some(hasKanbanInSubtree);
  }

  function build(node: ProjectTreeNode): KanbanTreeGroup | null {
    if (!hasKanbanInSubtree(node)) return null;
    const children = node.children.map(build).filter((c: any): c is KanbanTreeGroup => c !== null);
    return { project: node, kanbans: kanbansByProjectId.get(node.id) ?? [], children };
  }

  return tree.map(build).filter((g): g is KanbanTreeGroup => g !== null);
}
