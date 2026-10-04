export interface Event {
  id: string;
  project_id: string | null;
  title: string;
  description: string | null;
  start_at: string;
  end_at: string;
}
export interface CreateEventInput {
  title: string;
  project_id: string | null;
  description?: string | null;
  start_at: string;
  end_at: string;
}
export type UpdateEventInput = Partial<CreateEventInput>;

/** Sub-card de detalhamento: "o que foi feito" em um trecho do evento. */
export interface EventDetail {
  id: string;
  event_id: string;
  content: string;
  /** @deprecated substituído por start_offset/end_offset. Mantido só pra ler dados antigos. */
  time_label: string | null;
  /**
   * Trecho do evento que este detalhe cobre, em minutos a partir do INÍCIO do
   * evento (0 = início, duração do evento = fim). Nulos só em dados antigos,
   * que são distribuídos pelo evento ao carregar o store.
   */
  start_offset: number | null;
  end_offset: number | null;
  position: number;
  created_at: string;
}
