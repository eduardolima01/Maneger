import { invoke } from '@tauri-apps/api/core';
import { getDb } from '@/lib/db/client';
import { generateId } from '@/lib/utils/uuid';
import { fromLocalISO } from '@/lib/utils/date';
import type { Event, EventDetail } from '@/types/event.types';

/**
 * Persistência da Agenda em JSON (`agenda-events.json`, na mesma pasta dos
 * outros JSONs do app). O arquivo inteiro é carregado uma vez e mantido em
 * memória; cada mutação altera o store e regrava o arquivo.
 *
 * Regra de ouro pros chamadores: nunca mutar um objeto de evento/detalhe que
 * já foi entregue (o React pode estar segurando a referência) — substitua o
 * item no array por uma cópia nova.
 */
export interface AgendaStore {
  version: 1;
  events: Event[];
  details: EventDetail[];
}

let storePromise: Promise<AgendaStore> | null = null;
let writeChain: Promise<void> = Promise.resolve();

/** Mesmo formato que o `datetime('now')` do SQLite usava em created_at. */
export function nowSql(): string {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

export function getAgendaStore(): Promise<AgendaStore> {
  if (!storePromise) {
    storePromise = loadStore().catch((err) => {
      storePromise = null; // permite tentar de novo depois de um erro
      throw err;
    });
  }
  return storePromise;
}

/**
 * Grava o store. As gravações são enfileiradas na ordem em que foram pedidas
 * (o snapshot é tirado na hora da chamada), então a última sempre vence.
 */
export function saveAgendaStore(store: AgendaStore): Promise<void> {
  const snapshot = JSON.stringify(store, null, 2);
  const run = writeChain.then(() => invoke<void>('save_agenda_events_data', { data: snapshot }));
  writeChain = run.catch(() => undefined);
  return run;
}

async function loadStore(): Promise<AgendaStore> {
  const raw = await invoke<string>('load_agenda_events_data');

  let parsed: Partial<AgendaStore>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Não cai pro SQLite aqui: isso sobrescreveria um arquivo que talvez
    // ainda seja recuperável à mão.
    throw new Error('agenda-events.json está ilegível (JSON inválido). Corrija ou renomeie o arquivo e reabra o app.');
  }

  let store: AgendaStore;
  let changed = false;

  if (parsed && Object.keys(parsed).length === 0) {
    // Arquivo ainda não existe (o Rust devolve "{}") → primeira execução: importa do SQLite.
    store = await importFromSqlite();
    changed = true;
  } else if (parsed && parsed.version === 1 && Array.isArray(parsed.events) && Array.isArray(parsed.details)) {
    store = { version: 1, events: parsed.events, details: parsed.details };
  } else {
    throw new Error('agenda-events.json tem um formato desconhecido (esperado version 1).');
  }

  if (assignMissingOffsets(store)) changed = true;
  if (await detachMissingProjects(store)) changed = true;
  if (changed) await saveAgendaStore(store);
  return store;
}

/**
 * Importação única. Só LÊ do SQLite — as tabelas `events`/`event_details`
 * continuam intactas no app.db, servindo de backup.
 */
async function importFromSqlite(): Promise<AgendaStore> {
  const db = await getDb();

  let eventRows: Event[] = [];
  try {
    eventRows = await db.select<Event[]>('SELECT * FROM events ORDER BY start_at ASC');
  } catch (err) {
    console.warn('Agenda: não consegui ler a tabela events do SQLite — começando vazio.', err);
  }

  let detailRows: EventDetail[] = [];
  try {
    detailRows = await db.select<EventDetail[]>('SELECT * FROM event_details');
  } catch {
    // Tabela ainda não existe (migration 3 nunca rodou) — normal.
  }

  const events: Event[] = eventRows.map((r) => ({
    id: r.id,
    project_id: r.project_id ?? null,
    title: r.title,
    description: r.description ?? null,
    start_at: r.start_at,
    end_at: r.end_at,
  }));

  const eventIds = new Set(events.map((e) => e.id));
  const details: EventDetail[] = detailRows
    .filter((d) => eventIds.has(d.event_id))
    .map((d) => ({
      id: d.id,
      event_id: d.event_id,
      content: d.content ?? '',
      time_label: d.time_label ?? null,
      start_offset: d.start_offset ?? null,
      end_offset: d.end_offset ?? null,
      position: d.position ?? 0,
      created_at: d.created_at ?? nowSql(),
    }));

  // Descrição antiga em texto livre vira o primeiro sub-card, se o evento
  // ainda não tiver nenhum (a coluna `description` não é mais usada na UI).
  const withDetails = new Set(details.map((d) => d.event_id));
  for (const e of events) {
    if (!withDetails.has(e.id) && e.description && e.description.trim() !== '') {
      details.push({
        id: generateId(),
        event_id: e.id,
        content: e.description,
        time_label: null,
        start_offset: null,
        end_offset: null,
        position: 0,
        created_at: nowSql(),
      });
    }
  }

  return { version: 1, events, details };
}

