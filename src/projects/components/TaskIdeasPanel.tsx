import { useState } from 'react';
import Button from '@/components/layout/Button';
import { useTaskIdeas } from '@/lib/hooks/useTaskIdeas';
import type { TaskGroup } from '@/types/taskGroup.types';

interface TaskIdeasPanelProps {
  projectId: string;
  groups: TaskGroup[];
  onPromote: (title: string, groupId: string | null) => Promise<void>;
}

export default function TaskIdeasPanel({ projectId, groups, onPromote }: TaskIdeasPanelProps) {
  const { ideas, add, remove } = useTaskIdeas(projectId);
  const [content, setContent] = useState('');
  const [promotingId, setPromotingId] = useState<string | null>(null);

  async function handleAdd() {
    if (!content.trim()) return;
    await add(content);
    setContent('');
  }

  async function handlePromote(idea: { id: string; content: string }) {
    setPromotingId(idea.id);
    try {
      await onPromote(idea.content, null);
      await remove(idea.id);
    } finally {
      setPromotingId(null);
    }
  }

  return (
    <div style={{ border: '1px solid #e0e0e0', borderRadius: 6, padding: 12, backgroundColor: '#fffdf5' }}>
      <h4 style={{ margin: '0 0 8px', fontSize: 13 }}>💡 Ideias soltas</h4>

      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        <input
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="Anotar uma ideia rápida..."
          style={{ flex: 1, padding: 6, fontSize: 13 }}
        />
        <Button variant="secondary" onClick={handleAdd}>Salvar</Button>
      </div>

      {ideas.length === 0 && <p style={{ fontSize: 12, color: '#999', margin: 0 }}>Nenhuma ideia anotada.</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {ideas.map((idea) => (
          <div key={idea.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px', backgroundColor: '#fff', borderRadius: 4 }}>
            <span style={{ flex: 1, fontSize: 13 }}>{idea.content}</span>
            <button
              onClick={() => handlePromote(idea)}
              disabled={promotingId === idea.id}
              title="Transformar em task"
              style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#1a73e8', fontSize: 12 }}
            >
              {promotingId === idea.id ? '...' : '→ Task'}
            </button>
            <button
              onClick={() => remove(idea.id)}
              style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#c62828', fontSize: 12 }}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
