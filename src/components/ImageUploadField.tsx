import { useRef, useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { convertFileSrc } from '@tauri-apps/api/core';
import { saveCoverFromFile, isImageFile } from '@/lib/utils/imageUpload';

interface ImageUploadFieldProps {
  entityId: string;
  currentPath: string | null;
  onUploaded: (path: string) => void;
  height?: number;
}

export default function ImageUploadField({ entityId, currentPath, onUploaded, height = 100 }: ImageUploadFieldProps) {
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
        style={{
          border: isDragOver ? '2px dashed #1a73e8' : '2px dashed #ccc',
          borderRadius: 8,
          padding: currentPath ? 0 : 16,
          textAlign: 'center',
          cursor: 'pointer',
          backgroundColor: isDragOver ? '#e8f0fe' : '#fafafa',
          position: 'relative',
          overflow: 'hidden',
          outline: 'none',
        }}
      >
        {currentPath ? (
          <img src={convertFileSrc(currentPath)} style={{ width: '100%', height, objectFit: 'cover', display: 'block' }} />
        ) : (
          <div style={{ fontSize: 12, color: '#999', padding: `${height / 2 - 20}px 0` }}>
            {uploading ? 'Enviando...' : '📷 Clique, arraste uma imagem, ou cole (Ctrl+V)'}
          </div>
        )}

        {uploading && currentPath && (
          <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#666' }}>
            Enviando...
          </div>
        )}
      </div>

      {currentPath && (
        <button
          onClick={(e) => { e.stopPropagation(); containerRef.current?.click(); }}
          style={{ fontSize: 11, color: '#1a73e8', background: 'none', border: 'none', cursor: 'pointer', marginTop: 4, padding: 0 }}
        >
          Trocar imagem
        </button>
      )}

      {error && <p style={{ fontSize: 11, color: '#c62828', marginTop: 4 }}>{error}</p>}

      <label
        onClick={(e) => e.stopPropagation()}
        style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#666', marginTop: 4, cursor: 'pointer' }}
      >
        <input type="checkbox" checked={compress} onChange={(e) => setCompress(e.target.checked)} />
        Comprimir imagem antes de salvar (recomendado)
      </label>
    </div>
  );
}
