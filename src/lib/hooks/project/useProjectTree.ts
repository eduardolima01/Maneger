import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import * as api from '@/lib/api/projects';
import { buildProjectTree, getSubtreeIds } from '@/lib/utils/projectTree';
import type { ProjectType, CreateProjectInput } from '@/types/project.types';

export function useProjectTree() {
  const [flat, setFlat] = useState<ProjectType[]>([]);

  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const reload = useCallback(async () => {
    setLoading(true);
    const data = await api.getAllProjects();
    setFlat(data);
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const tree = buildProjectTree(flat);

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const createProject = useCallback(async (input: CreateProjectInput) => {
    const id = await api.createProject(input);
    await reload();
    if (input.parentProjectId) setExpandedIds((prev) => new Set(prev).add(input.parentProjectId!));
    return id;
  }, [reload]);

  const rename = useCallback(async (id: string, name: string) => {
    await api.updateProject(id, { name });
    await reload();
  }, [reload]);

  const duplicate = useCallback(async (id: string) => {
    await api.duplicateProject(id);
    await reload();
  }, [reload]);

  /** true = ok, false = moveria pra dentro do próprio descendente (ciclo, bloqueado) */
  const move = useCallback(async (id: string, newParentId: string | null): Promise<boolean> => {
    if (newParentId) {
      const forbidden = getSubtreeIds(flat, id); // inclui o próprio id
      if (forbidden.includes(newParentId)) return false;
    }
    await api.moveProject(id, newParentId);
    await reload();
    return true;
  }, [flat, reload]);

  const reorderSiblings = useCallback(async (orderedIds: string[]) => {
    // otimista: reordena localmente por position antes da resposta do banco
    setFlat((prev) => {
      const posMap = new Map(orderedIds.map((id, i) => [id, i]));
      return prev.map((p) => (posMap.has(p.id) ? { ...p, position: posMap.get(p.id)! } : p));
    });
    try {
      await api.reorderProjects(orderedIds);
    } catch {
      await reload();
    }
  }, [reload]);

  /** apaga capas de toda a subárvore no disco antes do DELETE (cascade cuida só do banco) */
  const remove = useCallback(async (id: string) => {
    const idsToClean = getSubtreeIds(flat, id);
    for (const cleanId of idsToClean) {
      const p = flat.find((x) => x.id === cleanId);
      if (p?.cover_path) {
        await invoke('delete_project_cover', { projectId: cleanId }).catch(() => { });
      }
    }
    await api.deleteProject(id);
    await reload();
  }, [flat, reload]);

  return {
    tree, flat, loading, expandedIds, toggleExpanded,
    createProject, rename, duplicate, move, reorderSiblings, remove, reload,
  };
}