/**
 * Substitui o `ON DELETE SET NULL` que a foreign key do SQLite fazia: evento
 * cujo projeto foi apagado fica sem projeto, em vez de apontar pra um id
 * que não existe mais. Roda ao carregar o store (não a cada exclusão de
 * projeto). Devolve true se alterou algo.
 */
async function detachMissingProjects(store: AgendaStore): Promise<boolean> {
  let projectIds: Set<string>;
  try {
    const db = await getDb();
    const rows = await db.select<{ id: string }[]>('SELECT id FROM projects');
    projectIds = new Set(rows.map((r) => r.id));
  } catch (err) {
    console.warn('Agenda: não consegui conferir os projetos existentes — mantendo project_id como está.', err);
    return false;
  }

  let changed = false;
  store.events = store.events.map((e) => {
    if (e.project_id && !projectIds.has(e.project_id)) {
      changed = true;
      return { ...e, project_id: null };
    }
    return e;
  });
  return changed;
}

/** Duração do evento em minutos (0 se o fim não for depois do início). */
export function eventDurationMin(e: Pick<Event, 'start_at' | 'end_at'>): number {
  const ms = fromLocalISO(e.end_at).getTime() - fromLocalISO(e.start_at).getTime();
  return Math.max(0, Math.round(ms / 60000));
}

/**
 * Detalhes antigos (texto livre, sem horário) são distribuídos em fatias
 * iguais ao longo do evento, na ordem em que estavam. O "horário" em texto
 * livre da versão anterior, se existir, é preservado no começo do conteúdo.
 * Idempotente: só toca em detalhes sem start_offset/end_offset.
 */
function assignMissingOffsets(store: AgendaStore): boolean {
  const eventsById = new Map(store.events.map((e) => [e.id, e]));
  const pending = new Map<string, EventDetail[]>();
  for (const d of store.details) {
    if (d.start_offset == null || d.end_offset == null) {
      const list = pending.get(d.event_id) ?? [];
      list.push(d);
      pending.set(d.event_id, list);
    }
  }
  if (pending.size === 0) return false;

  const fixed = new Map<string, EventDetail>();
  for (const [eventId, list] of pending) {
    const ev = eventsById.get(eventId);
    if (!ev) continue;
    const dur = eventDurationMin(ev);
    if (dur <= 0) continue;

    list.sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at));
    const n = list.length;
    list.forEach((d, i) => {
      const s = Math.floor((i * dur) / n);
      const e = Math.max(s + 1, Math.floor(((i + 1) * dur) / n));
      const label = d.time_label?.trim();
      fixed.set(d.id, {
        ...d,
        content: label ? `${label} — ${d.content}` : d.content,
        time_label: null,
        start_offset: Math.min(s, dur - 1),
        end_offset: Math.min(e, dur),
      });
    });
  }
  if (fixed.size === 0) return false;
  store.details = store.details.map((d) => fixed.get(d.id) ?? d);
  return true;
}

/**
 * Chamada quando um evento muda de horário, pra manter os detalhes coerentes:
 * - mesma duração (evento só foi movido): nada a fazer, os offsets acompanham;
 * - início mudou e o fim ficou parado (redimensionar pela borda de cima):
 *   desloca os offsets pra cada detalhe continuar no mesmo horário real;
 * - em qualquer mudança de duração, recorta os detalhes pra caberem no evento
 *   (detalhes que ficaram totalmente fora viram uma faixa de 1 min na borda).
 */
export function reanchorDetails(store: AgendaStore, oldEv: Event, newEv: Event): void {
  const oldDur = eventDurationMin(oldEv);
  const newDur = eventDurationMin(newEv);
  if (oldDur === newDur || newDur <= 0) return;

  const startDelta = Math.round((fromLocalISO(newEv.start_at).getTime() - fromLocalISO(oldEv.start_at).getTime()) / 60000);
  const shift = startDelta !== 0 && newEv.end_at === oldEv.end_at ? -startDelta : 0;

  store.details = store.details.map((d) => {
    if (d.event_id !== newEv.id || d.start_offset == null || d.end_offset == null) return d;
    const s = Math.min(Math.max(Math.round(d.start_offset + shift), 0), newDur - 1);
    const e = Math.min(Math.max(Math.round(d.end_offset + shift), s + 1), newDur);
    return s === d.start_offset && e === d.end_offset ? d : { ...d, start_offset: s, end_offset: e };
  });
}
