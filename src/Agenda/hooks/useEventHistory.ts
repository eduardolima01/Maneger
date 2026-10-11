import { useRef } from 'react';
import type { Event } from '@/types/event.types';
import { getEventsByRange } from '@/lib/api/events';
import { fromLocalISO, toLocalISO } from '@/lib/utils/date';
import { createEventDetail, getEventDetails } from '../api/eventDetails';

export interface EventData {
  title: string;
  project_id: string | null;
  start_at: string;
  end_at: string;
}

export interface DetailSnapshot {
  start_offset: number;
  end_offset: number;
  content: string;
}

interface Command {
  label: string;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  /** Alterações seguidas do mesmo evento (tecla repetida, ajustes rápidos) viram uma só entrada. */
  group?: {
    key: string;
    at: number;
    merge: (patch: Record<string, unknown>, before: Event | undefined) => void;
  };
}

interface Options {
  events: Event[];
  create: (data: EventData) => Promise<unknown>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  update: (id: string, patch: any) => Promise<unknown>;
  remove: (id: string) => Promise<unknown>;
  onNotify?: (message: string) => void;
}

const MAX_HISTORY = 200;
const GROUP_MS = 800;
const DAY_MS = 24 * 60 * 60 * 1000;

const sameInstant = (a: string, b: string) => fromLocalISO(a).getTime() === fromLocalISO(b).getTime();

function patchLabel(patch: Record<string, unknown>): string {
  const keys = Object.keys(patch);
  const onlyTime = keys.every((k) => k === 'start_at' || k === 'end_at');
  if (onlyTime) return 'alterar horário';
  if (keys.length === 1 && keys[0] === 'project_id') return 'alterar projeto';
  if (keys.length === 1 && keys[0] === 'title') return 'renomear';
  return 'editar evento';
}

/**
 * Histórico de alterações dos eventos da Agenda, com desfazer/refazer.
 * Devolve versões "rastreadas" de create/update/remove (mesma forma das originais): é só usá-las no lugar.
 * O histórico vale enquanto o app está aberto. Desfazer/refazer usam as funções originais (não se gravam no histórico).
 */
