import { useEffect, useRef } from 'react';
import { Image as KonvaImage, Text as KonvaText, Transformer } from 'react-konva';
import type Konva from 'konva';
import useImage from 'use-image';
import { convertFileSrc } from '@tauri-apps/api/core';
import type { CanvasElement } from '../types/canvas.types';

interface CanvasElementViewProps {
  element: CanvasElement;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (patch: Partial<CanvasElement>) => void;
  onDoubleClickText: () => void;
  onContextMenu: (e: Konva.KonvaEventObject<PointerEvent>) => void;
}

export default function CanvasElementView({
  element, isSelected, onSelect, onChange, onDoubleClickText, onContextMenu,
}: CanvasElementViewProps) {
  const shapeRef = useRef<Konva.Image | Konva.Text>(null);
  const trRef = useRef<Konva.Transformer>(null);

  useEffect(() => {
    if (isSelected && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

  function handleDragEnd(e: Konva.KonvaEventObject<DragEvent>) {
    onChange({ x: e.target.x(), y: e.target.y() });
  }

  function handleTransformEnd() {
    const node = shapeRef.current;
    if (!node) return;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    node.scaleX(1);
    node.scaleY(1);
    onChange({
      x: node.x(),
      y: node.y(),
      width: Math.max(20, node.width() * scaleX),
      height: Math.max(20, node.height() * scaleY),
      rotation: node.rotation(),
    });
  }

  const commonProps = {
    id: element.id,
    x: element.x,
    y: element.y,
    width: element.width,
    height: element.height,
    rotation: element.rotation ?? 0,
    draggable: true,
    onClick: onSelect,
    onTap: onSelect,
    onDragEnd: handleDragEnd,
    onTransformEnd: handleTransformEnd,
    onContextMenu,
  };

  return (
    <>
      {element.type === 'image' ? (
        <ImageShape
          {...commonProps}
          src={element.src}
          shapeRef={shapeRef as React.RefObject<Konva.Image>}
        />
      ) : (
        <KonvaText
          {...commonProps}
          ref={shapeRef as React.RefObject<Konva.Text>}
          text={element.content || 'Duplo clique para editar...'}
          fontSize={element.fontSize}
          fontStyle={`${element.bold ? 'bold' : ''} ${element.italic ? 'italic' : ''}`.trim() || 'normal'}
          align={element.align}
          fill={element.content ? element.color : '#bbb'}
          onDblClick={onDoubleClickText}
          onDblTap={onDoubleClickText}
        />
      )}

      {isSelected && (
        <Transformer
          ref={trRef}
          rotateEnabled
          boundBoxFunc={(oldBox, newBox) => (newBox.width < 20 || newBox.height < 20 ? oldBox : newBox)}
        />
      )}
    </>
  );
}

interface ImageShapeProps {
  src: string;
  shapeRef: React.RefObject<Konva.Image>;
  [key: string]: unknown;
}

function ImageShape({ src, shapeRef, ...props }: ImageShapeProps) {
  const [img] = useImage(convertFileSrc(src));
  return <KonvaImage {...props} image={img} ref={shapeRef} />;
}
