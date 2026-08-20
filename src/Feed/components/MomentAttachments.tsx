import { convertFileSrc } from '@tauri-apps/api/core';
import type { Attachment } from '../types/feed.types';

interface MomentAttachmentsProps {
  attachments: Attachment[];
  onRemove?: (id: string) => void;
}

export default function MomentAttachments({ attachments, onRemove }: MomentAttachmentsProps) {
  if (attachments.length === 0) return null;

  const count = attachments.length;
  // 1 imagem: ocupa a largura toda. 2: lado a lado. 3+: grid 3 colunas.
  const columns = count === 1 ? 1 : count === 2 ? 2 : 3;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: 6, marginTop: 8 }}>
      {attachments.map((a) => (
        <div key={a.id} style={{ position: 'relative', borderRadius: 6, overflow: 'hidden', background: '#eee' }}>
          <img
            src={convertFileSrc(a.path)}
            style={{ width: '100%', height: count === 1 ? 220 : 120, objectFit: 'cover', display: 'block' }}
          />
          {onRemove && (
            <button
              onClick={() => onRemove(a.id)}
              style={{
                position: 'absolute', top: 4, right: 4, border: 'none', borderRadius: '50%',
                width: 20, height: 20, background: 'rgba(0,0,0,0.6)', color: '#fff', cursor: 'pointer', fontSize: 12,
              }}
            >
              ✕
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
