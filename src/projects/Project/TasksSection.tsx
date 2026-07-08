import { useState } from 'react';
import { useTasks } from '@/lib/hooks/useTasks';
import type { TaskStatus } from '@/types/task.types';

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'todo', label: 'A fazer' },
  { value: 'doing', label: 'Em andamento' },
  { value: 'done', label: 'Concluído' },
];

interface TasksSectionProps {
  projectId: string;
}

export default function TasksSection({ projectId }: TasksSectionProps) {
  const { tasks, create, update, remove } = useTasks(projectId);
  const [newTitle, setNewTitle] = useState('');

  async function handleAdd() {
    if (!newTitle.trim()) return;
    await create({ project_id: projectId, title: newTitle.trim() });
    setNewTitle('');
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="Nova task"
          style={{ flex: 1, padding: 8, fontSize: 14 }}
        />
        <button onClick={handleAdd} style={{ padding: '8px 16px', cursor: 'pointer' }}>Adicionar</button>
      </div>

      {tasks.map((task) => (
        <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 14 }}>
          <span
            style={{
              flex: 1,
              textDecoration: task.status === 'done' ? 'line-through' : 'none',
              color: task.status === 'done' ? '#999' : '#000',
            }}
          >
            {task.title}
          </span>

          <select
            value={task.status}
            onChange={(e) => update(task.id, { status: e.target.value as TaskStatus })}
            style={{ fontSize: 13, padding: 4 }}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          <button onClick={() => remove(task.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#999' }}>×</button>
        </div>
      ))}
    </div>
  );
}
