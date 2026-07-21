export interface Kanban {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  color: string | null;
  isDefault: boolean;
  archived: boolean;
  position: number;
  viewPrefs: KanbanViewPrefs;
  createdAt: string;
  updatedAt: string;
}

export interface KanbanCard {
  id: string;
  kanbanId: string;
  columnId: string;
  title: string;
  description: string | null;
  coverPath: string | null;
  color: string | null;
  priority: TaskPriority | null;
  labels: string[];
  assignedTo: string | null;
  startDate: string | null;
  dueDate: string | null;
  position: number;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateKanbanCardInput {
  kanbanId: string;
  columnId: string;
  title: string;
  description?: string | null;
  color?: string | null;
  priority?: TaskPriority | null;
  labels?: string[];
  startDate?: string | null;
  dueDate?: string | null;
}

export type UpdateKanbanCardInput = Partial<{
  title: string;
  description: string | null;
  coverPath: string | null;
  color: string | null;
  priority: TaskPriority | null;
  labels: string[];
  assignedTo: string | null;
  startDate: string | null;
  dueDate: string | null;
  columnId: string;
  archived: boolean;
}>;

export type KanbanDensity = 'compact' | 'normal' | 'expanded';

export interface KanbanSavedFilter {
  id: string;
  name: string;
  filters: KanbanFilters;
}

export interface KanbanViewPrefs {
  density: KanbanDensity;
  columnWidths: Record<string, number>; // columnId -> px
  collapsedColumnIds: string[];
  savedFilters: KanbanSavedFilter[];
}

export function defaultViewPrefs(): KanbanViewPrefs {
  return { density: 'normal', columnWidths: {}, collapsedColumnIds: [], savedFilters: [] };
}

export interface KanbanColumn {
  id: string;
  kanbanId: string;
  name: string;
  color: string | null;
  icon: string | null;
  wipLimit: number | null;
  visible: boolean;
  collapsed: boolean;
  position: number;
}

export interface CreateKanbanInput {
  projectId: string;
  name: string;
  description?: string | null;
  color?: string | null;
}

export type UpdateKanbanInput = Partial<{
  name: string;
  description: string | null;
  color: string | null;
  archived: boolean;
  viewPrefs: KanbanViewPrefs;
}>;

export interface CreateKanbanColumnInput {
  kanbanId: string;
  name: string;
  color?: string | null;
  icon?: string | null;
  wipLimit?: number | null;
}

export type UpdateKanbanColumnInput = Partial<{
  name: string;
  color: string | null;
  icon: string | null;
  wipLimit: number | null;
  visible: boolean;
}>;

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  urgent: 'Urgente',
};

export const PRIORITY_COLORS: Record<TaskPriority, string> = {
  low: '#9e9e9e',
  medium: '#1a73e8',
  high: '#f4511e',
  urgent: '#c62828',
};

export interface KanbanFilters {
  types: Array<'note' | 'checkbox' | 'status'>;
  priorities: TaskPriority[];
  labels: string[];
  hasSubtasks: boolean | null; // null = sem filtro
  completion: 'all' | 'done' | 'pending';
}

export function emptyFilters(): KanbanFilters {
  return { types: [], priorities: [], labels: [], hasSubtasks: null, completion: 'all' };
}

export function hasActiveFilters(f: KanbanFilters): boolean {
  return f.types.length > 0 || f.priorities.length > 0 || f.labels.length > 0 || f.hasSubtasks !== null || f.completion !== 'all';
}

