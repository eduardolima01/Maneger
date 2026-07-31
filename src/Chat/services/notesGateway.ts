import * as notesApi from '@/lib/api/notes';

export interface CreateNoteFromChatInput {
  projectId: string;
  title?: string;
  content: string;
}

export async function createNoteViaChat(input: CreateNoteFromChatInput): Promise<{ id: string }> {
  const id = await notesApi.createNote({
    project_id: input.projectId,
    title: input.title ?? '',
    content: input.content,
  });
  return { id };
}
