import { useEffect, useRef, useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { openPath } from '@tauri-apps/plugin-opener';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { convertFileSrc } from '@tauri-apps/api/core';
import { saveCardFile, listCardFiles, deleteCardFile, getCardFilesDir, CardFileInfo } from '@/Kanban/api/kanbanCardAssets';

interface CardFilesSectionProps {
  cardId: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function iconForFile(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) return '🖼️';
  if (ext === 'pdf') return '📕';
  if (['doc', 'docx'].includes(ext)) return '📄';
  if (['xls', 'xlsx', 'csv'].includes(ext)) return '📊';
  if (['zip', 'rar', '7z'].includes(ext)) return '🗜️';
  if (['mp3', 'wav', 'ogg'].includes(ext)) return '🎵';
  if (['mp4', 'mov', 'avi', 'mkv'].includes(ext)) return '🎬';
  return '📎';
}

const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'];
const VIDEO_EXTS = ['mp4', 'mov', 'avi', 'mkv', 'webm'];

function extOf(name: string): string {
  return name.split('.').pop()?.toLowerCase() ?? '';
}

type PreviewKind = 'image' | 'video' | 'pdf' | 'unsupported';

function previewKindForFile(name: string): PreviewKind {
  const ext = extOf(name);
  if (IMAGE_EXTS.includes(ext)) return 'image';
  if (VIDEO_EXTS.includes(ext)) return 'video';
  if (ext === 'pdf') return 'pdf';
  return 'unsupported';
}

/** Thumbnail 24x24 de um frame do vídeo — sem controles, sem autoplay, só a capa. */
function VideoThumbnail({ path }: { path: string }) {
  return (
    <video
      src={convertFileSrc(path)}
      muted
      playsInline
      preload="metadata"
      onLoadedMetadata={(e) => {
        const v = e.currentTarget;
        v.currentTime = Math.min(1, (v.duration || 2) / 2); // pula pro meio (ou 1s) pra não pegar frame preto do início
      }}
      style={{ width: 24, height: 24, objectFit: 'cover', borderRadius: 3, flexShrink: 0, background: '#000' }}
    />
  );
}

/** Lista, adiciona e remove arquivos do card. Pasta em disco só existe depois do 1º arquivo. */
export default function CardFilesSection({ cardId }: CardFilesSectionProps) {
  const [files, setFiles] = useState<CardFileInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [previewFile, setPreviewFile] = useState<CardFileInfo | null>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  async function reload() {
    setLoading(true);
    const list = await listCardFiles(cardId);
    setFiles(list);
    setLoading(false);
  }

  useEffect(() => {
    reload();
  }, [cardId]);

  // Drag-and-drop nativo do Tauri (dá path real de arquivo, diferente do HTML5 drop do
  // navegador) — evento é window-wide, então recorta manualmente pelo retângulo da dropzone.
  // position vem em pixels físicos; getBoundingClientRect() é lógico, daí a divisão por DPR.
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      const win = getCurrentWindow();
      const stop = await win.onDragDropEvent((event) => {
        const scale = window.devicePixelRatio || 1;

        if (event.payload.type === 'over') {
          const rect = dropZoneRef.current?.getBoundingClientRect();
          const x = event.payload.position.x / scale;
          const y = event.payload.position.y / scale;
          setIsDragOver(!!rect && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom);
          return;
        }

        if (event.payload.type === 'drop') {
          const rect = dropZoneRef.current?.getBoundingClientRect();
          const x = event.payload.position.x / scale;
          const y = event.payload.position.y / scale;
          setIsDragOver(false);
          const insideDropZone = !!rect && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
          if (insideDropZone) handleDroppedPaths(event.payload.paths);
          return;
        }

        setIsDragOver(false); // 'cancel' ou qualquer outro tipo
      });
      if (cancelled) stop();
      else unlisten = stop;
    })();

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [cardId]);

  async function handleDroppedPaths(paths: string[]) {
    if (paths.length === 0) return;
    setAdding(true);
    for (const path of paths) {
      await saveCardFile(cardId, path); // sequencial — evita corrida entre arquivos de nome igual
    }
    setAdding(false);
    await reload();
  }

  async function handleOpenFolder() {
    const dir = await getCardFilesDir(cardId);
    await openPath(dir);
  }

  async function handleAddFile() {
    const selected = await open({ multiple: true });
    if (!selected) return;
    const paths = Array.isArray(selected) ? selected : [selected];
    setAdding(true);
    for (const path of paths) {
      await saveCardFile(cardId, path); // sequencial — evita corrida entre arquivos de nome igual
    }
    setAdding(false);
    await reload();
  }

  async function handleRemove(fileName: string) {
    await deleteCardFile(cardId, fileName);
    if (previewFile?.name === fileName) setPreviewFile(null);
    await reload();
  }

  return (
    <div key="files" style={{ borderTop: '1px solid #eee', paddingTop: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: '#666' }}>Arquivos</label>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={reload}
            disabled={loading}
            title="Atualizar lista"
            style={{ fontSize: 11, color: '#666', background: 'none', border: 'none', cursor: loading ? 'default' : 'pointer', padding: 0, opacity: loading ? 0.6 : 1 }}
          >
            🔄
          </button>
          <button
            onClick={handleOpenFolder}
            style={{ fontSize: 11, color: '#666', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            📂 Abrir pasta
          </button>
          <button
            onClick={handleAddFile}
            disabled={adding}
            style={{ fontSize: 11, color: '#1a73e8', background: 'none', border: 'none', cursor: adding ? 'default' : 'pointer', padding: 0, opacity: adding ? 0.6 : 1 }}
          >
            {adding ? 'Adicionando...' : '+ Adicionar arquivo'}
          </button>
        </div>
      </div>

      <div
        ref={dropZoneRef}
        style={{
          border: `1.5px dashed ${isDragOver ? '#1a73e8' : '#ddd'}`,
          borderRadius: 6, padding: '8px 6px', marginBottom: 8, textAlign: 'center',
          fontSize: 10.5, color: isDragOver ? '#1a73e8' : '#aaa',
          backgroundColor: isDragOver ? '#eef2ff' : 'transparent',
          transition: 'all 0.1s ease',
        }}
      >
        {adding ? 'Movendo arquivo(s)...' : 'Arraste arquivos aqui pra mover pro card'}
      </div>

      {loading && <p style={{ fontSize: 11, color: '#999', margin: 0 }}>Carregando...</p>}

      {!loading && files.length === 0 && (
        <p style={{ fontSize: 11, color: '#bbb', fontStyle: 'italic', margin: 0 }}>Nenhum arquivo ainda.</p>
      )}

      {!loading && files.length > 0 && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <div style={{ flex: previewFile ? '0 0 50%' : 1, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
            {files.map((f) => (
              <div
                key={f.name}
                onClick={() => setPreviewFile(f)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer',
                  padding: '4px 6px', borderRadius: 4,
                  background: previewFile?.name === f.name ? '#eef2ff' : '#fafafa',
                }}
              >
                <span style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {previewKindForFile(f.name) === 'image' && (
                    <img src={convertFileSrc(f.path)} alt="" style={{ width: 24, height: 24, objectFit: 'cover', borderRadius: 3 }} />
                  )}
                  {previewKindForFile(f.name) === 'video' && <VideoThumbnail path={f.path} />}
                  {previewKindForFile(f.name) !== 'image' && previewKindForFile(f.name) !== 'video' && (
                    <span>{iconForFile(f.name)}</span>
                  )}
                </span>
                <span
                  title="Pré-visualizar"
                  style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {f.name}
                </span>
                <span style={{ color: '#999', fontSize: 10, flexShrink: 0 }}>{formatSize(f.size)}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); handleRemove(f.name); }}
                  title="Remover arquivo"
                  style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#c62828', fontSize: 11, padding: 0, flexShrink: 0 }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          {previewFile && (
            <div style={{ flex: 1, minWidth: 0, border: '1px solid #eee', borderRadius: 6, padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {previewFile.name}
                </span>
                <button
                  onClick={() => setPreviewFile(null)}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#999', fontSize: 12, padding: 0, flexShrink: 0 }}
                >
                  ✕
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 120, maxHeight: 260, overflow: 'auto', background: '#fafafa', borderRadius: 4 }}>
                {previewKindForFile(previewFile.name) === 'image' && (
                  <img
                    src={convertFileSrc(previewFile.path)}
                    alt={previewFile.name}
                    style={{ maxWidth: '100%', maxHeight: 260, objectFit: 'contain' }}
                  />
                )}
                {previewKindForFile(previewFile.name) === 'video' && (
                  <video
                    src={convertFileSrc(previewFile.path)}
                    controls
                    style={{ maxWidth: '100%', maxHeight: 260 }}
                  />
                )}
                {previewKindForFile(previewFile.name) === 'pdf' && (
                  <iframe
                    src={convertFileSrc(previewFile.path)}
                    title={previewFile.name}
                    style={{ width: '100%', height: 260, border: 'none' }}
                  />
                )}
                {previewKindForFile(previewFile.name) === 'unsupported' && (
                  <p style={{ fontSize: 11, color: '#999', textAlign: 'center', padding: 12, margin: 0 }}>
                    Pré-visualização não disponível pra este tipo de arquivo.
                  </p>
                )}
              </div>

              <button
                onClick={() => openPath(previewFile.path)}
                style={{ fontSize: 11, color: '#1a73e8', background: 'none', border: 'none', cursor: 'pointer', padding: 0, alignSelf: 'flex-start' }}
              >
                Abrir com o app padrão
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
