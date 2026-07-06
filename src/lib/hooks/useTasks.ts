import { useState, useEffect, useCallback } from 'react';
import { listTasksByProject, createTask, toggleTask, deleteTask } from '../api/tasks';
import { TaskType } from '@/types/task.types';

export function useTasks(projectId: number) {
  const [tasks, setTasks] = useState<TaskType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const result = await listTasksByProject(projectId);
      setTasks(result);
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const add = async (title: string) => {
    await createTask(projectId, title);
    await refresh();
  };

  const toggle = async (task: TaskType) => {
    await toggleTask(task.id, task.done);
    await refresh();
  };

  const remove = async (id: number) => {
    await deleteTask(id);
    await refresh();
  };

  return { tasks, loading, error, add, toggle, remove };
}

