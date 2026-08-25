import { useEffect, useRef } from 'react';

interface ImagePasteConfirmModalProps {
  previewUrl: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ImagePasteConfirmModal({ previewUrl, onConfirm, onCancel }: ImagePasteConfirmModalProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.code === 'Space') { e.preventDefault(); onConfirm(); }
      if (e.key === 'Escape') onCancel();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onConfirm, onCancel]);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000,
      }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div ref={ref} style={{ backgroundColor: '#fff', borderRadius: 8, padding: 16, maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>Colar essa imagem no card?</p>
        <img src={previewUrl} style={{ width: '100%', maxHeight: 240, objectFit: 'contain', borderRadius: 4, backgroundColor: '#f5f5f5' }} />
        <p style={{ fontSize: 11, color: '#999', margin: 0 }}>Espaço para confirmar · Esc para cancelar</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onCancel} style={{ fontSize: 12, padding: '6px 12px', border: '1px solid #ddd', borderRadius: 4, background: '#fff', cursor: 'pointer' }}>
            Cancelar
          </button>
          <button onClick={onConfirm} style={{ fontSize: 12, padding: '6px 12px', border: 'none', borderRadius: 4, background: '#1a73e8', color: '#fff', cursor: 'pointer' }}>
            Colar
          </button>
        </div>
      </div>
    </div>
  );
}
