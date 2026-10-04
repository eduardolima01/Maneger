import { Fragment, useEffect, useRef, useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { openPath } from '@tauri-apps/plugin-opener';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { convertFileSrc } from '@tauri-apps/api/core';
import { saveCardFile, listCardFiles, deleteCardFile, renameCardFile, getCardFilesDir, CardFileInfo } from '@/Kanban/api/kanbanCardAssets';
import { saveCoverFromFile } from '@/lib/utils/imageUpload';
import { captureVideoFrame } from '@/Kanban/utils/videoFrame';

interface CardFilesSectionProps {
  cardId: string;
  /** Se informado, imagens e vídeos da lista ganham "Usar como capa do card" (vídeo usa um frame dele). Sem isso, os botões somem. */
  onSetCover?: (coverPath: string) => void;
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

/** Nome de arquivo válido no Windows (o mais restritivo): devolve a mensagem de erro, ou null se estiver ok. */
function validateFileName(name: string): string | null {
  if (!name.trim()) return 'O nome não pode ficar vazio.';
  if (name === '.' || name === '..') return 'Nome inválido.';
  if (/[\\/:*?"<>|]/.test(name) || /[\u0000-\u001f]/.test(name)) return 'O nome não pode ter  \\ / : * ? " < > |';
  if (/[. ]$/.test(name)) return 'O nome não pode terminar com ponto ou espaço.';
  if (name.length > 255) return 'Nome muito longo.';
  return null;
}

function extOf(name: string): string {
  return name.split('.').pop()?.toLowerCase() ?? '';
}

/** Pode virar capa? Imagem (menos SVG, que o campo de capa também não aceita) ou vídeo (usa um frame). */
function canBeCover(name: string): boolean {
  const ext = extOf(name);
  return (IMAGE_EXTS.includes(ext) && ext !== 'svg') || VIDEO_EXTS.includes(ext);
}

const IMAGE_MIME: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' };

function baseNameOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(0, dot) : name;
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
export default function CardFilesSection({ cardId, onSetCover }: CardFilesSectionProps) {
  const [files, setFiles] = useState<CardFileInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [previewFile, setPreviewFile] = useState<CardFileInfo | null>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // renomear: qual arquivo está em edição, o texto digitado e o erro (nome inválido, repetido, falha do disco)
  const [renamingName, setRenamingName] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);
  const renameBusyRef = useRef(false);

  // capa: qual arquivo está sendo transformado em capa (trava os botões) e o erro, se der
  const [coverBusyName, setCoverBusyName] = useState<string | null>(null);
  const [coverError, setCoverError] = useState<string | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);

  /**
   * Transforma um arquivo da lista na capa do card. Imagem: copia pra pasta de capas (a capa não quebra se o arquivo
   * for renomeado ou removido depois). Vídeo: captura um frame — `atSeconds` (o instante em que o usuário parou o
   * player) ou, sem ele, um frame automático — e salva o frame como imagem de capa.
   */
  async function setFileAsCover(f: CardFileInfo, atSeconds?: number) {
    if (!onSetCover || coverBusyName) return;
    setCoverBusyName(f.name);
    setCoverError(null);
    try {
      let file: File;
      if (previewKindForFile(f.name) === 'video') {
        const frame = await captureVideoFrame(convertFileSrc(f.path), atSeconds, f.size);
        file = new File([frame], `${baseNameOf(f.name)}-frame.jpg`, { type: 'image/jpeg' });
      } else {
        const blob = await (await fetch(convertFileSrc(f.path))).blob();
        file = new File([blob], f.name, { type: blob.type || IMAGE_MIME[extOf(f.name)] || 'image/png' });
      }
      const coverPath = await saveCoverFromFile(cardId, file, true);
      onSetCover(coverPath);
    } catch (err) {
      setCoverError(err instanceof Error ? err.message : String(err));
    } finally {
      setCoverBusyName(null);
    }
  }

  /** `showLoading = false` atualiza a lista sem piscar "Carregando..." (usado depois de renomear). Devolve a lista nova. */
  async function reload(showLoading = true): Promise<CardFileInfo[]> {
    if (showLoading) setLoading(true);
    const list = await listCardFiles(cardId);
    setFiles(list);
    setLoading(false);
    return list;
  }

  function startRename(f: CardFileInfo) {
    setRenameError(null);
    setRenameDraft(f.name);
    setRenamingName(f.name);
  }

  function cancelRename() {
    setRenamingName(null);
    setRenameError(null);
  }

  /** `fromBlur`: ao clicar fora, nome inválido só descarta a edição (não deixa o campo preso aberto com erro). */
  async function commitRename(f: CardFileInfo, fromBlur = false) {
    if (renameBusyRef.current) return;
    const next = renameDraft.trim();
    if (!next || next === f.name) { cancelRename(); return; }

    const problem = validateFileName(next)
      ?? (files.some((o) => o.name !== f.name && o.name.toLowerCase() === next.toLowerCase()) ? 'Já existe um arquivo com esse nome.' : null);
    if (problem) {
      if (fromBlur) cancelRename(); else setRenameError(problem);
      return;
    }

    renameBusyRef.current = true;
    try {
      const newPath = await renameCardFile(f.path, next);
      const list = await reload(false);
      // a pré-visualização aponta pro caminho antigo: troca pro arquivo renomeado
      setPreviewFile((prev) => (prev && prev.name === f.name ? (list.find((x) => x.name === next) ?? { ...prev, name: next, path: newPath }) : prev));
      cancelRename();
    } catch (err) {
      if (fromBlur) cancelRename(); else setRenameError(String(err));
    } finally {
      renameBusyRef.current = false;
    }
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
    <div key="files" className="border-t border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100" style={{ paddingTop: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <label className="text-neutral-500 dark:text-neutral-400" style={{ fontSize: 12, fontWeight: 600 }}>Arquivos</label>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={reload}
            disabled={loading}
            title="Atualizar lista"
            className="text-neutral-500 dark:text-neutral-400"
            style={{ fontSize: 11, background: 'none', border: 'none', cursor: loading ? 'default' : 'pointer', padding: 0, opacity: loading ? 0.6 : 1 }}
          >
            🔄
          </button>
          <button
            onClick={handleOpenFolder}
            className="text-neutral-500 dark:text-neutral-400"
            style={{ fontSize: 11, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            📂 Abrir pasta
          </button>
          <button
            onClick={handleAddFile}
            disabled={adding}
            className="text-blue-600 dark:text-blue-400"
            style={{ fontSize: 11, background: 'none', border: 'none', cursor: adding ? 'default' : 'pointer', padding: 0, opacity: adding ? 0.6 : 1 }}
          >
            {adding ? 'Adicionando...' : '+ Adicionar arquivo'}
          </button>
        </div>
      </div>

      <div
        ref={dropZoneRef}
        className={
          isDragOver
            ? 'border-[1.5px] border-dashed border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400 bg-indigo-50 dark:bg-indigo-950'
            : 'border-[1.5px] border-dashed border-neutral-300 dark:border-neutral-600 text-neutral-400 dark:text-neutral-500 bg-transparent'
        }
        style={{
          borderRadius: 6, padding: '8px 6px', marginBottom: 8, textAlign: 'center',
          fontSize: 10.5,
          transition: 'all 0.1s ease',
        }}
      >
        {adding ? 'Movendo arquivo(s)...' : 'Arraste arquivos aqui pra mover pro card'}
      </div>

      {coverError && (
        <p className="text-red-600 dark:text-red-400" style={{ fontSize: 11, margin: '0 0 6px' }}>Não foi possível usar como capa: {coverError}</p>
      )}

      {loading && <p className="text-neutral-400 dark:text-neutral-500" style={{ fontSize: 11, margin: 0 }}>Carregando...</p>}

      {!loading && files.length === 0 && (
        <p className="text-neutral-400 dark:text-neutral-500" style={{ fontSize: 11, fontStyle: 'italic', margin: 0 }}>Nenhum arquivo ainda.</p>
      )}

      {!loading && files.length > 0 && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <div style={{ flex: previewFile ? '0 0 50%' : 1, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
            {files.map((f) => (
              <Fragment key={f.name}>
                <div
                  onClick={() => setPreviewFile(f)}
                  className={previewFile?.name === f.name ? 'bg-indigo-50 dark:bg-indigo-950' : 'bg-neutral-50 dark:bg-neutral-900'}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer',
                    padding: '4px 6px', borderRadius: 4,
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
                  {renamingName === f.name ? (
                    <input
                      autoFocus
                      value={renameDraft}
                      onChange={(e) => { setRenameDraft(e.target.value); setRenameError(null); }}
                      onClick={(e) => e.stopPropagation()} // clicar no campo não abre a pré-visualização
                      onFocus={(e) => {
                        // seleciona só o nome, sem a extensão (como o Explorador) — dá pra trocar o nome sem perder o ".pdf"
                        const dot = e.currentTarget.value.lastIndexOf('.');
                        e.currentTarget.setSelectionRange(0, dot > 0 ? dot : e.currentTarget.value.length);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); void commitRename(f); }
                        if (e.key === 'Escape') { e.stopPropagation(); cancelRename(); }
                      }}
                      onBlur={() => { void commitRename(f, true); }}
                      className="bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 border border-blue-400 dark:border-blue-500 dark:[color-scheme:dark]"
                      style={{ flex: 1, minWidth: 0, padding: '1px 4px', fontSize: 12, borderRadius: 3, outline: 'none' }}
                    />
                  ) : (
                    <span
                      title="Pré-visualizar (dois cliques pra renomear)"
                      onDoubleClick={(e) => { e.stopPropagation(); startRename(f); }}
                      style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                      {f.name}
                    </span>
                  )}
                  <span className="text-neutral-400 dark:text-neutral-500" style={{ fontSize: 10, flexShrink: 0 }}>{formatSize(f.size)}</span>
                  {onSetCover && canBeCover(f.name) && (
                    <button
                      onClick={(e) => { e.stopPropagation(); void setFileAsCover(f); }}
                      disabled={!!coverBusyName}
                      title={previewKindForFile(f.name) === 'video' ? 'Usar um frame do vídeo como capa do card' : 'Usar como capa do card'}
                      className="text-neutral-400 dark:text-neutral-500 hover:text-blue-600 dark:hover:text-blue-400"
                      style={{ border: 'none', background: 'none', cursor: coverBusyName ? 'default' : 'pointer', fontSize: 11, padding: 0, flexShrink: 0, opacity: coverBusyName && coverBusyName !== f.name ? 0.4 : 1 }}
                    >
                      {coverBusyName === f.name ? '⏳' : '🖼'}
                    </button>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); startRename(f); }}
                    title="Renomear arquivo"
                    className="text-neutral-400 dark:text-neutral-500 hover:text-blue-600 dark:hover:text-blue-400"
                    style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 11, padding: 0, flexShrink: 0 }}
                  >
                    ✎
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleRemove(f.name); }}
                    title="Remover arquivo"
                    className="text-red-600 dark:text-red-400"
                    style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 11, padding: 0, flexShrink: 0 }}
                  >
                    ✕
                  </button>
                </div>
                {renamingName === f.name && renameError && (
                  <div className="text-red-600 dark:text-red-400" style={{ fontSize: 10, padding: '0 6px 2px' }}>{renameError}</div>
                )}
              </Fragment>
            ))}
          </div>

          {previewFile && (
            <div className="border border-neutral-200 dark:border-neutral-700" style={{ flex: 1, minWidth: 0, borderRadius: 6, padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {previewFile.name}
                </span>
                <button
                  onClick={() => setPreviewFile(null)}
                  className="text-neutral-400 dark:text-neutral-500"
                  style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, padding: 0, flexShrink: 0 }}
                >
                  ✕
                </button>
              </div>

              <div className="bg-neutral-50 dark:bg-neutral-900" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 120, maxHeight: 260, overflow: 'auto', borderRadius: 4 }}>
                {previewKindForFile(previewFile.name) === 'image' && (
                  <img
                    src={convertFileSrc(previewFile.path)}
                    alt={previewFile.name}
                    style={{ maxWidth: '100%', maxHeight: 260, objectFit: 'contain' }}
                  />
                )}
                {previewKindForFile(previewFile.name) === 'video' && (
                  <video
                    ref={previewVideoRef}
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
                  <p className="text-neutral-400 dark:text-neutral-500" style={{ fontSize: 11, textAlign: 'center', padding: 12, margin: 0 }}>
                    Pré-visualização não disponível pra este tipo de arquivo.
                  </p>
                )}
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {onSetCover && canBeCover(previewFile.name) && (
                  <button
                    onClick={() => void setFileAsCover(
                      previewFile,
                      previewKindForFile(previewFile.name) === 'video' ? previewVideoRef.current?.currentTime : undefined
                    )}
                    disabled={!!coverBusyName}
                    title={previewKindForFile(previewFile.name) === 'video' ? 'Pause no frame que você quer e clique aqui' : undefined}
                    className="text-blue-600 dark:text-blue-400"
                    style={{ fontSize: 11, background: 'none', border: 'none', cursor: coverBusyName ? 'default' : 'pointer', padding: 0, opacity: coverBusyName ? 0.6 : 1 }}
                  >
                    {coverBusyName === previewFile.name
                      ? 'Gerando capa...'
                      : previewKindForFile(previewFile.name) === 'video' ? '🖼 Usar o frame atual como capa' : '🖼 Usar como capa'}
                  </button>
                )}
                <button
                  onClick={() => openPath(previewFile.path)}
                  className="text-blue-600 dark:text-blue-400"
                  style={{ fontSize: 11, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  Abrir com o app padrão
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
