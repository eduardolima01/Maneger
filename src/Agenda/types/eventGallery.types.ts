export interface EventGalleryImage {
  id: string;
  path: string;   // vazio até o upload terminar
  date: string;   // 'YYYY-MM-DD' — casada contra a data de início do evento
  label?: string;
}

export interface EventGalleryData {
  images: EventGalleryImage[];
  coverByEvent: Record<string, string[]>; // eventId -> imageIds associados, na ordem escolhida
}

export const EMPTY_EVENT_GALLERY: EventGalleryData = { images: [], coverByEvent: {} };
