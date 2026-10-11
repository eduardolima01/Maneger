import {
  STATUS_LABELS, PRIORITY_LABELS, CHECKLIST_STATUS_LABELS,
  type TaskStatus, type TaskPriority, type ChecklistItemStatus,
} from '@/types/kanban.types';
import { parseLabel } from '@/Kanban/utils/kanbanLabels';

/**
 * Histórico de alterações do kanban (desfazer / refazer). Funciona por DIFERENÇA: a cada gravação do JSON, compara o
 * estado de antes com o de depois e guarda só o que mudou — por isso não precisa mexer em cada ação do app.
 * Só entram cards, grupos/subgrupos, colunas e itens de checklist (nome/cores/preferências de visão do kanban não).
 * O histórico mora dentro do próprio JSON (`history`), uma pilha por kanban.
 */

export type HistColl = 'columns' | 'cardGroups' | 'cards' | 'checklistItems';
export const HIST_COLLS: HistColl[] = ['columns', 'cardGroups', 'cards', 'checklistItems'];

type Row = Record<string, unknown> & { id: string };

export interface HistChange {
  coll: HistColl;
  id: string;
  op: 'add' | 'remove' | 'update';
  /** Nome do item na hora (título/nome) — pra mostrar no histórico mesmo depois de renomeado/excluído. */
  name: string;
  /** Linha de texto pronta: "Card “X”: prazo 05/10/2026 → 06/10/2026". */
  text: string;
  /** add: o item inteiro (pra refazer). remove: o item inteiro (pra desfazer). */
  before?: Row;
  after?: Row;
  /** update: só os campos que mudaram. `from` ausente = o campo não existia. */
  fields?: Record<string, { from?: unknown; to?: unknown }>;
}

export interface HistEntry {
  id: string;
  ts: number;
  desc: string;
  changes: HistChange[];
}

export interface HistBucket {
  entries: HistEntry[];
  /** Quantas entradas estão aplicadas (as de índice >= pointer foram desfeitas e podem ser refeitas). */
  pointer: number;
}

export interface HistoryHost {
  kanbans: Array<{ id: string }>;
  columns: Row[];
  cardGroups: Row[];
  cards: Row[];
  checklistItems: Row[];
  history?: Record<string, HistBucket>;
}

export const MAX_HISTORY_ENTRIES = 200;
const MERGE_WINDOW_MS = 2000; // edições seguidas do MESMO campo do MESMO item (digitar, arrastar slider) viram uma entrada só
const MAX_CHANGES_PER_ENTRY = 500; // gravações gigantes (importação/migração) não entram

const IGNORED_FIELDS = new Set(['updatedAt']);

/* ------------------------------ avisos de mudança (pra atualizar telas) ------------------------------ */

export type HistoryEventKind = 'recorded' | 'applied';
const listeners = new Set<(kind: HistoryEventKind) => void>();

export function subscribeHistory(cb: (kind: HistoryEventKind) => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}
export function emitHistoryChanged(kind: HistoryEventKind): void {
  listeners.forEach((l) => l(kind));
}

/* ------------------------------ textos ------------------------------ */

const COLL_LABEL: Record<HistColl, { one: string; many: string; fem: boolean }> = {
  cards: { one: 'Card', many: 'cards', fem: false },
  cardGroups: { one: 'Grupo', many: 'grupos', fem: false },
  columns: { one: 'Coluna', many: 'colunas', fem: true },
  checklistItems: { one: 'Item de checklist', many: 'itens de checklist', fem: false },
};

const FIELD_LABEL: Record<string, string> = {
  title: 'título', description: 'descrição', coverPath: 'capa', color: 'cor', priority: 'prioridade', status: 'status',
  labels: 'etiquetas', notes: 'notas', notesColor: 'cor da nota', schedules: 'horários', assignedTo: 'responsável',
  startDate: 'data inicial', dueDate: 'prazo', columnId: 'coluna', cardGroupId: 'grupo', kanbanId: 'kanban',
  archived: 'arquivado', position: 'ordem', name: 'nome', emoji: 'emoji', backgroundColor: 'cor de fundo',
  parentGroupId: 'grupo pai', icon: 'ícone', wipLimit: 'limite WIP', visible: 'visível', collapsed: 'recolhida',
  parentItemId: 'item pai', simple: 'lista simples', isPlanTemplate: 'modelo de plano', planActive: 'plano ativo',
  planWeekdays: 'dias do plano', planTimesPerDay: 'vezes por dia', planTargetColumnId: 'coluna do plano',
  planTargetGroupId: 'grupo do plano', parentCardId: 'card pai',
};
const LONG_TEXT_FIELDS = new Set(['description', 'notes']);

