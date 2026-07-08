import { useState } from 'react';
import { useNotes } from '../../lib/hooks/useNotes';

interface NotesSectionProps {
  projectId: string;
}

export default function NotesSection({ projectId }: NotesSectionProps) {
  const { notes, create, update, remove } = useNotes(projectId);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = notes.find((n) => n.id === selectedId) ?? null;

  async function handleCreate() {
    const id = await create({ project_id: projectId });
    setSelectedId(id);
  }

  return (
    <div style={{ display: 'flex', gap: 16, minHeight: 300 }}>
      <div style={{ width: 200, borderRight: '1px solid #eee', paddingRight: 12 }}>
        <button onClick={handleCreate} style={{ width: '100%', padding: 8, marginBottom: 8, cursor: 'pointer' }}>
          + Nova nota
        </button>
        {notes.map((note) => (
          <div
            key={note.id}
            onClick={() => setSelectedId(note.id)}
            style={{
              padding: 8,
              borderRadius: 4,
              cursor: 'pointer',
              backgroundColor: selectedId === note.id ? '#eef3fc' : 'transparent',
              fontSize: 13,
              fontWeight: selectedId === note.id ? 600 : 400,
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
            }}
          >
            {note.title || 'Sem título'}
          </div>
        ))}
      </div>

      <div style={{ flex: 1 }}>
        {selected ? (
          <>
            <input
              value={selected.title}
              onChange={(e) => update(selected.id, { title: e.target.value })}
              placeholder="Título"
              style={{ width: '100%', padding: 8, fontSize: 16, fontWeight: 600, marginBottom: 8, border: 'none', borderBottom: '1px solid #eee' }}
            />
            <textarea
              value={selected.content}
              onChange={(e) => update(selected.id, { content: e.target.value })}
              placeholder="Escreva algo..."
              style={{ width: '100%', height: 220, padding: 8, fontSize: 14, border: 'none', resize: 'vertical' }}
            />
            <button
              onClick={() => { remove(selected.id); setSelectedId(null); }}
              style={{ padding: '6px 12px', color: '#c62828', cursor: 'pointer' }}
            >
              Excluir nota
            </button>
          </>
        ) : (
          <div style={{ color: '#999', fontSize: 14 }}>Selecione ou crie uma nota</div>
        )}
      </div>
    </div>
  );
}

