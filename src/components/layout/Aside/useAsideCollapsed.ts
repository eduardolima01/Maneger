import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'maneger:asideCollapsed';

function readInitial(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

type Listener = (value: boolean) => void;
let currentValue = readInitial();
const listeners = new Set<Listener>();

function setGlobalValue(value: boolean) {
  currentValue = value;
  try {
    sessionStorage.setItem(STORAGE_KEY, value ? '1' : '0');
  } catch {
    // sessionStorage indisponível — estado ainda funciona em memória nesta sessão de execução
  }
  listeners.forEach((l) => l(value));
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
