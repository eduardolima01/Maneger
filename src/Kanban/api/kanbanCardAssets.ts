import { saveCanvasAssetBytes } from '@/Canvas/api/canvas';

/**
 * Reaproveita o mesmo comando Rust de assets do Canvas (bytes → path absoluto).
 * Ressalva: o arquivo acaba salvo em canvas-assets/, mesmo sendo capa de card —
 * não existe um comando Rust dedicado a assets de card ainda.
 */
export async function saveCardImageBytes(bytes: Uint8Array, ext: string): Promise<string> {
  return saveCanvasAssetBytes(bytes, ext, null);
}
