import { getDb } from '@/lib/db/client';
import { defaultViewPrefs } from '@/types/kanban.types';
import type {
  Kanban,
  KanbanColumn,
  KanbanCardGroup,
  KanbanCard,
  KanbanChecklistItem,
  KanbanViewPrefs,
} from '@/types/kanban.types';
import { loadKanbanData, saveKanbanData } from './kanbanDataStore';

interface KanbanRow {
  id: string;
  project_id: string;
  parent_card_id: string | null;
  name: string;
  description: string | null;
  color: string | null;
  is_default: number;
  archived: number;
  position: number;
  view_prefs: string;
  created_at: string;
  updated_at: string;
}

interface ColumnRow {
  id: string;
  kanban_id: string;
  name: string;
  color: string | null;
  icon: string | null;
  wip_limit: number | null;
  visible: number;
  position: number;
}

interface GroupRow {
  id: string;
  kanban_id: string;
  column_id: string;
  name: string;
  position: number;
}

interface CardRow {
  id: string;
  kanban_id: string | null;
  column_id: string | null;
  card_group_id: string | null;
  title: string;
  description: string | null;
  cover_path: string | null;
  color: string | null;
  priority: KanbanCard['priority'];
  labels: string;
  assigned_to: string | null;
  start_date: string | null;
  due_date: string | null;
  position: number;
  archived: number;
  created_at: string;
  updated_at: string;
}

interface ItemRow {
  id: string;
  card_id: string;
  parent_item_id: string | null;
  title: string;
  checked: number;
  position: number;
}

function parseViewPrefs(raw: string): KanbanViewPrefs {
  try {
    return { ...defaultViewPrefs(), ...JSON.parse(raw) };
  } catch {
    return defaultViewPrefs();
  }
}

/**
 * Migração one-shot: lê as 5 tabelas do SQLite (só SELECT, nunca escreve/apaga nada lá)
 * e MESCLA por `id` no kanban-data.json — nunca sobrescreve nem remove nada que já
 * exista no JSON. Roda no máximo uma vez de verdade — se `migratedFromSqliteAt` já
 * existir no JSON, é no-op.
 */
export async function migrateKanbanDataFromSqliteIfNeeded(): Promise<void> {
  const current = await loadKanbanData();
  if (current.migratedFromSqliteAt) return;

  const db = await getDb();

  const kanbanRows = await db.select<KanbanRow[]>('SELECT * FROM kanbans');
  const columnRows = await db.select<ColumnRow[]>('SELECT * FROM kanban_columns');
  const groupRows = await db.select<GroupRow[]>('SELECT * FROM kanban_card_groups');
  const cardRows = await db.select<CardRow[]>('SELECT * FROM kanban_cards');
  const itemRows = await db.select<ItemRow[]>('SELECT * FROM kanban_card_checklist_items');

  const existingKanbanIds = new Set(current.kanbans.map((k) => k.id));
  const existingColumnIds = new Set(current.columns.map((c) => c.id));
  const existingGroupIds = new Set(current.cardGroups.map((g) => g.id));
  const existingCardIds = new Set(current.cards.map((c) => c.id));
  const existingItemIds = new Set(current.checklistItems.map((i) => i.id));

  const newKanbans: Kanban[] = kanbanRows
    .filter((row) => !existingKanbanIds.has(row.id))
    .map((row) => ({
      id: row.id,
      projectId: row.project_id,
      parentCardId: row.parent_card_id,
      name: row.name,
      description: row.description,
      color: row.color,
      isDefault: !!row.is_default,
      archived: !!row.archived,
      position: row.position,
      viewPrefs: parseViewPrefs(row.view_prefs),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

  const newColumns: KanbanColumn[] = columnRows
    .filter((row) => !existingColumnIds.has(row.id))
    .map((row) => ({
      id: row.id,
      kanbanId: row.kanban_id,
      name: row.name,
      color: row.color,
      icon: row.icon,
      wipLimit: row.wip_limit,
      visible: !!row.visible,
      collapsed: false,
      position: row.position,
    }));

  const newCardGroups: KanbanCardGroup[] = groupRows
    .filter((row) => !existingGroupIds.has(row.id))
    .map((row) => ({
      id: row.id,
      kanbanId: row.kanban_id,
      columnId: row.column_id,
      name: row.name,
      position: row.position,
    }));

  const newCards: KanbanCard[] = cardRows
    .filter((row) => !existingCardIds.has(row.id))
    .map((row) => ({
      id: row.id,
      kanbanId: row.kanban_id,
      columnId: row.column_id,
      cardGroupId: row.card_group_id,
      title: row.title,
      description: row.description,
      coverPath: row.cover_path,
      color: row.color,
      priority: row.priority,
      labels: JSON.parse(row.labels || '[]'),
      assignedTo: row.assigned_to,
      startDate: row.start_date,
      dueDate: row.due_date,
      position: row.position,
      archived: !!row.archived,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

  const newChecklistItems: KanbanChecklistItem[] = itemRows
    .filter((row) => !existingItemIds.has(row.id))
    .map((row) => ({
      id: row.id,
      cardId: row.card_id,
      parentItemId: row.parent_item_id,
      title: row.title,
      checked: !!row.checked,
      position: row.position,
    }));

  await saveKanbanData({
    kanbans: [...current.kanbans, ...newKanbans],
    columns: [...current.columns, ...newColumns],
    cardGroups: [...current.cardGroups, ...newCardGroups],
    cards: [...current.cards, ...newCards],
    checklistItems: [...current.checklistItems, ...newChecklistItems],
    parentCardGroups: current.parentCardGroups, // fluxo separado, nunca existiu no SQLite — preserva o que já tiver
    migratedFromSqliteAt: new Date().toISOString(),
  });
}