export function useEventHistory({ events, create, update, remove, onNotify }: Options) {
  const eventsRef = useRef(events);
  eventsRef.current = events;
  const ops = useRef({ create, update, remove, onNotify });
  ops.current = { create, update, remove, onNotify };

  const past = useRef<Command[]>([]);
  const future = useRef<Command[]>([]);
  const busy = useRef(false);

  const findEvent = (id: string) => eventsRef.current.find((e) => e.id === id);

  function record(cmd: Command) {
    past.current.push(cmd);
    if (past.current.length > MAX_HISTORY) past.current.shift();
    future.current = [];
  }

  /** Cria o evento e descobre o id dele (do retorno do create, ou comparando com o que já existia no intervalo). */
  async function createWithId(data: EventData): Promise<string | null> {
    const lo = toLocalISO(new Date(fromLocalISO(data.start_at).getTime() - DAY_MS));
    const hi = toLocalISO(new Date(fromLocalISO(data.end_at).getTime() + DAY_MS));
    const known = new Set((await getEventsByRange(lo, hi)).map((e) => e.id));
    const created: unknown = await ops.current.create(data);
    const direct = typeof created === 'string' ? created : (created as { id?: string } | null | undefined)?.id;
    if (direct) return direct;
    const after = await getEventsByRange(lo, hi);
    return (
      after.find(
        (e) =>
          !known.has(e.id) &&
          e.title === data.title &&
          e.project_id === data.project_id &&
          sameInstant(e.start_at, data.start_at) &&
          sameInstant(e.end_at, data.end_at),
      )?.id ?? null
    );
  }

  async function recreate(data: EventData, details: DetailSnapshot[]): Promise<string> {
    const id = await createWithId(data);
    if (!id) throw new Error('Não foi possível recriar o evento.');
    for (const d of details) await createEventDetail(id, d);
    return id;
  }

  async function snapshotDetails(ev: Event): Promise<DetailSnapshot[]> {
    try {
      const details = await getEventDetails(ev.id);
      const duration = Math.max(0, Math.round((fromLocalISO(ev.end_at).getTime() - fromLocalISO(ev.start_at).getTime()) / 60000));
      return [...details]
        .sort((a, b) => a.position - b.position)
        .map((d) => ({ start_offset: d.start_offset ?? 0, end_offset: d.end_offset ?? duration, content: d.content }));
    } catch (err) {
      console.error('[histórico] falha ao ler o detalhamento', err);
      return [];
    }
  }

  const dataOf = (ev: Event): EventData => ({
    title: ev.title,
    project_id: ev.project_id,
    start_at: ev.start_at,
    end_at: ev.end_at,
  });

  // ---------- versões rastreadas ----------

  async function createTracked(
    data: EventData,
    opts?: { label?: string; details?: DetailSnapshot[] },
  ): Promise<string | null> {
    const details = opts?.details ?? [];
    const id = await createWithId(data);
    if (!id) {
      console.warn('[histórico] create() não devolveu o id e o evento não foi achado: criação fora do histórico.');
      return null;
    }
    for (const d of details) await createEventDetail(id, d);

    let currentId = id;
    record({
      label: `${opts?.label ?? 'criar evento'} “${data.title}”`,
      undo: async () => { await ops.current.remove(currentId); },
      redo: async () => { currentId = await recreate(data, details); },
    });
    return id;
  }

  async function updateTracked(id: string, patch: Record<string, unknown>): Promise<void> {
    const before = findEvent(id);
    await ops.current.update(id, patch);
    if (!before) return;

    const changed = Object.keys(patch).filter((k) => {
      const prev = (before as unknown as Record<string, unknown>)[k];
      return prev !== patch[k];
    });
    if (changed.length === 0) return;

    const now = Date.now();
    const last = past.current[past.current.length - 1];
    const key = `update:${id}`;
    if (last?.group?.key === key && now - last.group.at < GROUP_MS) {
      last.group.merge(patch, before);
      last.group.at = now;
      future.current = [];
      return;
    }

    const prevValues: Record<string, unknown> = {};
    for (const k of Object.keys(patch)) prevValues[k] = (before as unknown as Record<string, unknown>)[k];
    let nextValues: Record<string, unknown> = { ...patch };

    record({
      label: `${patchLabel(patch)} “${before.title}”`,
      undo: async () => { await ops.current.update(id, prevValues); },
      redo: async () => { await ops.current.update(id, nextValues); },
      group: {
        key,
        at: now,
        merge: (p, b) => {
          for (const k of Object.keys(p)) {
            if (!(k in prevValues)) prevValues[k] = b ? (b as unknown as Record<string, unknown>)[k] : undefined;
          }
          nextValues = { ...nextValues, ...p };
        },
      },
    });
  }

  async function removeTracked(id: string): Promise<void> {
    const ev = findEvent(id);
    const details = ev ? await snapshotDetails(ev) : [];
    await ops.current.remove(id);
    if (!ev) return;

    const data = dataOf(ev);
    let currentId = id;
    record({
      label: `excluir “${ev.title}”`,
      undo: async () => { currentId = await recreate(data, details); },
      redo: async () => { await ops.current.remove(currentId); },
    });
  }

  // ---------- desfazer / refazer ----------

  async function run(from: Command[], to: Command[], direction: 'undo' | 'redo') {
    if (busy.current) return;
    const cmd = from.pop();
    if (!cmd) {
      ops.current.onNotify?.(direction === 'undo' ? 'Nada para desfazer' : 'Nada para refazer');
      return;
    }
    busy.current = true;
    try {
      await cmd[direction]();
      to.push(cmd);
      ops.current.onNotify?.(`${direction === 'undo' ? 'Desfeito' : 'Refeito'}: ${cmd.label}`);
    } catch (err) {
      console.error(`[histórico] falha ao ${direction === 'undo' ? 'desfazer' : 'refazer'}`, err);
      from.push(cmd);
      ops.current.onNotify?.(`Não foi possível ${direction === 'undo' ? 'desfazer' : 'refazer'}`);
    } finally {
      busy.current = false;
    }
  }

  return {
    create: createTracked,
    update: updateTracked,
    remove: removeTracked,
    snapshotDetails,
    undo: () => run(past.current, future.current, 'undo'),
    redo: () => run(future.current, past.current, 'redo'),
  };
}
