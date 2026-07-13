import { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/layout/Button';
import TaskRenderer from '../Project/modules/tasks/TaskRenderer';
import SubtaskList from '../Project/modules/tasks/SubtaskList';
import type { useSubtaskActions } from '@/lib/hooks/useSubtasks';
import type { Task } from '@/types/task/task.types';
import type { TaskGroup } from '@/types/task/group.types';

interface TaskDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task | null;
  groups: TaskGroup[];
  onUpdate: (id: string, input: { title?: string; description?: string; groupId?: string | null; payload?: Task['payload'] }) => void;
  onRequestDelete: () => void;
  subtaskActions: ReturnType<typeof useSubtaskActions>;
  onReorderSubtasks: (taskId: string, orderedIds: string[]) => void;
  onRequestDeleteSubtask: (id: string, label: string) => void;
}

export default function TaskDetailModal({
  isOpen,
  onClose,
  task,
  groups,
  onUpdate,
  onRequestDelete,
  subtaskActions,
  onReorderSubtasks,
  onRequestDeleteSubtask,
}: TaskDetailModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  useEffect(() => {
    if (isOpen && task) {
      setTitle(task.title);
      setDescription(task.description ?? '');
    }
  }, [isOpen, task]);

  if (!task) return null;

  function handleAddSubtask() {
    if (!newSubtaskTitle.trim()) return;
    subtaskActions.create(task!.id, newSubtaskTitle.trim());
    setNewSubtaskTitle('');
  }

  const doneCount = task.subtasks.filter((s) => s.checked).length;

  return (
    <Modal open={isOpen} onClose={onClose}>
      <div style={{ padding: 16, width: 480, maxWidth: '90vw', maxHeight: '80vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => title.trim() && title !== task!.title && onUpdate(task!.id, { title: title.trim() })}
          style={{ fontSize: 18, fontWeight: 600, border: 'none', outline: 'none', padding: '4px 0' }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <TaskRenderer task={task} onUpdatePayload={(payload) => onUpdate(task.id, { payload })} />

          <select
            value={task.groupId ?? ''}
            onChange={(e) => onUpdate(task.id, { groupId: e.target.value || null })}
            style={{ padding: 6, fontSize: 13, marginLeft: 'auto' }}
          >
            <option value="">Sem grupo</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#666', display: 'block', marginBottom: 4 }}>
            {task.type === 'note' ? 'Conteúdo' : 'Descrição'}
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => description !== (task!.description ?? '') && onUpdate(task!.id, { description })}
            rows={task.type === 'note' ? 8 : 4}
            style={{ width: '100%', padding: 8, fontSize: 14, resize: 'vertical' }}
            placeholder={task.type === 'note' ? 'Escreva livremente...' : 'Detalhes da tarefa...'}
          />
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#666', display: 'block', marginBottom: 4 }}>
            Subtarefas {task.subtasks.length > 0 && `(${doneCount}/${task.subtasks.length})`}
          </label>

          <SubtaskList
            subtasks={task.subtasks}
            onToggle={subtaskActions.toggle}
            onRename={subtaskActions.rename}
            onDelete={(id) => {
              const subtask = task.subtasks.find((s) => s.id === id);
              onRequestDeleteSubtask(id, subtask?.title ?? 'esta subtarefa');
            }}
            onReorder={(ids) => onReorderSubtasks(task.id, ids)}
          />

          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <input
              value={newSubtaskTitle}
              onChange={(e) => setNewSubtaskTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddSubtask()}
              placeholder="Nova subtarefa..."
              style={{ flex: 1, padding: 6, fontSize: 13 }}
            />
            <Button variant="secondary" onClick={handleAddSubtask}>+ Adicionar</Button>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #eee', paddingTop: 12 }}>
          <Button variant="danger" onClick={onRequestDelete}>Excluir tarefa</Button>
          <Button variant="secondary" onClick={onClose}>Fechar</Button>
        </div>
      </div>
    </Modal>
  );
}

