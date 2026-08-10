import { useEffect, useRef } from 'react';
import type { TextElement, CanvasViewport } from '../types/canvas.types';

interface TextElementEditorProps {
  element: TextElement;
  viewport: CanvasViewport;
  onChange: (content: string) => void;
  onClose: () => void;
}

export default function TextElementEditor({ element, viewport, onChange, onClose }: TextElementEditorProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  // posição/tamanho na TELA = transformação do mundo pro viewport atual (mesma matemática do Stage)
  const style: React.CSSProperties = {
    position: 'absolute',
    top: element.y * viewport.zoom + viewport.y,
    left: element.x * viewport.zoom + viewport.x,
    width: element.width * viewport.zoom,
    height: element.height * viewport.zoom,
    fontSize: element.fontSize * viewport.zoom,
    fontWeight: element.bold ? 700 : 400,
    fontStyle: element.italic ? 'italic' : 'normal',
    textAlign: element.align,
    color: element.color,
    border: '1px dashed #1a73e8',
    background: 'rgba(255,255,255,0.95)',
    padding: 4,
    resize: 'none',
    outline: 'none',
    zIndex: 10,
    fontFamily: 'inherit',
  };

  return (
    <textarea
      ref={ref}
      style={style}
      value={element.content}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) onClose();
      }}
    />
  );
}
