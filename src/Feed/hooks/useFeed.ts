import { useCallback, useEffect, useState } from 'react';
import { generateId } from '@/lib/utils/uuid';
import { loadFeedData, saveFeedData, deleteMomentAsset } from '../api/feed';
import type { Moment, CreateMomentInput, UpdateMomentInput } from '../types/feed.types';

export interface MomentGroup {
  label: string; // "Hoje", "Ontem", "10 de Agosto"
  moments: Moment[];
}

function dayLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const isSameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

  if (isSameDay(date, today)) return 'Hoje';
  if (isSameDay(date, yesterday)) return 'Ontem';
  return date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });
}

export function useFeed() {
  const [moments, setMoments] = useState<Moment[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const data = await loadFeedData();
    setMoments(data.moments);
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const persist = useCallback((next: Moment[]) => {
    setMoments(next);
    saveFeedData({ version: 1, moments: next }).catch(() => {});
  }, []);

  const create = useCallback((input: CreateMomentInput) => {
    const now = new Date().toISOString();
    const moment: Moment = {
      id: generateId(),
      content: input.content,
      occurredAt: input.occurredAt,
      createdAt: now,
      updatedAt: now,
      projectId: input.projectId ?? null,
      tags: input.tags,
      attachments: input.attachments,
    };
    setMoments((prev) => {
      const next = [moment, ...prev];
      saveFeedData({ version: 1, moments: next }).catch(() => {});
      return next;
    });
    return moment;
  }, []);

  const update = useCallback((id: string, input: UpdateMomentInput) => {
    setMoments((prev) => {
      const next = prev.map((m) => (m.id === id ? { ...m, ...input, updatedAt: new Date().toISOString() } : m));
      saveFeedData({ version: 1, moments: next }).catch(() => {});
      return next;
    });
  }, []);

  const remove = useCallback((id: string) => {
    setMoments((prev) => {
      const target = prev.find((m) => m.id === id);
      target?.attachments.forEach((a) => { deleteMomentAsset(a.path).catch(() => {}); });
      const next = prev.filter((m) => m.id !== id);
      saveFeedData({ version: 1, moments: next }).catch(() => {});
      return next;
    });
  }, []);

  const duplicate = useCallback((id: string) => {
    setMoments((prev) => {
      const original = prev.find((m) => m.id === id);
      if (!original) return prev;
      const now = new Date().toISOString();
      const copy: Moment = { ...original, id: generateId(), createdAt: now, updatedAt: now };
      const next = [copy, ...prev];
      saveFeedData({ version: 1, moments: next }).catch(() => {});
      return next;
    });
  }, []);

  // ordenado por occurredAt (não createdAt) — decisão explícita do spec
  const sorted = [...moments].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));

  const groups: MomentGroup[] = [];
  for (const m of sorted) {
    const label = dayLabel(m.occurredAt);
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.label === label) lastGroup.moments.push(m);
    else groups.push({ label, moments: [m] });
  }

  return { moments: sorted, groups, loading, reload, create, update, remove, duplicate, persist };
}
