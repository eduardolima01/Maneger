import { useCallback, useRef, useState } from 'react';
import { generateId } from '@/lib/utils/uuid';
import type { CanvasElement, TextElement } from '../types/canvas.types';
import { defaultTextElement } from '../types/canvas.types';

const MAX_HISTORY = 50;

export function useCanvasElements(initialElements: CanvasElement[]) {
  const [elements, setElementsState] = useState<CanvasElement[]>(initialElements);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const undoStack = useRef<CanvasElement[][]>([]);
  const redoStack = useRef<CanvasElement[][]>([]);
  const skipNextSnapshot = useRef(false);

  function snapshot(prev: CanvasElement[]) {
    undoStack.current = [...undoStack.current, prev].slice(-MAX_HISTORY);
    redoStack.current = [];
  }

  /** Toda mutação que deve entrar no histórico passa por aqui. */
  function setElements(updater: (prev: CanvasElement[]) => CanvasElement[], recordHistory = true) {
    setElementsState((prev) => {
      const next = updater(prev);
      if (recordHistory && !skipNextSnapshot.current) snapshot(prev);
      skipNextSnapshot.current = false;
      return next;
    });
  }

  const addText = useCallback((x: number, y: number) => {
    const el = defaultTextElement({ id: generateId(), x, y });
    setElements((prev) => [...prev, el]);
    setSelectedId(el.id);
    return el;
  }, []);

  const addImage = useCallback((x: number, y: number, src: string, width = 320, height = 240) => {
    const el: CanvasElement = { type: 'image', id: generateId(), x, y, width, height, src };
    setElements((prev) => [...prev, el]);
    setSelectedId(el.id);
    return el;
  }, []);

  const updateElement = useCallback((id: string, patch: Partial<CanvasElement>, recordHistory = true) => {
    setElements((prev) => prev.map((e) => (e.id === id ? ({ ...e, ...patch } as CanvasElement) : e)), recordHistory);
  }, []);

  const updateTextContent = useCallback((id: string, content: string) => {
    setElements((prev) => prev.map((e) => (e.id === id && e.type === 'text' ? ({ ...e, content } as TextElement) : e)));
  }, []);

  /** Popula elementos carregados do disco (carga inicial) sem entrar no histórico de undo/redo. */
  const loadElements = useCallback((loaded: CanvasElement[]) => {
    setElementsState(loaded);
    undoStack.current = [];
    redoStack.current = [];
  }, []);

  const removeElement = useCallback((id: string) => {
    setElements((prev) => prev.filter((e) => e.id !== id));
    setSelectedId((cur) => (cur === id ? null : cur));
  }, []);

  const duplicateElement = useCallback((id: string) => {
    setElements((prev) => {
      const original = prev.find((e) => e.id === id);
      if (!original) return prev;
      const copy = { ...original, id: generateId(), x: original.x + 24, y: original.y + 24 };
      setSelectedId(copy.id);
      return [...prev, copy];
    });
  }, []);

  function undo() {
    const last = undoStack.current.pop();
    if (!last) return;
    setElementsState((current) => {
      redoStack.current = [...redoStack.current, current].slice(-MAX_HISTORY);
      return last;
    });
  }

  function redo() {
    const next = redoStack.current.pop();
    if (!next) return;
    setElementsState((current) => {
      undoStack.current = [...undoStack.current, current].slice(-MAX_HISTORY);
      return next;
    });
  }

  return {
    elements,
    selectedId,
    setSelectedId,
    addText,
    addImage,
    loadElements,
    updateElement,
    updateTextContent,
    removeElement,
    duplicateElement,
    undo,
    redo,
    canUndo: undoStack.current.length > 0,
    canRedo: redoStack.current.length > 0,
  };
}
