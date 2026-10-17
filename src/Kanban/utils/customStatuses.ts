import { useEffect, useState } from 'react';
import { STATUS_LABELS, STATUS_COLORS, type CustomStatus } from '@/types/kanban.types';

/**
 * Estados (status) dos cards: os 5 de fábrica + os que o usuário cria (guardados em viewPrefs.customStatuses do kanban).
 * Os rótulos/cores dos personalizados são injetados em STATUS_LABELS / STATUS_COLORS, então todo lugar que já fazia
 * STATUS_LABELS[card.status] passa a funcionar com eles sem mudar.
 */
export const BUILTIN_STATUS_IDS = ['pendente', 'fazer', 'fazendo', 'revisao', 'feito'] as const;

/** Letra de atalho (menus de estado) de cada estado de fábrica. W/A/S/D navegam e X = sem estado, então ficam de fora. */
const BUILTIN_KEYS: Record<string, string> = { pendente: 'p', fazer: 'z', fazendo: 'n', revisao: 'r', feito: 'f' };
const RESERVED_KEYS = new Set(['w', 'a', 's', 'd', 'x']);
const PALETTE = ['#e91e63', '#00897b', '#6d4c41', '#3949ab', '#c0ca33', '#00acc1', '#d81b60', '#5e35b1'];

let custom: CustomStatus[] = [];
let persister: ((list: CustomStatus[]) => void) | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());

function apply(list: CustomStatus[]) {
  for (const c of custom) { delete STATUS_LABELS[c.id]; delete STATUS_COLORS[c.id]; }
  custom = list.slice();
  for (const c of custom) { STATUS_LABELS[c.id] = c.label; STATUS_COLORS[c.id] = c.color; }
}

/** Chamado pelo hook do quadro a cada render (barato: só age se a lista mudou). Não avisa ninguém — quem renderiza já está atualizado. */
export function registerCustomStatuses(list: CustomStatus[] | undefined): void {
  const next = list ?? [];
  if (JSON.stringify(next) === JSON.stringify(custom)) return;
  apply(next);
}

/** O quadro diz como gravar a lista (viewPrefs.customStatuses). */
export function setStatusPersister(fn: ((list: CustomStatus[]) => void) | null): void { persister = fn; }

export function listCustomStatuses(): CustomStatus[] { return custom; }

/** Todos os estados, na ordem de exibição: fábrica primeiro, depois os criados. */
export function statusIds(): string[] { return [...BUILTIN_STATUS_IDS, ...custom.map((c) => c.id)]; }

export function isBuiltinStatus(id: string): boolean { return (BUILTIN_STATUS_IDS as readonly string[]).includes(id); }

/** Letra de atalho do estado (minúscula), ou '' se não tem. */
export function statusKeyOf(id: string | null): string {
  if (id === null) return 'x';
  return BUILTIN_KEYS[id] ?? custom.find((c) => c.id === id)?.key ?? '';
}

/** letra -> estado (x -> null = sem estado). */
export function statusKeyMap(): Record<string, string | null> {
  const map: Record<string, string | null> = { x: null };
  for (const id of statusIds()) { const k = statusKeyOf(id); if (k) map[k] = id; }
  return map;
}

function pickKey(label: string): string {
  const used = new Set<string>([...Object.values(BUILTIN_KEYS), ...custom.map((c) => c.key ?? ''), ...RESERVED_KEYS]);
  for (const ch of label.toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '')) if (!used.has(ch)) return ch;
  for (const ch of 'bcefghijklmoqtuvy0123456789') if (!used.has(ch)) return ch;
  return '';
}

function commit(next: CustomStatus[]) {
  apply(next);
  persister?.(next);
  notify();
}

/** Cria um estado novo e devolve o id (ou null se o nome é vazio/repetido). */
export function addCustomStatus(label: string, color?: string): string | null {
  const name = label.trim();
  if (!name) return null;
  const dup = statusIds().find((id) => (STATUS_LABELS[id] ?? '').toLowerCase() === name.toLowerCase());
  if (dup) return dup; // já existe: só reaproveita
  const id = `custom-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  commit([...custom, { id, label: name, color: color ?? PALETTE[custom.length % PALETTE.length], key: pickKey(name) }]);
  return id;
}

export function updateCustomStatus(id: string, patch: { label?: string; color?: string }): void {
  commit(custom.map((c) => (c.id === id ? { ...c, ...patch, label: (patch.label ?? c.label).trim() || c.label } : c)));
}

export function removeCustomStatus(id: string): void {
  commit(custom.filter((c) => c.id !== id));
}

/** Faz o componente re-renderizar quando a lista de estados muda (criar/editar/apagar). */
export function useStatusRegistryTick(): void {
  const [, set] = useState(0);
  useEffect(() => {
    const fn = () => set((n) => n + 1);
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  }, []);
}
