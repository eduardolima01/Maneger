export interface Event {
  id: string;
  project_id: string | null;
  title: string;
  start_at: string;
  end_at: string;
}
export interface CreateEventInput {
  title: string;
  project_id: string | null;
  start_at: string;
  end_at: string;
}
export type UpdateEventInput = Partial<CreateEventInput>;
