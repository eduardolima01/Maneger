import { useCallback, useEffect, useRef, useState } from 'react';
import { Stage, Layer, Rect } from 'react-konva';
import type Konva from 'konva';
import CanvasToolbar from './components/CanvasToolbar';
import CanvasElementView from './components/CanvasElementView';
import TextElementEditor from './components/TextElementEditor';
import ContextMenu, { type ContextMenuItem } from '@/components/ui/ContextMenu';
import { useCanvasViewport } from './hooks/useCanvasViewport';
import { useCanvasElements } from './hooks/useCanvasElements';
import { useCanvasClipboard } from './hooks/useCanvasClipboard';
import { loadCanvasData, saveCanvasData, deleteCanvasAsset } from './api/canvas';

const AUTOSAVE_DEBOUNCE_MS = 800;

interface CanvasPageProps {
  /** Preparado para Canvas por-projeto no futuro. null = Canvas global (comportamento atual). */
  scope?: string | null;
}

export default function CanvasPage({ scope = null }: CanvasPageProps) {
  const [loaded, setLoaded] = useState(false);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; items: ContextMenuItem[] } | null>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [stageSize, setStageSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setStageSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const els = useCanvasElements([]);
  const viewportApi = useCanvasViewport({ x: 0, y: 0, zoom: 1 }, () => scheduleSave());

  // carga inicial — popula elementos e viewport salvos, sem entrar no histórico de undo
  useEffect(() => {
    let cancelled = false;
    loadCanvasData(scope).then((data) => {
      if (cancelled) return;
      els.loadElements(data.elements);
      viewportApi.setViewportSilently(data.viewport);
      setLoaded(true);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

  function scheduleSave() {
    if (!loaded) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveCanvasData({ version: 1, viewport: viewportApi.viewport, elements: els.elements }, scope);
    }, AUTOSAVE_DEBOUNCE_MS);
  }

  useEffect(() => { scheduleSave(); }, [els.elements]); // eslint-disable-line react-hooks/exhaustive-deps

  // converte posição de tela (pointer) pra posição no MUNDO, considerando pan/zoom atual
  const getWorldPointer = useCallback((): { x: number; y: number } => {
    const stage = stageRef.current;
    const pointer = stage?.getPointerPosition();
    const { x, y, zoom } = viewportApi.viewport;
    if (!stage || !pointer) {
      const rect = containerRef.current?.getBoundingClientRect();
      const cx = (rect?.width ?? 800) / 2;
      const cy = (rect?.height ?? 600) / 2;
      return { x: (cx - x) / zoom, y: (cy - y) / zoom };
    }
    return { x: (pointer.x - x) / zoom, y: (pointer.y - y) / zoom };
  }, [viewportApi.viewport]);

  const clipboard = useCanvasClipboard({
    scope,
    getDropPosition: getWorldPointer,
    onAddText: (x, y, content) => {
      const el = els.addText(x, y);
      els.updateTextContent(el.id, content);
    },
    onAddImage: (x, y, src) => els.addImage(x, y, src),
  });

  useEffect(() => {
    function handlePaste(e: ClipboardEvent) {
      if (editingTextId) return; // dentro do textarea de edição, deixa o paste nativo agir
      clipboard.handlePaste(e);
    }
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [clipboard, editingTextId]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const isTyping = target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.isContentEditable;
      if (isTyping) return;

      if ((e.key === 'Delete' || e.key === 'Backspace' || e.key === 'q') && els.selectedId) {
        e.preventDefault();
        const el = els.elements.find((x) => x.id === els.selectedId);
        if (el?.type === 'image') deleteCanvasAsset(el.src).catch(() => { });
        els.removeElement(els.selectedId);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) els.redo(); else els.undo();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [els, scope]);

  function handleStageClick(e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) {
    if (e.target === e.target.getStage()) {
      els.setSelectedId(null);
      setContextMenu(null);
    }
  }

  // só cria texto novo se o duplo-clique caiu em área vazia do canvas (não em cima de um elemento) —
  // o evento de duplo-clique de um elemento SOBE (bubble) até o Stage, então sem essa checagem
  // editar um texto existente também disparava a criação de um texto novo.
  function handleStageDblClick(e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) {
    if (e.target !== e.target.getStage()) return;
    const { x, y } = getWorldPointer();
    const el = els.addText(x, y);
    setEditingTextId(el.id);
  }

  function openElementContextMenu(id: string, e: Konva.KonvaEventObject<PointerEvent>) {
    e.evt.preventDefault();
    els.setSelectedId(id);
    setContextMenu({
      x: e.evt.clientX,
      y: e.evt.clientY,
      items: [
        { label: 'Editar', onClick: () => { const el = els.elements.find((x) => x.id === id); if (el?.type === 'text') setEditingTextId(id); } },
        { label: 'Duplicar', onClick: () => els.duplicateElement(id) },
        {
          label: 'Excluir', danger: true, onClick: () => {
            const el = els.elements.find((x) => x.id === id);
            if (el?.type === 'image') deleteCanvasAsset(el.src).catch(() => { });
            els.removeElement(id);
          }
        },
      ],
    });
  }

  function openCanvasContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        { label: 'Novo texto', onClick: () => { const { x, y } = getWorldPointer(); els.addText(x, y); } },
        { label: 'Importar imagem', onClick: () => clipboard.handleImportDialog() },
        { label: 'Desfazer', onClick: () => els.undo() },
        { label: 'Refazer', onClick: () => els.redo() },
      ],
    });
  }

  const editingElement = editingTextId ? els.elements.find((e) => e.id === editingTextId) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <CanvasToolbar
        zoomPercent={Math.round(viewportApi.viewport.zoom * 100)}
        canUndo={els.canUndo}
        canRedo={els.canRedo}
        onAddText={() => { const { x, y } = getWorldPointer(); els.addText(x, y); }}
        onImportImage={() => clipboard.handleImportDialog()}
        onUndo={els.undo}
        onRedo={els.redo}
        onZoomIn={() => viewportApi.zoomBy(1.1)}
        onZoomOut={() => viewportApi.zoomBy(1 / 1.1)}
        onResetZoom={viewportApi.resetZoom}
      />

      <div
        ref={containerRef}
        style={{ position: 'relative', flex: 1, overflow: 'hidden', background: '#f5f5f5' }}
        onDrop={clipboard.handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onContextMenu={openCanvasContextMenu}
      >
        <Stage
          ref={stageRef}
          width={stageSize.width}
          height={stageSize.height}
          x={viewportApi.viewport.x}
          y={viewportApi.viewport.y}
          scaleX={viewportApi.viewport.zoom}
          scaleY={viewportApi.viewport.zoom}
          draggable={viewportApi.isPanning}
          onWheel={viewportApi.handleWheel}
          onDragEnd={viewportApi.handleStageDragEnd}
          onClick={handleStageClick}
          onTap={handleStageClick}
          onDblClick={handleStageDblClick}
          onDblTap={handleStageDblClick}
        >
          <Layer>
            <Rect x={-5000} y={-5000} width={10000} height={10000} fill="#f5f5f5" listening={false} />
            {els.elements.map((el) => (
              <CanvasElementView
                key={el.id}
                element={el}
                isSelected={els.selectedId === el.id}
                onSelect={() => els.setSelectedId(el.id)}
                onChange={(patch) => els.updateElement(el.id, patch)}
                onDoubleClickText={() => setEditingTextId(el.id)}
                onContextMenu={(e) => openElementContextMenu(el.id, e)}
              />
            ))}
          </Layer>
        </Stage>

        {editingElement && editingElement.type === 'text' && (
          <TextElementEditor
            element={editingElement}
            viewport={viewportApi.viewport}
            onChange={(content) => els.updateTextContent(editingElement.id, content)}
            onClose={() => setEditingTextId(null)}
          />
        )}
      </div>

      {contextMenu && (
        <ContextMenu x={contextMenu.x} y={contextMenu.y} items={contextMenu.items} onClose={() => setContextMenu(null)} />
      )}
    </div>
  );
}
