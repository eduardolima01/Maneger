export interface Event {
  id: number;
  project_id: number | null;
  title: string;
  start_at: string;
  end_at: string;
}

export interface CreateEventInput {
  title: string;
  project_id: number | null;
  start_at: string;
  end_at: string;
}

export type UpdateEventInput = Partial<CreateEventInput>;
