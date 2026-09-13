import { getDb } from '@/lib/db/client';
import { generateId } from '@/lib/utils/uuid';
import { toLocalISO } from '@/lib/utils/date';
import { defaultViewPrefs } from '@/types/kanban.types';
import type { Kanban, CreateKanbanInput, UpdateKanbanInput, KanbanWithProject } from '@/types/kanban.types';
import { loadKanbanData, saveKanbanData } from '@/Kanban/api/kanbanDataStore';

export async function getKanbansByProject(projectId: string, includeArchived = false): Promise<Kanban[]> {
  const data = await loadKanbanData();
  return data.kanbans
    .filter((k) => k.projectId === projectId && (includeArchived || !k.archived))
    .sort((a, b) => a.position - b.position);
}

export async function getKanbanById(id: string): Promise<Kanban | null> {
  const data = await loadKanbanData();
  return data.kanbans.find((k) => k.id === id) ?? null;
}

const DEFAULT_COLUMN_NAMES = ['Pendências', 'Fazer', 'Fazendo', 'Feito'];

export async function createKanban(input: CreateKanbanInput): Promise<string> {
  const data = await loadKanbanData();
  const id = generateId();
  const now = toLocalISO(new Date());

  const siblings = data.kanbans.filter((k) => k.projectId === input.projectId);
  const nextPosition = siblings.length > 0 ? Math.max(...siblings.map((k) => k.position)) + 1 : 0;
  const isFirstKanban = !input.parentCardId && siblings.length === 0; // sub-kanban de card nunca vira "padrão do projeto"

  data.kanbans.push({
    id,
    projectId: input.projectId,
    parentCardId: input.parentCardId ?? null,
    name: input.name,
    description: input.description ?? null,
    color: input.color ?? null,
    isDefault: isFirstKanban,
    archived: false,
    position: nextPosition,
    viewPrefs: defaultViewPrefs(),
    createdAt: now,
    updatedAt: now,
  });

  // colunas padrão, criadas automaticamente pra um Kanban novo não nascer vazio de estrutura
  for (let i = 0; i < DEFAULT_COLUMN_NAMES.length; i++) {
    data.columns.push({
      id: generateId(),
      kanbanId: id,
      name: DEFAULT_COLUMN_NAMES[i],
      color: null,
      icon: null,
      wipLimit: null,
      visible: true,
      collapsed: false,
      position: i,
    });
  }

  await saveKanbanData(data);
  return id;
}

export async function updateKanban(id: string, input: UpdateKanbanInput): Promise<void> {
  const data = await loadKanbanData();
  const kanban = data.kanbans.find((k) => k.id === id);
  if (!kanban) return;

  let changed = false;
  if (input.name !== undefined) { kanban.name = input.name; changed = true; }
  if (input.description !== undefined) { kanban.description = input.description; changed = true; }
  if (input.color !== undefined) { kanban.color = input.color; changed = true; }
  if (input.archived !== undefined) { kanban.archived = input.archived; changed = true; }
  if (input.viewPrefs !== undefined) { kanban.viewPrefs = input.viewPrefs; changed = true; }
  if (!changed) return;

  kanban.updatedAt = toLocalISO(new Date());
  await saveKanbanData(data);
}

export async function setDefaultKanban(projectId: string, kanbanId: string): Promise<void> {
  const data = await loadKanbanData();
  for (const k of data.kanbans) {
    if (k.projectId === projectId) k.isDefault = k.id === kanbanId;
  }
  await saveKanbanData(data);
}

export async function reorderKanbans(projectId: string, orderedIds: string[]): Promise<void> {
  const data = await loadKanbanData();
  orderedIds.forEach((id, index) => {
    const kanban = data.kanbans.find((k) => k.id === id && k.projectId === projectId);
    if (kanban) kanban.position = index;
  });
  await saveKanbanData(data);
}

/**
 * Exclui o Kanban e faz o cascade manual que antes era responsabilidade do SQLite
 * (ON DELETE CASCADE em kanban_columns/kanban_card_groups/kanban_cards/kanban_card_checklist_items).
 */
