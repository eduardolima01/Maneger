import { useCallback } from 'react';
import { saveCanvasAssetBytes, importCanvasAssetFromDialog } from '../api/canvas';

interface UseCanvasClipboardParams {
  scope: string | null;
  /** Posição no MUNDO (já convertida do viewport) onde o novo elemento deve nascer. */
  getDropPosition: () => { x: number; y: number };
  onAddText: (x: number, y: number, content: string) => void;
  onAddImage: (x: number, y: number, src: string) => void;
}

function extensionFromMime(mime: string): string {
  const map: Record<string, string> = {
    'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg',
    'image/webp': 'webp', 'image/gif': 'gif',
  };
  return map[mime] ?? 'png';
}

export function useCanvasClipboard({ scope, getDropPosition, onAddText, onAddImage }: UseCanvasClipboardParams) {
  const handlePaste = useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const blob = item.getAsFile();
        if (!blob) continue;
        const ext = extensionFromMime(item.type);
        blob.arrayBuffer().then((buf) => {
          const { x, y } = getDropPosition();
          saveCanvasAssetBytes(new Uint8Array(buf), ext, scope).then((src) => onAddImage(x, y, src));
        });
        return;
      }
    }

    const text = e.clipboardData?.getData('text/plain');
    if (text && text.trim()) {
      e.preventDefault();
      const { x, y } = getDropPosition();
      onAddText(x, y, text);
    }
  }, [scope, getDropPosition, onAddText, onAddImage]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const ext = extensionFromMime(file.type);
    file.arrayBuffer().then((buf) => {
      const { x, y } = getDropPosition();
      saveCanvasAssetBytes(new Uint8Array(buf), ext, scope).then((src) => onAddImage(x, y, src));
    });
  }, [scope, getDropPosition, onAddImage]);

  const handleImportDialog = useCallback(async () => {
    const src = await importCanvasAssetFromDialog(scope);
    if (!src) return;
    const { x, y } = getDropPosition();
    onAddImage(x, y, src);
  }, [scope, getDropPosition, onAddImage]);

  return { handlePaste, handleDrop, handleImportDialog };
}
