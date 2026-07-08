import { useState, useEffect, useCallback } from 'react';
import * as tasksApi from '../api/tasks';
import type { TaskType, CreateTaskInput, UpdateTaskInput } from '../../types/task.types';

export function useTasks(projectId: string) {
  const [tasks, setTasks] = useState<TaskType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await tasksApi.getTasksByProject(projectId);
      setTasks(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar tasks');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { reload(); }, [reload]);

  const create = useCallback(async (input: CreateTaskInput) => {
    await tasksApi.createTask(input);
    await reload();
  }, [reload]);

  const update = useCallback(async (id: string, input: UpdateTaskInput) => {
    await tasksApi.updateTask(id, input);
    await reload();
  }, [reload]);

  const remove = useCallback(async (id: string) => {
    await tasksApi.deleteTask(id);
    await reload();
  }, [reload]);

  return { tasks, loading, error, create, update, remove, reload };
}
