import { useEffect, useMemo, useState } from 'react';
import Button from '@/components/layout/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { useTaskGroups } from '@/lib/hooks/useTaskGroups';
import { useTasks } from '@/lib/hooks/useTasks';
import { useSubtaskActions } from '@/lib/hooks/useSubtasks';
import { getSubtaskCountsByProject } from '@/lib/api/task/subtaskCounts';

import TaskGroupSection, { defaultPayloadFor } from '@/Projects/components/TaskGroupSection';
import TaskIdeasPanel from '@/Projects/components/TaskIdeasPanel';
import TaskDetailModal from '@/Projects/components/TaskDetailModal';

import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core';

import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove
} from '@dnd-kit/sortable';

import type { Task } from '@/types/task/task.types';
import SortableGroup from './SortableGroup';

const UNGROUPED_KEY = '__ungrouped__';

interface TasksSectionProps {
  projectId: string;
}

type PendingDelete =
  | { kind: 'group'; id: string; label: string }
  | { kind: 'task'; id: string; label: string }
  | { kind: 'subtask'; id: string; label: string };

export default function TasksSection({ projectId }: TasksSectionProps) {
  const { groups, create: createGroup, rename: renameGroup, remove: removeGroup, reorder: reorderGroups } = useTaskGroups(projectId);
  const { tasks, create: createTask, update: updateTask, remove: removeTask, reload: reloadTasks, reorderSubtasksLocally, reorderTasks } = useTasks(projectId);
  const subtaskActions = useSubtaskActions(() => { reloadTasks(); reloadCounts(); });

  const [groupSearch, setGroupSearch] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [subtaskCounts, setSubtaskCounts] = useState<Record<string, { total: number; done: number }>>({});
  const [collapsedKeys, setCollapsedKeys] = useState<Set<string>>(new Set());
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const selectedTask = tasks.find((t) => t.id === selectedTaskId) ?? null;

  async function reloadCounts() {
    const counts = await getSubtaskCountsByProject(projectId);
    setSubtaskCounts(counts);
  }

  useEffect(() => { reloadCounts(); }, [projectId, tasks.length]);

  const isSearching = groupSearch.trim().length > 0;

  const filteredGroups = useMemo(
    () => groups.filter((g) => g.name.toLowerCase().includes(groupSearch.toLowerCase())),
    [groups, groupSearch]
  );

  const ungroupedTasks = tasks.filter((t) => !t.groupId);
  const showUngrouped = !isSearching || 'sem grupo'.includes(groupSearch.toLowerCase());

  function tasksForGroup(groupId: string) {
    return tasks.filter((t) => t.groupId === groupId);
  }

  async function handleCreateGroup() {
    if (!newGroupName.trim()) return;
    await createGroup(newGroupName.trim());
    setNewGroupName('');
  }

  function handleOpenTask(task: Task) {
    setSelectedTaskId(task.id);
    setDetailOpen(true);
  }

  async function handleUpdateTask(id: string, input: Parameters<typeof updateTask>[1]) {
    await updateTask(id, input);
    await reloadCounts();
  }

  function requestDeleteTask(id: string, label: string) {
    setPendingDelete({ kind: 'task', id, label });
  }

  function requestDeleteGroup(id: string, label: string) {
    setPendingDelete({ kind: 'group', id, label });
  }

  function requestDeleteSubtask(id: string, label: string) {
    setPendingDelete({ kind: 'subtask', id, label });
  }

  async function handleConfirmDelete() {
    if (!pendingDelete) return;

    if (pendingDelete.kind === 'task') {
      await removeTask(pendingDelete.id);
      if (selectedTaskId === pendingDelete.id) {
        setDetailOpen(false);
        setSelectedTaskId(null);
      }
    } else if (pendingDelete.kind === 'group') {
      await removeGroup(pendingDelete.id);
    } else if (pendingDelete.kind === 'subtask') {
      await subtaskActions.remove(pendingDelete.id);
    }

    setPendingDelete(null);
  }

  async function handlePromoteIdea(title: string, groupId: string | null) {
    await createTask({ title, type: 'checkbox', groupId, payload: { checked: false } });
    await reloadTasks();
  }

  function toggleCollapsed(key: string) {
    setCollapsedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function expandAll() {
    setCollapsedKeys(new Set());
  }

  function collapseAll() {
    setCollapsedKeys(new Set([...filteredGroups.map((g) => g.id), UNGROUPED_KEY]));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeType = active.data.current?.type;

    if (activeType === 'group') {
      const ids = filteredGroups.map((g) => g.id);
      const fromIndex = ids.indexOf(active.id as string);
      const toIndex = ids.indexOf(over.id as string);
      if (fromIndex === -1 || toIndex === -1) return;
      reorderGroups(arrayMove(ids, fromIndex, toIndex));
    }

    if (activeType === 'task') {
      const activeGroupId = active.data.current?.groupId ?? null;
      const overGroupId = over.data.current?.groupId ?? null;
      if (activeGroupId !== overGroupId) return; // só reordena dentro do mesmo grupo — cross-group não faz parte deste ticket

      const groupTasks = tasks.filter((t) => t.groupId === activeGroupId);
      const ids = groupTasks.map((t) => `task:${t.id}`);
      const fromIndex = ids.indexOf(active.id as string);
      const toIndex = ids.indexOf(over.id as string);
      if (fromIndex === -1 || toIndex === -1) return;

      const reorderedIds = arrayMove(ids, fromIndex, toIndex).map((id) => id.replace('task:', ''));
      reorderTasks(reorderedIds);
    }
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>Tarefas</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="secondary" onClick={expandAll}>Expandir Todos</Button>
            <Button variant="secondary" onClick={collapseAll}>Recolher Todos</Button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={groupSearch}
            onChange={(e) => setGroupSearch(e.target.value)}
            placeholder="Buscar grupo..."
            style={{ flex: 1, padding: 8, fontSize: 14 }}
          />
          <input
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateGroup()}
            placeholder="Nome do novo grupo..."
            style={{ flex: 1, padding: 8, fontSize: 14 }}
          />
          <Button variant="primary" onClick={handleCreateGroup}>+ Grupo</Button>
        </div>

        {isSearching && (
          <p style={{ fontSize: 12, color: '#999', margin: 0 }}>
            Reordenar grupos por arraste fica desativado durante a busca.
          </p>
        )}

        <SortableContext items={filteredGroups.map((g) => g.id)} strategy={verticalListSortingStrategy}>
          {filteredGroups.map((group) => (
            <SortableGroup
              key={group.id}
              id={group.id}
              group={group}
              tasks={tasksForGroup(group.id)}
              subtaskCounts={subtaskCounts}
              collapsed={collapsedKeys.has(group.id)}
              onToggleCollapsed={() => toggleCollapsed(group.id)}
              onAddTask={(title, type, groupId) => createTask({ title, type, groupId, payload: defaultPayloadFor(type) })}
              onOpenTask={handleOpenTask}
              onUpdatePayload={(id, payload) => handleUpdateTask(id, { payload })}
              onRenameGroup={(name) => renameGroup(group.id, name)}
              onDeleteGroup={() => requestDeleteGroup(group.id, group.name)}
            />
          ))}
        </SortableContext>

        {showUngrouped && (
          <TaskGroupSection
            group={null}
            tasks={ungroupedTasks}
            subtaskCounts={subtaskCounts}
            collapsed={collapsedKeys.has(UNGROUPED_KEY)}
            onToggleCollapsed={() => toggleCollapsed(UNGROUPED_KEY)}
            onAddTask={(title, type, groupId) => createTask({ title, type, groupId, payload: defaultPayloadFor(type) })}
            onOpenTask={handleOpenTask}
            onUpdatePayload={(id, payload) => handleUpdateTask(id, { payload })}
          />
        )}

        <TaskIdeasPanel projectId={projectId} groups={groups} onPromote={handlePromoteIdea} />

        <TaskDetailModal
          isOpen={detailOpen}
          onClose={() => setDetailOpen(false)}
          task={selectedTask}
          groups={groups}
          onUpdate={handleUpdateTask}
          onRequestDelete={() => selectedTask && requestDeleteTask(selectedTask.id, selectedTask.title)}
          subtaskActions={subtaskActions}
          onReorderSubtasks={(taskId, ids) => {
            reorderSubtasksLocally(taskId, ids);
            subtaskActions.reorder(taskId, ids).catch(() => reloadTasks());
          }}
          onRequestDeleteSubtask={requestDeleteSubtask}
        />

        <ConfirmDialog
          isOpen={pendingDelete !== null}
          title={
            pendingDelete?.kind === 'group' ? 'Excluir grupo?' :
              pendingDelete?.kind === 'task' ? 'Excluir tarefa?' :
                'Excluir subtarefa?'
          }
          message={
            pendingDelete?.kind === 'group'
              ? `Deseja realmente excluir o grupo "${pendingDelete.label}"? As tasks dele não serão apagadas, só ficarão sem grupo. Esta ação é permanente e não poderá ser desfeita.`
              : `Deseja realmente excluir "${pendingDelete?.label ?? ''}"? Esta ação é permanente e não poderá ser desfeita.`
          }
          onConfirm={handleConfirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      </div>
    </DndContext>
  );
}
