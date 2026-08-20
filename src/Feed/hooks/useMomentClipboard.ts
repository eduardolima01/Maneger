import { useCallback } from 'react';
import { generateId } from '@/lib/utils/uuid';
import { saveMomentAssetBytes } from '../api/feed';
import type { Attachment } from '../types/feed.types';

function extensionFromMime(mime: string): string {
  const map: Record<string, string> = {
    'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg',
    'image/webp': 'webp', 'image/gif': 'gif',
  };
  return map[mime] ?? 'png';
}

interface UseMomentClipboardParams {
  onAddAttachment: (attachment: Attachment) => void;
}

export function useMomentClipboard({ onAddAttachment }: UseMomentClipboardParams) {
  async function addFromFile(file: File) {
    const ext = extensionFromMime(file.type);
    const buf = await file.arrayBuffer();
    const path = await saveMomentAssetBytes(new Uint8Array(buf), ext);
    onAddAttachment({ id: generateId(), type: 'image', path });
  }

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) addFromFile(file);
        return;
      }
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) addFromFile(file);
  }, []);

  const handleFileSelect = useCallback((files: FileList | null) => {
    if (!files) return;
    Array.from(files).filter((f) => f.type.startsWith('image/')).forEach(addFromFile);
  }, []);

  return { handlePaste, handleDrop, handleFileSelect };
}