function trunc(s: string, n = 30): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T;
}

interface Ctx { before: HistoryHost; after: HistoryHost }

function rowsOf(host: HistoryHost, coll: HistColl): Row[] {
  return (host[coll] as Row[] | undefined) ?? [];
}

function nameOfRow(coll: HistColl, row: Row | undefined): string {
  if (!row) return '?';
  const raw = coll === 'cards' || coll === 'checklistItems' ? row.title : row.name;
  return trunc(String(raw ?? '').trim() || '(sem nome)', 40);
}

function lookupName(ctx: Ctx, coll: 'columns' | 'cardGroups', id: unknown): string {
  const row = rowsOf(ctx.after, coll).find((r) => r.id === id) ?? rowsOf(ctx.before, coll).find((r) => r.id === id);
  return row ? trunc(String(row.name ?? '?')) : '?';
}

function fmtDate(v: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : v;
}

function fmtValue(coll: HistColl, field: string, v: unknown, ctx: Ctx): string {
  if (v === null || v === undefined || v === '') return 'vazio';
  if (field === 'status') {
    const map = (coll === 'checklistItems' ? CHECKLIST_STATUS_LABELS : STATUS_LABELS) as Record<string, string>;
    return map[v as TaskStatus & ChecklistItemStatus] ?? String(v);
  }
  if (field === 'priority') return (PRIORITY_LABELS as Record<string, string>)[v as TaskPriority] ?? String(v);
  if (field === 'columnId' || field === 'planTargetColumnId') return `“${lookupName(ctx, 'columns', v)}”`;
  if (field === 'cardGroupId' || field === 'parentGroupId' || field === 'planTargetGroupId') return `“${lookupName(ctx, 'cardGroups', v)}”`;
  if ((field === 'dueDate' || field === 'startDate') && typeof v === 'string') return fmtDate(v);
  if (typeof v === 'boolean') return v ? 'sim' : 'não';
  if (Array.isArray(v)) return String(v.length);
  if (typeof v === 'string') return `“${trunc(v)}”`;
  return String(v);
}

function labelNames(v: unknown): string[] {
  return Array.isArray(v) ? v.map((l) => parseLabel(String(l)).name) : [];
}

function fieldLine(coll: HistColl, field: string, from: unknown, to: unknown, ctx: Ctx): string {
  const label = FIELD_LABEL[field] ?? field;
  if (field === 'labels') {
    const a = new Set(labelNames(from));
    const b = new Set(labelNames(to));
    const added = [...b].filter((x) => !a.has(x)).map((x) => `+${x}`);
    const removed = [...a].filter((x) => !b.has(x)).map((x) => `−${x}`);
    return `${label} ${[...added, ...removed].join(' ') || 'reordenadas'}`;
  }
  if (LONG_TEXT_FIELDS.has(field)) return `${label} alterada`;
  if (field === 'position') return 'ordem alterada';
  return `${label} ${fmtValue(coll, field, from, ctx)} → ${fmtValue(coll, field, to, ctx)}`;
}

function changeText(ch: HistChange, ctx: Ctx): string {
  const lbl = COLL_LABEL[ch.coll];
  if (ch.op === 'add') return `${lbl.one} ${lbl.fem ? 'criada' : 'criado'}: “${ch.name}”`;
  if (ch.op === 'remove') return `${lbl.one} ${lbl.fem ? 'excluída' : 'excluído'}: “${ch.name}”`;
  const entries = Object.entries(ch.fields ?? {});
  const real = entries.filter(([k]) => k !== 'position');
  const use = real.length > 0 ? real : entries;
  return `${lbl.one} “${ch.name}”: ${use.map(([k, f]) => fieldLine(ch.coll, k, f.from, f.to, ctx)).join('; ')}`;
}

