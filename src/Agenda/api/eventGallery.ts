import { invoke } from '@tauri-apps/api/core';
import type { EventGalleryData } from '@/Agenda/types/eventGallery.types';
import { EMPTY_EVENT_GALLERY } from '@/Agenda/types/eventGallery.types';

export async function loadEventGalleryData(projectId: string): Promise<EventGalleryData> {
  const raw = await invoke<string>('load_event_gallery_data', { projectId });
  try {
    const parsed = JSON.parse(raw);
    const rawCoverByEvent = parsed.coverByEvent && typeof parsed.coverByEvent === 'object' ? parsed.coverByEvent : {};
    const coverByEvent: Record<string, string[]> = {};
    for (const [eventId, value] of Object.entries(rawCoverByEvent)) {
      // compat: dados salvos antes de suportar múltiplas imagens tinham um único id (string) por evento
      coverByEvent[eventId] = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
    }
    return {
      images: Array.isArray(parsed.images) ? parsed.images : [],
      coverByEvent,
    };
  } catch {
    return { ...EMPTY_EVENT_GALLERY };
  }
}

export async function saveEventGalleryData(projectId: string, data: EventGalleryData): Promise<void> {
  await invoke('save_event_gallery_data', { projectId, data: JSON.stringify(data) });
}
