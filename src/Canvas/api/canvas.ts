import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { type CanvasData, defaultCanvasData } from '../types/canvas.types';

export async function loadCanvasData(scope: string | null = null): Promise<CanvasData> {
  const raw = await invoke<string>('load_canvas_data', { scope });
  try {
    const parsed = JSON.parse(raw);
    return { ...defaultCanvasData(), ...parsed };
  } catch {
    return defaultCanvasData();
  }
}

export async function saveCanvasData(data: CanvasData, scope: string | null = null): Promise<void> {
  await invoke('save_canvas_data', { scope, data: JSON.stringify(data, null, 2) });
}

/** Salva bytes crus (colar/soltar imagem) como um novo asset. Retorna o path ABSOLUTO pra usar em `src`. */
export async function saveCanvasAssetBytes(bytes: Uint8Array, extension: string, scope: string | null = null): Promise<string> {
  return invoke<string>('save_canvas_asset_bytes', { scope, bytes: Array.from(bytes), extension });
}

/** Abre o seletor de arquivos do SO e importa a imagem escolhida. Retorna o path ABSOLUTO, ou null se cancelar. */
export async function importCanvasAssetFromDialog(scope: string | null = null): Promise<string | null> {
  const selected = await open({
    multiple: false,
    filters: [{ name: 'Imagem', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }],
  });
  if (!selected || Array.isArray(selected)) return null;
  return invoke<string>('import_canvas_asset_from_path', { scope, sourcePath: selected });
}

/** `absolutePath` é exatamente o que veio salvo em element.src (já é o path completo, não relativo). */
export async function deleteCanvasAsset(absolutePath: string): Promise<void> {
  await invoke('delete_canvas_asset', { path: absolutePath });
}
