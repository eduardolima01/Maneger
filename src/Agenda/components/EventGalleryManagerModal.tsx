import Modal from '@/components/ui/Modal';
import Button from '@/components/layout/Button';
import ImageUploadField from '@/components/ImageUploadField';
import { useEventGallery } from '../hooks/useEventGallery';

interface EventGalleryManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  defaultDate: string;
  onChanged?: () => void;
}

export default function EventGalleryManagerModal({ isOpen, onClose, projectId, defaultDate, onChanged }: EventGalleryManagerModalProps) {
  const { images, loading, addImage, updateImage, removeImage } = useEventGallery(isOpen ? projectId : null);

  async function handleAdd() {
    await addImage(defaultDate);
    onChanged?.();
  }

  return (
    <Modal open={isOpen} onClose={onClose} title="Galeria de imagens do projeto">
      <div style={{ padding: 16, maxWidth: '90vw', width: 480, maxHeight: '80vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p style={{ fontSize: 12, color: '#666', margin: 0 }}>
          Cada imagem tem uma data. Eventos da Agenda com a mesma data podem usar essa imagem como capa.
        </p>

        {loading && <p style={{ fontSize: 12, color: '#999' }}>Carregando...</p>}

        {!loading && images.map((img) => (
          <div key={img.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', border: '1px solid #eee', borderRadius: 6, padding: 8 }}>
            <ImageUploadField
              entityId={img.id}
              currentPath={img.path || null}
              onUploaded={(path) => { updateImage(img.id, { path }); onChanged?.(); }}
              height={64}
            />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <input
                type="date"
                value={img.date}
                onChange={(e) => { updateImage(img.id, { date: e.target.value }); onChanged?.(); }}
                style={{ padding: 4, fontSize: 12 }}
              />
              <input
                value={img.label ?? ''}
                onChange={(e) => updateImage(img.id, { label: e.target.value })}
                placeholder="Rótulo opcional..."
                style={{ padding: 4, fontSize: 12 }}
              />
            </div>
            <button
              onClick={() => { removeImage(img.id); onChanged?.(); }}
              title="Remover imagem"
              style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#c62828', fontSize: 14 }}
            >
              🗑
            </button>
          </div>
        ))}

        {!loading && images.length === 0 && (
          <p style={{ fontSize: 12, color: '#bbb', fontStyle: 'italic' }}>Nenhuma imagem ainda.</p>
        )}

        <Button variant="secondary" onClick={handleAdd}>+ Nova imagem ({defaultDate})</Button>

        <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #eee', paddingTop: 12 }}>
          <Button variant="secondary" onClick={onClose}>Fechar</Button>
        </div>
      </div>
    </Modal>
  );
}
