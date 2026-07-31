import { useState, useEffect, useCallback } from 'react';

type Listener = (open: boolean) => void;
let currentOpen = false;
const listeners = new Set<Listener>();
let previousActiveElement: HTMLElement | null = null;
let openToken = 0;

function setGlobalOpen(value: boolean) {
  if (value === currentOpen) return;
  currentOpen = value;
  if (value) {
    previousActiveElement = document.activeElement as HTMLElement | null;
    openToken++;
  }
  listeners.forEach((l) => l(value));
}

export function restoreFocusAfterClose() {
  previousActiveElement?.focus?.();
  previousActiveElement = null;
}

export function useChatWidgetState() {
  const [open, setOpen] = useState(currentOpen);

  useEffect(() => {
    const listener: Listener = (value) => setOpen(value);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);

  const openChat = useCallback(() => setGlobalOpen(true), []);
  const closeChat = useCallback(() => {
    setGlobalOpen(false);
    restoreFocusAfterClose();
  }, []);
  const toggleChat = useCallback(() => setGlobalOpen(!currentOpen), []);

  return { open, openChat, closeChat, toggleChat, openToken };
}
