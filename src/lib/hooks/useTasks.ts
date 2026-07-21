import { useState, useEffect, useCallback } from 'react';
import * as api from '@/lib/api/tasks';
import type { Task, CreateTaskInput, UpdateTaskInput } from '@/types/task/task.types';

export function useTasks(projectId: string) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const data = await api.getTasksByProject(projectId);
    setTasks(data);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { reload(); }, [reload]);

  const create = useCallback(async (input: CreateTaskInput) => {
    await api.createTask(projectId, input);
    await reload();
  }, [projectId, reload]);

  const update = useCallback(async (id: string, input: UpdateTaskInput) => {
    await api.updateTask(id, input);
    await reload();
  }, [reload]);

  const remove = useCallback(async (id: string) => {
    await api.deleteTask(id);
    await reload();
  }, [reload]);

  const reorderSubtasksLocally = useCallback((taskId: string, orderedIds: string[]) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t;
        const subtaskMap = new Map(t.subtasks.map((s) => [s.id, s]));
        const reordered = orderedIds
          .map((id, index) => {
            const s = subtaskMap.get(id);
            return s ? { ...s, order: index } : null;
          })
          .filter((s): s is Task['subtasks'][number] => s !== null);
        return { ...t, subtasks: reordered };
      })
    );
  }, []);

  const reorderTasksLocally = useCallback((orderedIds: string[]) => {
    setTasks((prev) => {
      const map = new Map(prev.map((t) => [t.id, t]));
      const reordered = orderedIds.map((id) => map.get(id)).filter((t): t is Task => !!t);
      // const untouched = prev.filter((t) => !orderedIds.includes(t.id));
      const result = [...prev];
      let cursor = 0;
      for (let i = 0; i < result.length; i++) {
        if (orderedIds.includes(result[i].id)) {
          result[i] = reordered[cursor++];
        }
      }
      return result;
    });
  }, []);

  const reorderTasks = useCallback(async (orderedIds: string[]) => {
    reorderTasksLocally(orderedIds);
    try {
      await api.reorderTasks(orderedIds);
    } catch {
      await reload();
    }
  }, [reorderTasksLocally, reload]);

  return { tasks, loading, create, update, remove, reload, reorderSubtasksLocally, reorderTasksLocally, reorderTasks };
}
