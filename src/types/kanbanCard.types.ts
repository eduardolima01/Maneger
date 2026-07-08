export type KanbanStatus = 'todo' | 'doing' | 'done';

export interface KanbanCard {
  id: string;
  project_id: string;
  title: string;
  status: KanbanStatus;
  position: number;
}

export interface CreateKanbanCardInput {
  project_id: string;
  title: string;
  status?: KanbanStatus;
}

export type UpdateKanbanCardInput = Partial<Pick<KanbanCard, 'title' | 'status' | 'position'>>;
