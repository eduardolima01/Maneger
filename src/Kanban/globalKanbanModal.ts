import { useEffect, useState } from 'react';
import type { Kanban } from '@/types/kanban.types';

type Listener = () => void;

let currentKanban: Kanban | null = null;
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function openGlobalKanbanModal(kanban: Kanban) {
  currentKanban = kanban;
  emit();
}

export function closeGlobalKanbanModal() {
  currentKanban = null;
  emit();
}

export function useGlobalKanbanModal(): Kanban | null {
  const [kanban, setKanban] = useState<Kanban | null>(currentKanban);

  useEffect(() => {
    const listener = () => setKanban(currentKanban);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return kanban;
}
