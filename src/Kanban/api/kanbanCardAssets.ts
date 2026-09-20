import { invoke } from '@tauri-apps/api/core';
import { saveCanvasAssetBytes } from '@/Canvas/api/canvas';

/**
 * Reaproveita o mesmo comando Rust de assets do Canvas (bytes → path absoluto).
 * Ressalva: o arquivo acaba salvo em canvas-assets/, mesmo sendo capa de card —
 * não existe um comando Rust dedicado a assets de card ainda.
 */
export async function saveCardImageBytes(bytes: Uint8Array, ext: string): Promise<string> {
  return saveCanvasAssetBytes(bytes, ext, null);
}

export interface CardFileInfo {
  name: string;
  path: string;
  size: number;
}

/**
 * MOVE (não copy) um arquivo do disco pra dentro de `card-files/{cardId}/` (pasta criada
 * agora, na hora, nunca antes) — o arquivo some do local de origem. `sourcePath` vem do
 * diálogo nativo de escolha de arquivo ou de um drag-and-drop. Retorna o path absoluto
 * de destino.
 */
export async function saveCardFile(cardId: string, sourcePath: string): Promise<string> {
  return invoke<string>('save_card_file', { cardId, sourcePath });
}

/** Lista os arquivos do card — vazio se a pasta nunca foi criada (card sem nenhum arquivo). */
export async function listCardFiles(cardId: string): Promise<CardFileInfo[]> {
  return invoke<CardFileInfo[]>('list_card_files', { cardId });
}

/** Remove um arquivo específico do card, sem apagar os outros. */
export async function deleteCardFile(cardId: string, fileName: string): Promise<void> {
  await invoke('delete_card_file', { cardId, fileName });
}

/** Apaga a pasta de arquivos do card inteira — chamado no cascade de `deleteCard`. */
export async function deleteCardFilesDir(cardId: string): Promise<void> {
  await invoke('delete_card_files_dir', { cardId });
}

/** Path absoluto de `card-files/{cardId}/` — cria a pasta agora se ainda não existir. */
export async function getCardFilesDir(cardId: string): Promise<string> {
  return invoke<string>('get_card_files_dir', { cardId });
}

/** Ids de TODOS os cards (de qualquer kanban) que têm pelo menos um arquivo — uma varredura só. */
export async function listCardIdsWithFiles(): Promise<string[]> {
  return invoke<string[]>('list_card_ids_with_files');
}
