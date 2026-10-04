import { useEffect, useState } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
// AJUSTE 1: troque pela função que o app realmente usa para listar projetos
import { getAllProjects } from '@/lib/api/projects';

export type ProjectOption = {
  path: string;
  title: string;
  iconUrl?: string;
};

export function useAllProjects(enabled: boolean): ProjectOption[] {
  const [projects, setProjects] = useState<ProjectOption[]>([]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    getAllProjects()
      .then((list: any[]) => {
        if (cancelled) return;
        setProjects(
          list.map((p) => ({
            // AJUSTE 2: confira o formato da rota e os nomes dos campos (id, name, cover_path)
            path: `/projects/${p.id}`,
            title: p.name,
            iconUrl: p.cover_path ? convertFileSrc(p.cover_path) : undefined,
          })),
        );
      })
      .catch(() => {
        if (!cancelled) setProjects([]);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return projects;
}
