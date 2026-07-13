import { useState } from 'react';
import Button from '@/components/layout/Button';
import { TASK_STATUSES } from '@/types/task/status.types';
import type { Task, TaskType, TaskPayload } from '@/types/task/task.types';
import type { TaskGroup } from '@/types/task/group.types';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import SortableTaskRow from '../Project/modules/tasks/SortableTaskRow';

export interface TaskGroupSectionProps {
  group: TaskGroup | null;
  tasks: Task[];
  subtaskCounts: Record<string, { total: number; done: number }>;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  dragHandleProps?: Record<string, unknown>;
  onAddTask: (title: string, type: TaskType, groupId: string | null) => void;
  onOpenTask: (task: Task) => void;
  onUpdatePayload: (taskId: string, payload: TaskPayload) => void;
  onRenameGroup?: (name: string) => void;
  onDeleteGroup?: () => void;
}

export function defaultPayloadFor(type: TaskType): TaskPayload {
  if (type === 'checkbox') return { checked: false };
  if (type === 'status') return { status: TASK_STATUSES[0].key };
  return {};
}

export default function TaskGroupSection({
  group, tasks, subtaskCounts, collapsed, onToggleCollapsed, dragHandleProps,
  onAddTask, onOpenTask, onUpdatePayload, onRenameGroup, onDeleteGroup,
}: TaskGroupSectionProps) {
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState<TaskType>('checkbox');
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(group?.name ?? '');

  function handleAdd() {
    if (!newTitle.trim()) return;
    onAddTask(newTitle.trim(), newType, group?.id ?? null);
    setNewTitle('');
  }

  return (
    <div style={{ marginBottom: 16, border: '1px solid #eee', borderRadius: 6, backgroundColor: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', backgroundColor: '#fafafa', borderBottom: collapsed ? 'none' : '1px solid #eee' }}>
        {dragHandleProps && (
          <span {...dragHandleProps} style={{ color: '#bbb', fontSize: 12, cursor: 'grab', touchAction: 'none' }} title="Arrastar">
            ⠿
          </span>
        )}

        <button onClick={onToggleCollapsed} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 12 }}>
          {collapsed ? '▶' : '▼'}
        </button>

        {editingName && group ? (
          <input
            autoFocus
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={() => {
              setEditingName(false);
              if (nameDraft.trim() && nameDraft !== group.name) onRenameGroup?.(nameDraft.trim());
            }}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            style={{ fontSize: 13, fontWeight: 600, flex: 1, padding: 2 }}
          />
        ) : (
          <span
            onClick={() => group && setEditingName(true)}
            style={{ fontSize: 13, fontWeight: 600, flex: 1, cursor: group ? 'text' : 'default' }}
          >
            {group?.name ?? 'Sem grupo'} <span style={{ fontWeight: 400, color: '#999' }}>({tasks.length})</span>
          </span>
        )}

        {group && onDeleteGroup && (
          <button
            onClick={onDeleteGroup}
            title="Excluir grupo"
            style={{
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: '#c62828',
              fontSize: 12
            }}
          >
            ✕
          </button>
        )}
      </div>

      {!collapsed && (
        <div style={{ padding: 8 }}>
          <SortableContext
            items={tasks.map((t) => `task:${t.id}`)}
            strategy={verticalListSortingStrategy}
          >
            {tasks.map((t) => (
              <SortableTaskRow
                key={t.id}
                task={t}
                subtaskCount={subtaskCounts[t.id]}
                onOpen={() => onOpenTask(t)}
                onUpdatePayload={(payload) => onUpdatePayload(t.id, payload)}
              />
            ))}
          </SortableContext>

          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value as TaskType)}
              style={{ fontSize: 12, padding: 6 }}
            >
              <option value="checkbox">✅ Checkbox</option>
              <option value="status">🚦 Status</option>
              <option value="note">📝 Nota</option>
            </select>
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder="Nova tarefa..."
              style={{ flex: 1, padding: 6, fontSize: 13 }}
            />
            <Button variant="secondary" onClick={handleAdd}>+ Adicionar</Button>
          </div>
        </div>
      )}
    </div>
  );
}
