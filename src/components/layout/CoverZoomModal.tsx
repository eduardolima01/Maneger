import { useEffect, useState } from 'react';

interface CoverZoomModalProps {
  src: string;
  onClose: () => void;
}

export default function CoverZoomModal({ src, onClose }: CoverZoomModalProps) {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  function handleWheel(e: React.WheelEvent) {
    e.preventDefault();
    setScale((s) => Math.min(4, Math.max(1, s - e.deltaY * 0.001)));
  }

  return (
    <div
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, overflow: 'hidden',
      }}
    >
      <img
        src={src}
        onWheel={handleWheel}
        onDoubleClick={() => setScale(1)}
        style={{
          maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain',
          transform: `scale(${scale})`, cursor: scale > 1 ? 'zoom-out' : 'zoom-in',
        }}
      />
      <button
        onClick={onClose}
        style={{ position: 'fixed', top: 16, right: 16, fontSize: 20, color: '#fff', background: 'none', border: 'none', cursor: 'pointer' }}
      >
        ✕
      </button>
      <p style={{ position: 'fixed', bottom: 16, fontSize: 12, color: '#ccc' }}>
        Scroll para zoom · duplo clique reseta · Esc para fechar
      </p>
    </div>
  );
}
