import { useSyncExternalStore } from 'react';

/**
 * "Área de transferência" interna do Ctrl+X dos cards: guarda os ids recortados até colar (Ctrl+V sobre um grupo/coluna)
 * ou cancelar (Esc). Fica fora do React pra valer em qualquer visão (quadro/árvore) e pra marcar os cards recortados.
 */
let cutIds: string[] = [];
let cutSet: ReadonlySet<string> = new Set();
const listeners = new Set<() => void>();

export function getCutCardIds(): string[] { return cutIds; }

export function setCutCardIds(ids: string[]): void {
  cutIds = ids;
  cutSet = new Set(ids);
  listeners.forEach((l) => l());
}

export function clearCutCards(): void {
  if (cutIds.length > 0) setCutCardIds([]);
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

/** true se este card está recortado (esperando colar) — o card aparece esmaecido. */
export function useIsCardCut(cardId: string): boolean {
  return useSyncExternalStore(subscribe, () => cutSet.has(cardId));
}
