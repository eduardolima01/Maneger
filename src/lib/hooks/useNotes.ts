import { useState, useEffect, useCallback } from 'react';
import * as notesApi from '../api/notes';
import type { Note, CreateNoteInput, UpdateNoteInput } from '../../types/note.types';

export function useNotes(projectId: string) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const data = await notesApi.getNotesByProject(projectId);
    setNotes(data);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { reload(); }, [reload]);

  const create = useCallback(async (input: CreateNoteInput) => {
    const id = await notesApi.createNote(input);
    await reload();
    return id;
  }, [reload]);

  const update = useCallback(async (id: string, input: UpdateNoteInput) => {
    await notesApi.updateNote(id, input);
    await reload();
  }, [reload]);

  const remove = useCallback(async (id: string) => {
    await notesApi.deleteNote(id);
    await reload();
  }, [reload]);

  return { notes, loading, create, update, remove, reload };
}
