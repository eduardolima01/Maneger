import type { RecentEntry, SearchCategory } from '../types/search.types';

const STORAGE_KEY = 'maneger:searchRecents';
const MAX_ENTRIES = 20;
const MAX_QUERIES = 10;

function read(): { entries: RecentEntry[]; queries: string[] } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { entries: [], queries: [] };
  } catch {
    return { entries: [], queries: [] };
  }
}

function write(data: { entries: RecentEntry[]; queries: string[] }): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // indisponível — histórico não persiste nessa sessão, sem impacto funcional
  }
}

export function recordAccess(entry: Omit<RecentEntry, 'accessCount' | 'lastAccessedAt'>): void {
  const data = read();
  const existing = data.entries.find((e) => e.id === entry.id && e.category === entry.category);
  const now = new Date().toISOString();

  if (existing) {
    existing.accessCount += 1;
    existing.lastAccessedAt = now;
  } else {
    data.entries.unshift({ ...entry, accessCount: 1, lastAccessedAt: now });
  }

  data.entries.sort((a, b) => b.accessCount - a.accessCount || b.lastAccessedAt.localeCompare(a.lastAccessedAt));
  data.entries = data.entries.slice(0, MAX_ENTRIES);
  write(data);
}

export function recordQuery(query: string): void {
  if (!query.trim()) return;
  const data = read();
  data.queries = [query, ...data.queries.filter((q) => q !== query)].slice(0, MAX_QUERIES);
  write(data);
}

export function getRecentEntries(): RecentEntry[] {
  return read().entries;
}

export function getRecentQueries(): string[] {
  return read().queries;
}

export function getAccessFrequency(id: string, category: SearchCategory): number {
  return read().entries.find((e) => e.id === id && e.category === category)?.accessCount ?? 0;
}

