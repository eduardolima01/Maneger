import { useState } from 'react';
import { useKanban } from '@/lib/hooks/useKanban';
import type { KanbanStatus } from '@/types/kanbanCard.types';

const COLUMNS: { key: KanbanStatus; label: string }[] = [
  { key: 'todo', label: 'A fazer' },
  { key: 'doing', label: 'Em andamento' },
  { key: 'done', label: 'Concluído' },
];

interface KanbanBoardProps {
  projectId: string;
}

export default function KanbanBoard({ projectId }: KanbanBoardProps) {
  const { cards, create, update, remove } = useKanban(projectId);
  const [newTitle, setNewTitle] = useState('');
  const [dragOverCol, setDragOverCol] = useState<KanbanStatus | null>(null);

  function handleDrop(status: KanbanStatus, e: React.DragEvent) {
    e.preventDefault();
    setDragOverCol(null);
    const id = e.dataTransfer.getData('text/plain');
    const card = cards.find((c) => c.id === id);
    if (card && card.status !== status) update(id, { status });
  }

  async function handleAdd() {
    if (!newTitle.trim()) return;
    await create({ project_id: projectId, title: newTitle.trim() });
    setNewTitle('');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="Novo card"
          style={{ flex: 1, padding: 8, fontSize: 14 }}
        />
        <button onClick={handleAdd} style={{ padding: '8px 16px', cursor: 'pointer' }}>Adicionar</button>
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        {COLUMNS.map(({ key, label }) => (
          <div
            key={key}
            onDragOver={(e) => { e.preventDefault(); setDragOverCol(key); }}
            onDragLeave={() => setDragOverCol(null)}
            onDrop={(e) => handleDrop(key, e)}
            style={{
              flex: 1,
              minHeight: 300,
              backgroundColor: dragOverCol === key ? '#f0f6ff' : '#fafafa',
              border: '1px solid #e0e0e0',
              borderRadius: 6,
              padding: 8,
            }}
          >
            <h4 style={{ margin: '0 0 8px 0', fontSize: 13, fontWeight: 600, color: '#555' }}>{label}</h4>
            {cards.filter((c) => c.status === key).map((card) => (
              <div
                key={card.id}
                draggable
                onDragStart={(e) => e.dataTransfer.setData('text/plain', card.id)}
                style={{
                  backgroundColor: '#fff',
                  border: '1px solid #ddd',
                  borderRadius: 4,
                  padding: 8,
                  marginBottom: 8,
                  fontSize: 13,
                  cursor: 'grab',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span>{card.title}</span>
                <button
                  onClick={() => remove(card.id)}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#999', fontSize: 14 }}
                  title="Excluir"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
