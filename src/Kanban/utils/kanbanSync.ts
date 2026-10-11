import { emit, listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';

/** Nome do evento que avisa as OUTRAS janelas de que o arquivo de dados do kanban mudou. */
export const KANBAN_DATA_CHANGED = 'kanban-data-changed';

function ownLabel(): string {
  try { return getCurrentWindow().label; } catch { return 'unknown'; }
}

/** Avisa as outras janelas (quadro principal ↔ modo trabalho) que houve uma gravação. Nunca lança. */
export function broadcastKanbanChange(): void {
  try {
    void emit(KANBAN_DATA_CHANGED, { source: ownLabel() }).catch(() => { });
  } catch {
    /* fora do Tauri (ex.: navegador de teste): sem outras janelas pra avisar */
  }
}

/**
 * Chama `onChange` quando OUTRA janela gravar os dados (as gravações desta própria janela são ignoradas, pra não recarregar
 * à toa). Várias gravações seguidas viram uma chamada só. Devolve a função de cancelar.
 */
export function listenKanbanChanges(onChange: () => void, delayMs = 200): () => void {
  let unlisten: (() => void) | null = null;
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const me = ownLabel();
  listen<{ source?: string }>(KANBAN_DATA_CHANGED, (e) => {
    if (e.payload?.source === me) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(onChange, delayMs);
  }).then((fn) => {
    if (cancelled) fn(); else unlisten = fn;
  }).catch(() => { });
  return () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
    unlisten?.();
  };
}
