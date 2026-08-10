export interface CanvasElementBase {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
}

export interface TextElement extends CanvasElementBase {
  type: 'text';
  content: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  align: 'left' | 'center' | 'right';
  color: string;
}

export interface ImageElement extends CanvasElementBase {
  type: 'image';
  /** Path relativo ao scope, ex: "canvas-assets/uuid.png" — resolvido com convertFileSrc no front. */
  src: string;
}

// Union: futuras extensões (shape, arrow, sticky, frame...) entram aqui sem quebrar o que existe.
export type CanvasElement = TextElement | ImageElement;

export interface CanvasViewport {
  x: number;
  y: number;
  zoom: number;
}

export interface CanvasData {
  version: number;
  viewport: CanvasViewport;
  elements: CanvasElement[];
}

export function defaultCanvasData(): CanvasData {
  return {
    version: 1,
    viewport: { x: 0, y: 0, zoom: 1 },
    elements: [],
  };
}

export function defaultTextElement(partial: Partial<TextElement> & Pick<TextElement, 'id' | 'x' | 'y'>): TextElement {
  return {
    type: 'text',
    width: 240,
    height: 80,
    content: '',
    fontSize: 16,
    bold: false,
    italic: false,
    align: 'left',
    color: '#1a1a1a',
    ...partial,
  };
}