function summarize(changes: HistChange[]): string {
  const parts: string[] = [];
  const groups = new Map<string, HistChange[]>();
  for (const ch of changes) {
    const key = `${ch.coll}:${ch.op}`;
    groups.set(key, [...(groups.get(key) ?? []), ch]);
  }
  for (const [key, list] of groups) {
    const [coll, op] = key.split(':') as [HistColl, HistChange['op']];
    const lbl = COLL_LABEL[coll];
    if (op === 'add') {
      parts.push(list.length === 1 ? `${lbl.one} ${lbl.fem ? 'criada' : 'criado'}: “${list[0].name}”` : `${list.length} ${lbl.many} ${lbl.fem ? 'criadas' : 'criados'}`);
    } else if (op === 'remove') {
      parts.push(list.length === 1 ? `${lbl.one} ${lbl.fem ? 'excluída' : 'excluído'}: “${list[0].name}”` : `${list.length} ${lbl.many} ${lbl.fem ? 'excluídas' : 'excluídos'}`);
    } else {
      const onlyPosition = list.every((c) => Object.keys(c.fields ?? {}).every((k) => k === 'position'));
      if (onlyPosition) {
        parts.push(`Reordenação (${list.length} ${list.length === 1 ? 'item' : 'itens'})`);
      } else if (list.length === 1) {
        parts.push(list[0].text);
      } else {
        const names = new Set<string>();
        for (const c of list) for (const k of Object.keys(c.fields ?? {})) if (k !== 'position') names.add(FIELD_LABEL[k] ?? k);
        parts.push(`${list.length} ${lbl.many}: ${[...names].slice(0, 3).join(', ')}`);
      }
    }
  }
  const shown = parts.slice(0, 3).join(' · ');
  return parts.length > 3 ? `${shown} · +${parts.length - 3}` : shown;
}

/* ------------------------------ diferença ------------------------------ */

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function diffData(before: HistoryHost, after: HistoryHost): HistChange[] {
  const ctx: Ctx = { before, after };
  const out: HistChange[] = [];
  for (const coll of HIST_COLLS) {
    const b = new Map(rowsOf(before, coll).map((r) => [r.id, r]));
    const a = new Map(rowsOf(after, coll).map((r) => [r.id, r]));
    for (const [id, row] of a) {
      const old = b.get(id);
      if (!old) {
        const ch: HistChange = { coll, id, op: 'add', name: nameOfRow(coll, row), text: '', after: clone(row) };
        ch.text = changeText(ch, ctx);
        out.push(ch);
        continue;
      }
      const fields: Record<string, { from?: unknown; to?: unknown }> = {};
      const keys = new Set([...Object.keys(old), ...Object.keys(row)]);
      for (const k of keys) {
        if (IGNORED_FIELDS.has(k)) continue;
        if (!sameJson(old[k], row[k])) fields[k] = { from: clone(old[k]), to: clone(row[k]) };
      }
      if (Object.keys(fields).length > 0) {
        const ch: HistChange = { coll, id, op: 'update', name: nameOfRow(coll, row), text: '', fields };
        ch.text = changeText(ch, ctx);
        out.push(ch);
      }
    }
    for (const [id, old] of b) {
      if (!a.has(id)) {
        const ch: HistChange = { coll, id, op: 'remove', name: nameOfRow(coll, old), text: '', before: clone(old) };
        ch.text = changeText(ch, ctx);
        out.push(ch);
      }
    }
  }
  return out;
}

/* ------------------------------ a qual kanban a mudança pertence ------------------------------ */

function kanbanIdOfRow(coll: HistColl, row: Row | undefined, ctx: Ctx): string | null {
  if (!row) return null;
  if (coll === 'columns' || coll === 'cardGroups') return (row.kanbanId as string | undefined) ?? null;
  if (coll === 'cards') {
    if (row.kanbanId) return row.kanbanId as string;
    if (row.cardGroupId) {
      const g = rowsOf(ctx.after, 'cardGroups').find((x) => x.id === row.cardGroupId) ?? rowsOf(ctx.before, 'cardGroups').find((x) => x.id === row.cardGroupId);
      return (g?.kanbanId as string | undefined) ?? null;
    }
    return null;
  }
  const card = rowsOf(ctx.after, 'cards').find((x) => x.id === row.cardId) ?? rowsOf(ctx.before, 'cards').find((x) => x.id === row.cardId);
  return kanbanIdOfRow('cards', card, ctx);
}

function bucketKeyFor(changes: HistChange[], ctx: Ctx): string {
  for (const ch of changes) {
    const row = ch.after ?? ch.before ?? rowsOf(ctx.after, ch.coll).find((r) => r.id === ch.id) ?? rowsOf(ctx.before, ch.coll).find((r) => r.id === ch.id);
    const id = kanbanIdOfRow(ch.coll, row, ctx);
    if (id) return id;
  }
  return '_global';
}

