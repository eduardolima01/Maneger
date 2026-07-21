import type { Subtask } from './subtask.types';
export type TaskType = 'note' | 'checkbox' | 'status';

interface BaseTask {
  id: string;
  projectId: string; // contexto atual do módulo: grupos/tasks vivem dentro de um projeto (ver nota no final da implementação)
  groupId: string | null;
  title: string;
  description?: string;
  subtasks: Subtask[];
  createdAt: string;
  updatedAt: string;
}

export interface NoteTaskPayload { }
export interface NoteTask extends BaseTask {
  type: 'note';
  payload: NoteTaskPayload;
}

export interface CheckboxTaskPayload {
  checked: boolean;
}
export interface CheckboxTask extends BaseTask {
  type: 'checkbox';
  payload: CheckboxTaskPayload;
}

export interface StatusTaskPayload {
  status: string; // chave de TASK_STATUSES (status.types.ts) — string livre de propósito, pra suportar status customizados sem migração de schema
}
export interface StatusTask extends BaseTask {
  type: 'status';
  payload: StatusTaskPayload;
}

export type Task = NoteTask | CheckboxTask | StatusTask;
export type TaskPayload = Task['payload'];

export interface CreateTaskInput {
  groupId: string | null;
  type: TaskType;
  title: string;
  description?: string;
  payload: TaskPayload;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  groupId?: string | null;
  payload?: TaskPayload;
}
