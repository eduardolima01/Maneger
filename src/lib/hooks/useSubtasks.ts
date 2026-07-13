import * as api from '@/lib/api/task/subtasks';

export function useSubtaskActions(onDone: () => void) {
  const create = async (taskId: string, title: string) => {
    if (!title.trim()) return;
    await api.createSubtask(taskId, title.trim());
    onDone();
  };

  const toggle = async (id: string, checked: boolean) => {
    await api.updateSubtask(id, { checked });
    onDone();
  };

  const rename = async (id: string, title: string) => {
    if (!title.trim()) return;
    await api.updateSubtask(id, { title: title.trim() });
    onDone();
  };

  const reorder = async (taskId: string, orderedIds: string[]) => {
    await api.reorderSubtasks(taskId, orderedIds);
    onDone();
  };

  const remove = async (id: string) => {
    await api.deleteSubtask(id);
    onDone();
  };

  return { create, toggle, rename, reorder, remove };
}
