import { useRef, useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { convertFileSrc } from '@tauri-apps/api/core';
import { saveCoverFromFile, isImageFile } from '@/lib/utils/imageUpload';

interface ImageUploadFieldProps {
  entityId: string;
  currentPath: string | null;
  onUploaded: (path: string) => void;
  height?: number;
  /**
   * Se informado, o campo vira um quadrado de `squareSize` px (imagem cortada pra preencher o quadrado),
   * em vez de uma faixa de largura total com `height` px. Sem esta prop o visual é o de sempre.
   */
  squareSize?: number;
}

export default function ImageUploadField({ entityId, currentPath, onUploaded, height = 100, squareSize }: ImageUploadFieldProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [compress, setCompress] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  async function handleFile(file: File) {
    if (!isImageFile(file)) {
      setError('Selecione um arquivo de imagem.');
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const path = await saveCoverFromFile(entityId, file, compress);
      onUploaded(path);
    } catch (err) {
      setError(String(err));
    } finally {
      setUploading(false);
    }
  }

  async function handlePickFile() {
    const selected = await open({
      multiple: false,
      filters: [{ name: 'Imagens', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }],
    });
    if (!selected || Array.isArray(selected)) return;
    setUploading(true);
    setError(null);
    try {
      // lê o arquivo escolhido do disco como File, pra passar pela mesma compressão do drag/paste
      const response = await fetch(convertFileSrc(selected));
      const blob = await response.blob();
      const file = new File([blob], selected.split(/[\\/]/).pop() ?? 'image', { type: blob.type });
      const newPath = await saveCoverFromFile(entityId, file, compress);
      onUploaded(newPath);
    } catch (err) {
      setError(String(err));
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  async function handlePaste(e: React.ClipboardEvent) {
    const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith('image/'));
    if (!item) return;
    const file = item.getAsFile();
    if (file) await handleFile(file);
  }

  return (
    <div>
      <div
        ref={containerRef}
        tabIndex={0}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        onPaste={handlePaste}
        onClick={handlePickFile}
        className={
          isDragOver
            ? 'border-2 border-dashed border-blue-600 dark:border-blue-400 bg-blue-50 dark:bg-blue-950'
            : 'border-2 border-dashed border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-900'
        }
        style={{
          borderRadius: 8,
          padding: currentPath ? 0 : 16,
          textAlign: 'center',
          cursor: 'pointer',
          position: 'relative',
          overflow: 'hidden',
          outline: 'none',
          ...(squareSize
            ? {
              width: squareSize, height: squareSize, maxWidth: '100%', boxSizing: 'border-box',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }
            : {}),
        }}
      >
        {currentPath ? (
          <img src={convertFileSrc(currentPath)} style={{ width: '100%', height: squareSize ? '100%' : height, objectFit: 'cover', display: 'block' }} />
        ) : (
          <div className="text-neutral-400 dark:text-neutral-500" style={{ fontSize: 12, padding: squareSize ? 0 : `${height / 2 - 20}px 0` }}>
            {uploading ? 'Enviando...' : '📷 Clique, arraste uma imagem, ou cole (Ctrl+V)'}
          </div>
        )}

        {uploading && currentPath && (
          <div className="bg-white/70 dark:bg-neutral-900/70 text-neutral-500 dark:text-neutral-400" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>
            Enviando...
          </div>
        )}
      </div>

      {currentPath && (
        <button
          onClick={(e) => { e.stopPropagation(); containerRef.current?.click(); }}
          className="text-blue-600 dark:text-blue-400"
          style={{ fontSize: 11, background: 'none', border: 'none', cursor: 'pointer', marginTop: 4, padding: 0 }}
        >
          Trocar imagem
        </button>
      )}

      {error && <p className="text-red-600 dark:text-red-400" style={{ fontSize: 11, marginTop: 4 }}>{error}</p>}

      <label
        onClick={(e) => e.stopPropagation()}
        className="text-neutral-500 dark:text-neutral-400"
        style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, marginTop: 4, cursor: 'pointer' }}
      >
        <input type="checkbox" checked={compress} onChange={(e) => setCompress(e.target.checked)} />
        Comprimir imagem antes de salvar (recomendado)
      </label>
    </div>
  );
}
