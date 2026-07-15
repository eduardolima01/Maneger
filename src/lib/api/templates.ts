import { getDb } from '@/lib/db/client';
import { generateId } from '@/lib/utils/uuid';
import { toLocalISO } from '@/lib/utils/date';
import type {
  Template, TemplateField, CreateTemplateInput, UpdateTemplateInput,
  CreateTemplateFieldInput, UpdateTemplateFieldInput,
} from '@/types/template.types';

interface TemplateRow {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

interface TemplateFieldRow {
  id: string;
  template_id: string;
  key: string;
  label: string;
  type: TemplateField['type'];
  required: number;
  default_value: string | null;
  options: string;
  placeholder: string | null;
  read_only: number;
  position: number;
}

function rowToField(row: TemplateFieldRow): TemplateField {
  return {
    id: row.id,
    templateId: row.template_id,
    key: row.key,
    label: row.label,
    type: row.type,
    required: !!row.required,
    defaultValue: row.default_value ? JSON.parse(row.default_value) : null,
    options: JSON.parse(row.options),
    placeholder: row.placeholder,
    readOnly: !!row.read_only,
    order: row.position,
  };
}

function rowToTemplate(row: TemplateRow, fields: TemplateField[]): Template {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    description: row.description,
    fields,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getTemplatesByProject(projectId: string): Promise<Template[]> {
  const db = await getDb();
  const templateRows = await db.select<TemplateRow[]>(
    'SELECT * FROM templates WHERE project_id = $1 ORDER BY name ASC',
    [projectId]
  );
  if (templateRows.length === 0) return [];

  const ids = templateRows.map((t) => t.id);
  const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
  const fieldRows = await db.select<TemplateFieldRow[]>(
    `SELECT * FROM template_fields WHERE template_id IN (${placeholders}) ORDER BY position ASC`,
    ids
  );

  const fieldsByTemplate = new Map<string, TemplateField[]>();
  for (const row of fieldRows) {
    const list = fieldsByTemplate.get(row.template_id) ?? [];
    list.push(rowToField(row));
    fieldsByTemplate.set(row.template_id, list);
  }

  return templateRows.map((row) => rowToTemplate(row, fieldsByTemplate.get(row.id) ?? []));
}

export async function getTemplateById(id: string): Promise<Template | null> {
  const db = await getDb();
  const rows = await db.select<TemplateRow[]>('SELECT * FROM templates WHERE id = $1', [id]);
  if (rows.length === 0) return null;
  const fieldRows = await db.select<TemplateFieldRow[]>(
    'SELECT * FROM template_fields WHERE template_id = $1 ORDER BY position ASC',
    [id]
  );
  return rowToTemplate(rows[0], fieldRows.map(rowToField));
}

export async function createTemplate(input: CreateTemplateInput): Promise<string> {
  const db = await getDb();
  const id = generateId();
  const now = toLocalISO(new Date());
  await db.execute(
    'INSERT INTO templates (id, project_id, name, description, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $5)',
    [id, input.projectId, input.name, input.description ?? null, now]
  );
  return id;
}

export async function updateTemplate(id: string, input: UpdateTemplateInput): Promise<void> {
  const entries = Object.entries(input).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return;
  const db = await getDb();
  const setClause = entries.map(([key], i) => `${key === 'name' ? 'name' : 'description'} = $${i + 1}`).join(', ');
  const values = entries.map(([, v]) => v);
  values.push(toLocalISO(new Date()), id);
  await db.execute(`UPDATE templates SET ${setClause}, updated_at = $${entries.length + 1} WHERE id = $${entries.length + 2}`, values);
}

/**
 * Apagar um Template usado por algum log_group falha por causa do
 * `ON DELETE RESTRICT` no schema. Traduzimos o erro cru do SQLite pra uma
 * mensagem que a UI pode mostrar direto, em vez de vazar "FOREIGN KEY constraint failed".
 */
export async function deleteTemplate(id: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  const db = await getDb();
  try {
    await db.execute('DELETE FROM templates WHERE id = $1', [id]);
    return { ok: true };
  } catch {
    return { ok: false, reason: 'Este template está em uso por um ou mais grupos de logs. Exclua ou mude o template desses grupos antes.' };
  }
}

export async function createTemplateField(input: CreateTemplateFieldInput): Promise<string> {
  const db = await getDb();
  const id = generateId();

  const existing = await db.select<{ maxPos: number | null }[]>(
    'SELECT MAX(position) as maxPos FROM template_fields WHERE template_id = $1',
    [input.templateId]
  );
  const nextPosition = (existing[0]?.maxPos ?? -1) + 1;

  await db.execute(
    `INSERT INTO template_fields (id, template_id, key, label, type, required, default_value, options, placeholder, read_only, position)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0, $10)`,
    [
      id, input.templateId, input.key, input.label, input.type,
      input.required ? 1 : 0,
      input.defaultValue !== undefined ? JSON.stringify(input.defaultValue) : null,
      JSON.stringify(input.options ?? []),
      input.placeholder ?? null,
      nextPosition,
    ]
  );
  return id;
}

export async function updateTemplateField(id: string, input: UpdateTemplateFieldInput): Promise<void> {
  const entries: [string, unknown][] = [];
  if (input.key !== undefined) entries.push(['key', input.key]);
  if (input.label !== undefined) entries.push(['label', input.label]);
  if (input.type !== undefined) entries.push(['type', input.type]);
  if (input.required !== undefined) entries.push(['required', input.required ? 1 : 0]);
  if (input.defaultValue !== undefined) entries.push(['default_value', JSON.stringify(input.defaultValue)]);
  if (input.options !== undefined) entries.push(['options', JSON.stringify(input.options)]);
  if (input.placeholder !== undefined) entries.push(['placeholder', input.placeholder]);
  if (entries.length === 0) return;

  const db = await getDb();
  const setClause = entries.map(([key], i) => `${key} = $${i + 1}`).join(', ');
  const values = entries.map(([, v]) => v);
  values.push(id);
  await db.execute(`UPDATE template_fields SET ${setClause} WHERE id = $${entries.length + 1}`, values);
}

export async function deleteTemplateField(id: string): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM template_fields WHERE id = $1', [id]);
}

export async function reorderTemplateFields(templateId: string, orderedIds: string[]): Promise<void> {
  const db = await getDb();
  for (let index = 0; index < orderedIds.length; index++) {
    await db.execute(
      'UPDATE template_fields SET position = $1 WHERE id = $2 AND template_id = $3',
      [index, orderedIds[index], templateId]
    );
  }
}
