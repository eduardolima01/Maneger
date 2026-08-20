export interface Attachment {
  id: string;
  type: 'image'; // futuro: 'video' | 'pdf' | 'file' | 'link'
  /** Path absoluto no disco — resolvido com convertFileSrc no frontend. */
  path: string;
  width?: number;
  height?: number;
}

export interface Moment {
  id: string;
  content: string;
  /** Quando o momento de fato aconteceu — usado pra ordenar o feed. */
  occurredAt: string;
  /** Quando o registro foi criado. */
  createdAt: string;
  updatedAt: string;
  projectId?: string | null;
  tags: string[];
  attachments: Attachment[];
}

export interface FeedData {
  version: number;
  moments: Moment[];
}

export function defaultFeedData(): FeedData {
  return { version: 1, moments: [] };
}

export interface CreateMomentInput {
  content: string;
  occurredAt: string;
  projectId?: string | null;
  tags: string[];
  attachments: Attachment[];
}

export type UpdateMomentInput = Partial<CreateMomentInput>;
