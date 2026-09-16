export interface Kanban {
  id: string;
  projectId: string;
  parentCardId: string | null;
  name: string;
  description: string | null;
  color: string | null;
  backgroundColor: string | null;
  backgroundImagePath: string | null;
  cardFieldConfig: CardFieldConfig[];
  isDefault: boolean;
  archived: boolean;
  position: number;
  viewPrefs: KanbanViewPrefs;
  createdAt: string;
  updatedAt: string;
}

export interface KanbanCard {
  id: string;
  kanbanId: string | null;
  columnId: string | null;
  parentCardId?: string | null;
  cardGroupId: string | null;
  title: string;
  description: string | null;
  coverPath: string | null;
  color: string | null;
  priority: TaskPriority | null;
  status: TaskStatus | null;
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
  kanbanId?: string | null;
  columnId?: string | null;
  cardGroupId?: string;
  title: string;
  parentCardId?: string | null;
  description?: string | null;
  color?: string | null;
  priority?: TaskPriority | null;
  status?: TaskStatus | null;
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
  status: TaskStatus | null;
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
  groupHeights: Record<string, number>; // groupId -> px
  collapsedColumnIds: string[];
  collapsedGroupIds: string[];
  savedFilters: KanbanSavedFilter[];
}

export function defaultViewPrefs(): KanbanViewPrefs {
  return { density: 'normal', columnWidths: {}, groupHeights: {}, collapsedColumnIds: [], collapsedGroupIds: [], savedFilters: [] };
}

export interface KanbanColumn {
  id: string;
  kanbanId: string;
  name: string;
  color: string | null;
  icon: string | null;
  coverPath: string | null;
  wipLimit: number | null;
  visible: boolean;
  collapsed: boolean;
  position: number;
}

export interface CreateKanbanInput {
  projectId: string;
  parentCardId?: string | null;
  name: string;
  description?: string | null;
  color?: string | null;
  backgroundColor?: string | null;
  backgroundImagePath?: string | null;
  cardFieldConfig?: CardFieldConfig[];
}

export type UpdateKanbanInput = Partial<{
  name: string;
  description: string | null;
  color: string | null;
  backgroundColor: string | null;
  backgroundImagePath: string | null;
  cardFieldConfig: CardFieldConfig[];
  archived: boolean;
  viewPrefs: KanbanViewPrefs;
}>;

export interface CreateKanbanColumnInput {
  kanbanId: string;
  name: string;
  color?: string | null;
  icon?: string | null;
  coverPath?: string | null;
  wipLimit?: number | null;
}

export type UpdateKanbanColumnInput = Partial<{
  name: string;
  color: string | null;
  icon: string | null;
  coverPath: string | null;
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

export type TaskStatus = 'pendente' | 'fazer' | 'fazendo' | 'revisao' | 'feito';

export const STATUS_LABELS: Record<TaskStatus, string> = {
  pendente: 'Pendente',
  fazer: 'Fazer',
  fazendo: 'Fazendo',
  revisao: 'Revisão',
  feito: 'Feito',
};

export const STATUS_COLORS: Record<TaskStatus, string> = {
  pendente: '#9e9e9e',
  fazer: '#1a73e8',
  fazendo: '#f4a623',
  revisao: '#8e24aa',
  feito: '#2e7d32',
};

/**
 * Configuração, por kanban, de quais campos do card aparecem em qual aba do modal de
 * detalhes (Detalhes ou Propriedades) e se aparecem de todo. O título nunca entra aqui —
 * é sempre visível, faz parte da identidade do card.
 */
export type CardFieldKey =
  | 'description' | 'subKanban' | 'checklist' | 'startDate' | 'dueDate'
  | 'cover' | 'priority' | 'status' | 'color' | 'labels';

export type CardFieldTab = 'details' | 'properties';

export interface CardFieldConfig {
  key: CardFieldKey;
  tab: CardFieldTab;
  visible: boolean;
}

export const CARD_FIELD_LABELS: Record<CardFieldKey, string> = {
  description: 'Descrição',
  subKanban: 'Sub-kanban',
  checklist: 'Lista de tarefas',
  startDate: 'Data inicial',
  dueDate: 'Prazo',
  cover: 'Capa',
  priority: 'Prioridade',
  status: 'Status',
  color: 'Cor',
  labels: 'Etiquetas',
};

export function defaultCardFieldConfig(): CardFieldConfig[] {
  return [
    { key: 'description', tab: 'details', visible: true },
    { key: 'subKanban', tab: 'details', visible: true },
    { key: 'checklist', tab: 'details', visible: true },
    { key: 'startDate', tab: 'details', visible: true },
    { key: 'dueDate', tab: 'details', visible: true },
    { key: 'cover', tab: 'properties', visible: true },
    { key: 'priority', tab: 'properties', visible: true },
    { key: 'status', tab: 'properties', visible: true },
    { key: 'color', tab: 'properties', visible: true },
    { key: 'labels', tab: 'properties', visible: true },
  ];
}

/**
 * Garante que todo CardFieldKey conhecido tem uma entrada, mesmo que `config` seja de um
 * kanban salvo antes deste campo existir (undefined) ou de uma versão anterior sem alguma
 * chave nova — usa o padrão pra preencher o que faltar, sem apagar o que o usuário já configurou.
 */
export function mergeCardFieldConfig(config: CardFieldConfig[] | undefined): CardFieldConfig[] {
  const base = defaultCardFieldConfig();
  if (!config) return base;
  return base.map((def) => config.find((c) => c.key === def.key) ?? def);
}

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

export interface KanbanWithProject extends Kanban {
  projectName: string;
  projectColor: string | null;
  projectCoverPath: string | null;
  projectArchived: boolean;
}

export interface KanbanCardGroup {
  id: string;
  kanbanId: string;
  columnId: string;
  name: string;
  position: number;
  parentGroupId: string | null;
  /** Capa de imagem do grupo/subgrupo, mesmo padrão de coluna e card. */
  coverPath: string | null;
  /** Emoji de identificação do grupo/subgrupo, mostrado ao lado do nome. */
  emoji: string | null;
  /** Descrição livre do grupo/subgrupo, mostrada abaixo do cabeçalho quando o painel de aparência está fechado. */
  description: string | null;
  /** Cor de fundo do bloco do grupo/subgrupo, sobrepõe o cinza padrão (#f5f5f5). */
  backgroundColor: string | null;
}

/** Campos de aparência do grupo/subgrupo editáveis via `updateGroupAppearance`. Nome continua em `renameGroup`. */
export type UpdateKanbanCardGroupInput = Partial<{
  coverPath: string | null;
  emoji: string | null;
  description: string | null;
  backgroundColor: string | null;
}>;

export interface ParentCardGroup {
  id: string;
  parentCardId: string;
  name: string;
  position: number;
}

export interface KanbanChecklistItem {
  id: string;
  cardId: string;
  parentItemId: string | null;
  title: string;
  checked: boolean;
  position: number;
}

export interface ChecklistProgress {
  done: number;
  total: number;
}
