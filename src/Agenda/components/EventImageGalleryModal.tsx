import { useState } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import Modal from '@/components/ui/Modal';

interface EventImageGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  images: string[]; // paths brutos, sem convertFileSrc ainda
  title?: string;
}

export default function EventImageGalleryModal({ isOpen, onClose, images, title }: EventImageGalleryModalProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  if (images.length === 0) return null;
  const safeIndex = Math.min(activeIndex, images.length - 1);

  return (
    <Modal open={isOpen} onClose={onClose} title={title ?? 'Imagens do evento'}>
      <div style={{ padding: 16, maxWidth: '90vw', width: 560, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ width: '100%', height: 360, backgroundColor: '#111', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          <img src={convertFileSrc(images[safeIndex])} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
        </div>

        {images.length > 1 && (
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
            {images.map((path, i) => (
              <button
                key={path + i}
                onClick={() => setActiveIndex(i)}
                style={{
                  width: 56, height: 56, flexShrink: 0, padding: 0, borderRadius: 4, overflow: 'hidden',
                  border: i === safeIndex ? '2px solid #1a73e8' : '1px solid #ddd', cursor: 'pointer',
                }}
              >
                <img src={convertFileSrc(path)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </button>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