/* ------------------------------ gravar no histórico ------------------------------ */

function canMerge(last: HistEntry, changes: HistChange[]): boolean {
  if (last.changes.length !== 1 || changes.length !== 1) return false;
  const a = last.changes[0];
  const b = changes[0];
  if (a.op !== 'update' || b.op !== 'update' || a.coll !== b.coll || a.id !== b.id) return false;
  const ka = Object.keys(a.fields ?? {}).sort().join(',');
  const kb = Object.keys(b.fields ?? {}).sort().join(',');
  return ka === kb;
}

/**
 * Compara o JSON de antes (`beforeRaw`, como foi lido) com `after` e registra a diferença em `after.history`.
 * Devolve true se registrou algo. Nunca lança: o histórico não pode impedir uma gravação.
 */
export function recordHistory(beforeRaw: string, after: HistoryHost): boolean {
  let before: HistoryHost;
  try {
    before = JSON.parse(beforeRaw) as HistoryHost;
  } catch {
    return false;
  }
  // Criar/duplicar/excluir um KANBAN inteiro fica fora do histórico (o kanban em si não é restaurável)
  const bIds = new Set((before.kanbans ?? []).map((k) => k.id));
  const aIds = new Set((after.kanbans ?? []).map((k) => k.id));
  const structural = bIds.size !== aIds.size || [...bIds].some((id) => !aIds.has(id));
  if (structural) {
    for (const id of bIds) if (!aIds.has(id) && after.history) delete after.history[id];
    return false;
  }

  const changes = diffData(before, after);
  if (changes.length === 0 || changes.length > MAX_CHANGES_PER_ENTRY) return false;
  const ctx: Ctx = { before, after };
  const key = bucketKeyFor(changes, ctx);
  const history = (after.history ??= {});
  const bucket = (history[key] ??= { entries: [], pointer: 0 });
  const now = Date.now();

  bucket.entries.length = Math.min(bucket.pointer, bucket.entries.length); // fazer algo novo descarta o "refazer"
  const last = bucket.entries[bucket.entries.length - 1];
  if (last && now - last.ts < MERGE_WINDOW_MS && canMerge(last, changes)) {
    const a = last.changes[0];
    const b = changes[0];
    for (const [k, f] of Object.entries(b.fields ?? {})) {
      if (a.fields && a.fields[k]) a.fields[k].to = f.to;
    }
    const backToStart = Object.values(a.fields ?? {}).every((f) => sameJson(f.from, f.to));
    if (backToStart) {
      bucket.entries.pop(); // voltou ao valor de antes: nada mudou
    } else {
      a.text = changeText(a, ctx);
      last.desc = summarize(last.changes);
      last.ts = now;
    }
    bucket.pointer = bucket.entries.length;
    return true;
  }

  bucket.entries.push({ id: `${now.toString(36)}${Math.random().toString(36).slice(2, 7)}`, ts: now, desc: summarize(changes), changes });
  while (bucket.entries.length > MAX_HISTORY_ENTRIES) bucket.entries.shift();
  bucket.pointer = bucket.entries.length;
  return true;
}

/* ------------------------------ desfazer / refazer ------------------------------ */

/** Aplica (ou reverte) uma entrada nos dados. Itens que já não existem (ou já existem) são simplesmente pulados. */
export function applyEntry(data: HistoryHost, entry: HistEntry, dir: 'undo' | 'redo'): void {
  const list = dir === 'undo' ? [...entry.changes].reverse() : entry.changes;
  for (const ch of list) {
    const rows = ((data[ch.coll] as Row[] | undefined) ?? (data[ch.coll] = [] as never)) as Row[];
    const idx = rows.findIndex((r) => r.id === ch.id);
    if (ch.op === 'update') {
      if (idx < 0 || !ch.fields) continue;
      for (const [k, f] of Object.entries(ch.fields)) {
        const val = dir === 'undo' ? f.from : f.to;
        if (val === undefined) delete rows[idx][k];
        else rows[idx][k] = clone(val);
      }
      continue;
    }
    const shouldExist = ch.op === 'add' ? dir === 'redo' : dir === 'undo';
    if (shouldExist) {
      const row = dir === 'redo' ? ch.after : ch.before;
      if (idx < 0 && row) rows.push(clone(row));
    } else if (idx >= 0) {
      rows.splice(idx, 1);
    }
  }
}
