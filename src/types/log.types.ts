import type { FieldValue } from './template.types';

export type LogValues = Record<string, FieldValue>;

export interface Log {
  id: string;
  groupId: string;
  templateId: string;
  values: LogValues;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLogInput {
  groupId: string;
  templateId: string;
  values: LogValues;
}

export interface UpdateLogInput {
  values?: LogValues;
}

export interface LogGroup {
  id: string;
  projectId: string;
  templateId: string;
  name: string;
  position: number;
}

export interface CreateLogGroupInput {
  projectId: string;
  templateId: string;
  name: string;
}

export type UpdateLogGroupInput = Partial<Pick<CreateLogGroupInput, 'name' | 'templateId'>>;

// Arquitetura preparada pra busca/ordenação/paginação (item "Organização" do ticket).
// Hoje resolvido client-side dentro do hook (ver useLogs) — se o volume de Logs
// crescer muito, essas mesmas opções podem migrar pra parâmetros de query SQL
// sem precisar mudar a interface pública do hook.

export interface LogQueryOptions {
  search?: string;
  sortByFieldKey?: string | null; // null = ordena por createdAt
  sortDir?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

