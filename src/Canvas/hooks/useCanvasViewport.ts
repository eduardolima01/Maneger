import { useCallback, useEffect, useRef, useState } from 'react';
import type Konva from 'konva';
import type { CanvasViewport } from '../types/canvas.types';

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 1.1;

export function useCanvasViewport(initial: CanvasViewport, onChange: (v: CanvasViewport) => void) {
  const [viewport, setViewport] = useState<CanvasViewport>(initial);
  const spacePressedRef = useRef(false);
  const [isPanning, setIsPanning] = useState(false);
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);

  function update(v: CanvasViewport) {
    setViewport(v);
    onChange(v);
  }

  function clampZoom(z: number) {
    return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
  }

  const handleWheel = useCallback((e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = e.target.getStage();
    if (!stage) return;

    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const oldZoom = viewport.zoom;
    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const newZoom = clampZoom(direction > 0 ? oldZoom * ZOOM_STEP : oldZoom / ZOOM_STEP);

    const mousePointTo = {
      x: (pointer.x - viewport.x) / oldZoom,
      y: (pointer.y - viewport.y) / oldZoom,
    };

    update({
      zoom: newZoom,
      x: pointer.x - mousePointTo.x * newZoom,
      y: pointer.y - mousePointTo.y * newZoom,
    });
  }, [viewport]);

  function zoomBy(factor: number, center?: { x: number; y: number }) {
    const oldZoom = viewport.zoom;
    const newZoom = clampZoom(oldZoom * factor);
    if (!center) {
      update({ ...viewport, zoom: newZoom });
      return;
    }
    const mousePointTo = { x: (center.x - viewport.x) / oldZoom, y: (center.y - viewport.y) / oldZoom };
    update({ zoom: newZoom, x: center.x - mousePointTo.x * newZoom, y: center.y - mousePointTo.y * newZoom });
  }

  function resetZoom() {
    update({ x: 0, y: 0, zoom: 1 });
  }

  // Ctrl/Cmd + '+' / '-' / '0'
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomBy(ZOOM_STEP); }
      else if (e.key === '-') { e.preventDefault(); zoomBy(1 / ZOOM_STEP); }
      else if (e.key === '0') { e.preventDefault(); resetZoom(); }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewport]);

  // Space pressionado: liga o modo pan (muda cursor); ao soltar, desliga e zera o ponteiro de referência.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const isTyping = target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.isContentEditable;
      if (isTyping) return;

      if (e.code === 'Space' && !spacePressedRef.current) {
        e.preventDefault(); // evita scroll da página
        spacePressedRef.current = true;
        setIsPanning(true);
      }
    }
    function handleKeyUp(e: KeyboardEvent) {
      if (e.code === 'Space') {
        spacePressedRef.current = false;
        lastPointerRef.current = null;
        setIsPanning(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Move o canvas acompanhando o mouse enquanto espaço está pressionado — SEM precisar clicar.
  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      if (!spacePressedRef.current) {
        lastPointerRef.current = null;
        return;
      }
      if (lastPointerRef.current) {
        const dx = e.clientX - lastPointerRef.current.x;
        const dy = e.clientY - lastPointerRef.current.y;
        setViewport((prev) => {
          const next = { ...prev, x: prev.x + dx, y: prev.y + dy };
          onChange(next);
          return next;
        });
      }
      lastPointerRef.current = { x: e.clientX, y: e.clientY };
    }
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Aplica um viewport vindo de fora (ex: carga assíncrona do disco) sem passar pelo autosave. */
  function setViewportSilently(v: CanvasViewport) {
    setViewport(v);
  }

  return { viewport, isPanning, handleWheel, zoomBy, resetZoom, setViewportSilently };
}