export async function deleteKanban(id: string): Promise<void> {
  const data = await loadKanbanData();

  const columnIds = new Set(data.columns.filter((c) => c.kanbanId === id).map((c) => c.id));
  const groupIds = new Set(
    data.cardGroups.filter((g) => g.kanbanId === id || columnIds.has(g.columnId)).map((g) => g.id)
  );
  const cardIds = new Set(
    data.cards
      .filter(
        (c) =>
          c.kanbanId === id ||
          (c.columnId && columnIds.has(c.columnId)) ||
          (c.cardGroupId && groupIds.has(c.cardGroupId))
      )
      .map((c) => c.id)
  );

  data.checklistItems = data.checklistItems.filter((item) => !cardIds.has(item.cardId));
  data.cards = data.cards.filter((c) => !cardIds.has(c.id));
  data.cardGroups = data.cardGroups.filter((g) => !groupIds.has(g.id));
  data.columns = data.columns.filter((c) => !columnIds.has(c.id));
  data.kanbans = data.kanbans.filter((k) => k.id !== id);

  await saveKanbanData(data);
}

/** Cópia rasa da estrutura (Kanban + Colunas), SEM cards. */
export async function duplicateKanban(id: string): Promise<string> {
  const data = await loadKanbanData();
  const original = data.kanbans.find((k) => k.id === id);
  if (!original) throw new Error('Kanban não encontrado para duplicar');

  const newId = await createKanban({
    projectId: original.projectId,
    name: `${original.name} (cópia)`,
    description: original.description,
    color: original.color,
  });

  const originalColumns = data.columns
    .filter((c) => c.kanbanId === id)
    .sort((a, b) => a.position - b.position);

  // remove as colunas-padrão criadas automaticamente por createKanban e recria a partir das colunas reais do original
  const freshData = await loadKanbanData();
  freshData.columns = freshData.columns.filter((c) => c.kanbanId !== newId);
  for (const col of originalColumns) {
    freshData.columns.push({
      id: generateId(),
      kanbanId: newId,
      name: col.name,
      color: col.color,
      icon: col.icon,
      wipLimit: col.wipLimit,
      visible: col.visible,
      collapsed: false,
      position: col.position,
    });
  }
  await saveKanbanData(freshData);

  return newId;
}

interface ProjectSummaryRow {
  id: string;
  name: string;
  color: string | null;
  cover_path: string | null;
  archived: number;
}

/**
 * `projects` continua no SQLite (fora do escopo desta migração), então esta função
 * segue lendo de lá via `getDb()` — só o lado do Kanban virou JSON. Join feito em JS.
 */
export async function getAllKanbansWithProject(): Promise<KanbanWithProject[]> {
  const data = await loadKanbanData();
  const topLevel = data.kanbans.filter((k) => !k.parentCardId);
  if (topLevel.length === 0) return [];

  const db = await getDb();
  const projectIds = [...new Set(topLevel.map((k) => k.projectId))];
  const placeholders = projectIds.map((_, i) => `$${i + 1}`).join(', ');
  const projectRows = await db.select<ProjectSummaryRow[]>(
    `SELECT id, name, color, cover_path, archived FROM projects WHERE id IN (${placeholders})`,
    projectIds
  );
  const projectsById = new Map(projectRows.map((p) => [p.id, p]));

  const result: KanbanWithProject[] = [];
  for (const k of topLevel) {
    const project = projectsById.get(k.projectId);
    if (!project) continue; // equivalente ao INNER JOIN original
    result.push({
      ...k,
      projectName: project.name,
      projectColor: project.color,
      projectCoverPath: project.cover_path,
      projectArchived: !!project.archived,
    });
  }

  result.sort((a, b) => a.projectName.localeCompare(b.projectName) || a.position - b.position);
  return result;
}

export async function getCardIdsWithSubKanban(cardIds: string[]): Promise<Set<string>> {
  if (cardIds.length === 0) return new Set();
  const data = await loadKanbanData();
  const cardIdSet = new Set(cardIds);
  const result = new Set<string>();
  for (const k of data.kanbans) {
    if (k.parentCardId && cardIdSet.has(k.parentCardId)) result.add(k.parentCardId);
  }
  return result;
}
