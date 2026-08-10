interface CanvasToolbarProps {
  zoomPercent: number;
  canUndo: boolean;
  canRedo: boolean;
  onAddText: () => void;
  onImportImage: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
}

const btnStyle: React.CSSProperties = {
  border: '1px solid #e5e7eb', borderRadius: 6, padding: '6px 10px', fontSize: 13,
  background: '#fff', cursor: 'pointer',
};

export default function CanvasToolbar({
  zoomPercent, canUndo, canRedo, onAddText, onImportImage, onUndo, onRedo, onZoomIn, onZoomOut, onResetZoom,
}: CanvasToolbarProps) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px',
      borderBottom: '1px solid #eee', background: '#fafafa',
    }}>
      <h1 style={{ fontSize: 15, fontWeight: 700, margin: 0, marginRight: 8 }}>Canvas</h1>

      <button style={btnStyle} onClick={onAddText}>+ Texto</button>
      <button style={btnStyle} onClick={onImportImage}>+ Imagem</button>

      <div style={{ width: 1, height: 20, background: '#ddd', margin: '0 4px' }} />

      <button style={{ ...btnStyle, opacity: canUndo ? 1 : 0.4 }} onClick={onUndo} disabled={!canUndo} title="Desfazer (Ctrl+Z)">↶</button>
      <button style={{ ...btnStyle, opacity: canRedo ? 1 : 0.4 }} onClick={onRedo} disabled={!canRedo} title="Refazer (Ctrl+Shift+Z)">↷</button>

      <div style={{ width: 1, height: 20, background: '#ddd', margin: '0 4px' }} />

      <button style={btnStyle} onClick={onZoomOut} title="Zoom out (Ctrl -)">−</button>
      <span style={{ fontSize: 13, color: '#666', width: 44, textAlign: 'center' }}>{zoomPercent}%</span>
      <button style={btnStyle} onClick={onZoomIn} title="Zoom in (Ctrl +)">+</button>
      <button style={btnStyle} onClick={onResetZoom} title="Reset zoom (Ctrl 0)">100%</button>
    </div>
  );
}
