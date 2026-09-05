import { useCallback, useEffect, useState } from 'react';
import { loadAsideCollapsed, saveAsideCollapsed } from './asideCollapsed';

type Listener = (value: boolean) => void;

let currentValue = true; // recolhido por padrão — vale até o JSON carregar (ou se nunca foi salvo)
let initStarted = false;
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((l) => l(currentValue));
}

function persist() {
  saveAsideCollapsed({ collapsed: currentValue }).catch(() => { });
}

export async function initAsideCollapsedFromDisk() {
  if (initStarted) return;
  initStarted = true;
  const state = await loadAsideCollapsed();
  if (state) {
    currentValue = state.collapsed;
    emit();
  }
}

function setGlobalValue(value: boolean) {
  currentValue = value;
  persist();
  emit();
}

export function useAsideCollapsed() {
  const [collapsed, setCollapsed] = useState(currentValue);

  useEffect(() => {
    const listener: Listener = (value) => setCollapsed(value);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);

  const toggle = useCallback(() => setGlobalValue(!currentValue), []);
  const setCollapsedValue = useCallback((value: boolean) => setGlobalValue(value), []);

  return { collapsed, toggle, setCollapsed: setCollapsedValue };
}
