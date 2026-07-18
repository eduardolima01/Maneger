import type { ProjectType } from '@/types/project.types';

export interface FlatSubtreeEntry {
  node: ProjectTreeNode;
  depth: number;
}

/** Acha o nó `rootId` dentro da floresta e retorna ele + toda a subárvore, achatada com profundidade (pra indentação em <select>). */
export function flattenSubtree(tree: ProjectTreeNode[], rootId: string): FlatSubtreeEntry[] {
  function findNode(nodes: ProjectTreeNode[]): ProjectTreeNode | null {
    for (const n of nodes) {
      if (n.id === rootId) return n;
      const found = findNode(n.children);
      if (found) return found;
    }
    return null;
  }

  const root = findNode(tree);
  if (!root) return [];

  const result: FlatSubtreeEntry[] = [];
  function walk(node: ProjectTreeNode, depth: number) {
    result.push({ node, depth });
    for (const child of node.children) walk(child, depth + 1);
  }
  walk(root, 0);
  return result;
}

export interface ProjectTreeNode extends ProjectType {
  children: ProjectTreeNode[];
}

export function buildProjectTree(flat: ProjectType[]): ProjectTreeNode[] {
  const byParent = new Map<string | null, ProjectType[]>();
  for (const p of flat) {
    const list = byParent.get(p.parentProjectId) ?? [];
    list.push(p);
    byParent.set(p.parentProjectId, list);
  }
  for (const list of byParent.values()) list.sort((a, b) => a.position - b.position);

  function attach(parentId: string | null): ProjectTreeNode[] {
    return (byParent.get(parentId) ?? []).map((p) => ({ ...p, children: attach(p.id) }));
  }

  return attach(null);
}

/** ids do subprojeto + todos os descendentes (incluindo ele mesmo) */
export function getSubtreeIds(flat: ProjectType[], rootId: string): string[] {
  const byParent = new Map<string | null, string[]>();
  for (const p of flat) {
    const list = byParent.get(p.parentProjectId) ?? [];
    list.push(p.id);
    byParent.set(p.parentProjectId, list);
  }

  const result: string[] = [rootId];
  function collect(id: string) {
    for (const childId of byParent.get(id) ?? []) {
      result.push(childId);
      collect(childId);
    }
  }
  collect(rootId);
  return result;
}

export function countDescendants(flat: ProjectType[], rootId: string): number {
  return getSubtreeIds(flat, rootId).length - 1;
}
