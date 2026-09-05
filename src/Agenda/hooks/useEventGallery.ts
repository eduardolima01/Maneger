import { useState, useEffect, useCallback, useRef } from 'react';
import { generateId } from '@/lib/utils/uuid';
import type { EventGalleryData, EventGalleryImage } from '@/Agenda/types/eventGallery.types';
import { EMPTY_EVENT_GALLERY } from '@/Agenda/types/eventGallery.types';
import { loadEventGalleryData, saveEventGalleryData } from '../api/eventGallery';

export function useEventGallery(projectId: string | null) {
  const [data, setData] = useState<EventGalleryData>(EMPTY_EVENT_GALLERY);
  const dataRef = useRef<EventGalleryData>(EMPTY_EVENT_GALLERY);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!projectId) { dataRef.current = EMPTY_EVENT_GALLERY; setData(EMPTY_EVENT_GALLERY); setLoading(false); return; }
    setLoading(true);
    const fresh = await loadEventGalleryData(projectId);
    dataRef.current = fresh;
    setData(fresh);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { reload(); }, [reload]);

  const persist = useCallback(async (next: EventGalleryData) => {
    dataRef.current = next;
    setData(next);
    if (projectId) await saveEventGalleryData(projectId, next);
  }, [projectId]);

  const addImage = useCallback(async (date: string) => {
    const image: EventGalleryImage = { id: generateId(), path: '', date };
    await persist({ ...dataRef.current, images: [...dataRef.current.images, image] });
    return image.id;
  }, [persist]);

  const updateImage = useCallback(async (imageId: string, patch: Partial<Pick<EventGalleryImage, 'path' | 'date' | 'label'>>) => {
    await persist({ ...dataRef.current, images: dataRef.current.images.map((i) => i.id === imageId ? { ...i, ...patch } : i) });
  }, [persist]);

  const removeImage = useCallback(async (imageId: string) => {
    const coverByEvent: Record<string, string[]> = {};
    for (const [eventId, ids] of Object.entries(dataRef.current.coverByEvent)) {
      const filtered = ids.filter((id) => id !== imageId);
      if (filtered.length > 0) coverByEvent[eventId] = filtered;
    }
    await persist({ images: data.images.filter((i) => i.id !== imageId), coverByEvent });
  }, [data, persist]);

  const toggleEventImage = useCallback(async (eventId: string, imageId: string) => {
    const current = dataRef.current.coverByEvent[eventId] ?? [];
    const next = current.includes(imageId)
      ? current.filter((id) => id !== imageId)
      : [...current, imageId]; // ordem de clique = ordem de exibição
    const coverByEvent = { ...dataRef.current.coverByEvent };
    if (next.length > 0) coverByEvent[eventId] = next;
    else delete coverByEvent[eventId];
    await persist({ ...dataRef.current, coverByEvent });
  }, [persist]);

  return { images: data.images, coverByEvent: data.coverByEvent, loading, reload, addImage, updateImage, removeImage, toggleEventImage };
}
