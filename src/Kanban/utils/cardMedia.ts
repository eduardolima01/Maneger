import { emit, listen } from '@tauri-apps/api/event';
import { saveCardImageBytes, saveCardFile, renameCardFile } from '@/Kanban/api/kanbanCardAssets';

/** Evento entre janelas (principal ↔ modo trabalho): os arquivos de mídia (áudio, transcrição, vídeo) do card mudaram. */
const CARD_MEDIA_CHANGED = 'card-media-changed';

export function notifyCardMediaChanged(cardId: string): void {
  void emit(CARD_MEDIA_CHANGED, cardId).catch(() => { });
}

/** Chama `cb` quando a mídia DESTE card mudar (em qualquer janela). Devolve a função de cancelar. */
export function onCardMediaChanged(cardId: string, cb: () => void): () => void {
  let un: (() => void) | null = null;
  let off = false;
  listen<string>(CARD_MEDIA_CHANGED, (e) => { if (e.payload === cardId) cb(); })
    .then((fn) => { if (off) fn(); else un = fn; })
    .catch(() => { });
  return () => { off = true; un?.(); };
}

/**
 * Grava bytes como arquivo do card com o nome exato `finalName`: salva (único comando de bytes que existe, cai em
 * canvas-assets/), MOVE pra card-files/{cardId}/ e renomeia. Devolve o path absoluto final.
 */
export async function saveBytesInCard(cardId: string, bytes: Uint8Array, ext: string, finalName: string): Promise<string> {
  const tmp = await saveCardImageBytes(bytes, ext);
  const moved = await saveCardFile(cardId, tmp);
  return renameCardFile(moved, finalName);
}

export function fmtDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
