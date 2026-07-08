export interface Note {
  id: string;
  project_id: string;
  title: string;
  content: string;
  updated_at: string;
}
export interface CreateNoteInput {
  project_id: string;
  title?: string;
  content?: string;
}
export type UpdateNoteInput = Partial<Pick<Note, 'title' | 'content'>>;
