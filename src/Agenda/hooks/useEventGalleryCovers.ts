import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { EventGalleryData } from '@/Agenda/types/eventGallery.types';
import type { Event } from '@/types/event.types';
import { loadEventGalleryData } from '../api/eventGallery';

function dateKeyFromISO(iso: string): string {
  return iso.slice(0, 10); // assume toLocalISO no formato 'YYYY-MM-DDTHH:mm:ss' — confirmar contra date.ts
}

export function useEventGalleryCovers(events: Event[]) {
  const [galleries, setGalleries] = useState<Record<string, EventGalleryData>>({});
  const loadedRef = useRef<Set<string>>(new Set());

  const projectDateCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const ev of events) {
      if (!ev.project_id) continue;
      const key = `${ev.project_id}::${dateKeyFromISO(ev.start_at)}`;
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }, [events]);


  useEffect(() => {
    const projectIds = new Set(events.map((e) => e.project_id).filter((id): id is string => !!id));
    const toLoad = [...projectIds].filter((id) => !loadedRef.current.has(id));
    if (toLoad.length === 0) return;
    toLoad.forEach((id) => loadedRef.current.add(id));
    Promise.all(toLoad.map((id) => loadEventGalleryData(id).then((data) => [id, data] as const)))
      .then((pairs) => {
        setGalleries((prev) => {
          const next = { ...prev };
          for (const [id, data] of pairs) next[id] = data;
          return next;
        });
      });
  }, [events]);

  const invalidateProject = useCallback((projectId: string) => {
    loadedRef.current.delete(projectId);
    loadEventGalleryData(projectId).then((data) => {
      setGalleries((prev) => ({ ...prev, [projectId]: data }));
    });
  }, []);

  const resolveEventImages = useCallback((event: Event): string[] => {
    if (!event.project_id) return [];
    const gallery = galleries[event.project_id];
    if (!gallery) return [];

    const chosenIds = gallery.coverByEvent[event.id];
    if (chosenIds && chosenIds.length > 0) {
      return chosenIds
        .map((id) => gallery.images.find((i) => i.id === id))
        .filter((img): img is (typeof gallery.images)[number] => !!img && !!img.path)
        .map((img) => img.path);
    }
    const dateKey = dateKeyFromISO(event.start_at);
    const siblingCount = projectDateCounts[`${event.project_id}::${dateKey}`] ?? 0;
    if (siblingCount > 1) return [];

    return gallery.images.filter((i) => i.date === dateKey && i.path).map((i) => i.path);
  }, [galleries, projectDateCounts]);

  const hasAmbiguousAutoCover = useCallback((projectId: string | null, dateISO: string): boolean => {
    if (!projectId) return false;
    const dateKey = dateKeyFromISO(dateISO);
    return (projectDateCounts[`${projectId}::${dateKey}`] ?? 0) > 1;
  }, [projectDateCounts]);

  return { resolveEventImages, invalidateProject, hasAmbiguousAutoCover };
}
