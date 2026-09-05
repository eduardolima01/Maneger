import { loadPageVisibility, savePageVisibility } from '@/lib/api/pageVisibilityState';
import { useEffect, useState } from 'react';

type Listener = () => void;

let disabledRoutes: Set<string> = new Set();
let initStarted = false;
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((l) => l());
}

function persist() {
  savePageVisibility({ disabledRoutes: Array.from(disabledRoutes) }).catch(() => { });
}

export async function initPageVisibilityFromDisk() {
  if (initStarted) return;
  initStarted = true;
  const state = await loadPageVisibility();
  disabledRoutes = new Set(state.disabledRoutes);
  emit();
}

export function setPageDisabled(to: string, disabled: boolean) {
  if (to === '/') return; // Dashboard nunca pode ser desabilitado — é a rota raiz
  if (disabled) disabledRoutes.add(to);
  else disabledRoutes.delete(to);
  persist();
  emit();
}

export function usePageVisibility(): { disabledRoutes: Set<string> } {
  const [, setTick] = useState(0);
  useEffect(() => {
    const listener = () => setTick((t) => t + 1);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);
  return { disabledRoutes };
}
