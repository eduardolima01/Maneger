import { useEffect, useState } from 'react';
import {
  loadRecentActivityState,
  saveRecentActivityState,
  type RecentActivityEntry,
} from "./api/recentActivity"

const MAX_ENTRIES = 30;

let entries: RecentActivityEntry[] = [];
let initStarted = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function persist() {
  saveRecentActivityState({ entries }).catch(() => { });
}

export async function initRecentActivityFromDisk() {
  if (initStarted) return;
  initStarted = true;
  const state = await loadRecentActivityState();
  // se algo já foi registrado antes do disco responder (app abriu e o usuário já clicou em algo),
  // o estado em memória vence — não sobrescreve com dado potencialmente mais velho.
  if (entries.length === 0) {
    entries = state.entries ?? [];
    emit();
  }
}

function pushEntry(entry: RecentActivityEntry) {
  entries = [entry, ...entries].slice(0, MAX_ENTRIES);
  persist();
  emit();
}

export function recordProjectOpened(project: { id: string; name: string }) {
  pushEntry({
    type: 'project_opened',
    id: project.id,
    label: project.name,
    projectId: project.id,
    projectName: project.name,
    timestamp: new Date().toISOString(),
  });
}

export function recordKanbanOpened(kanban: { id: string; name: string; projectId?: string; projectName?: string }) {
  pushEntry({
    type: 'kanban_opened',
    id: kanban.id,
    label: kanban.name,
    projectId: kanban.projectId,
    projectName: kanban.projectName,
    timestamp: new Date().toISOString(),
  });
}

export function useRecentActivity(): { entries: RecentActivityEntry[] } {
  const [, setTick] = useState(0);
  useEffect(() => {
    initRecentActivityFromDisk();
    const listener = () => setTick((t) => t + 1);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);
  return { entries };
}

/** Projetos recentes: deduplicado por id (mantém só o acesso mais recente de cada um), mais recente primeiro. */
export function useRecentProjects(limit = 8): { id: string; name: string; timestamp: string }[] {
  const { entries: all } = useRecentActivity();
  const seen = new Set<string>();
  const result: { id: string; name: string; timestamp: string }[] = [];
  for (const e of all) {
    if (e.type !== 'project_opened' || seen.has(e.id)) continue;
    seen.add(e.id);
    result.push({ id: e.id, name: e.label, timestamp: e.timestamp });
    if (result.length >= limit) break;
  }
  return result;
}
