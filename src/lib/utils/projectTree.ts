import type { ProjectType } from '@/types/project.types';

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
