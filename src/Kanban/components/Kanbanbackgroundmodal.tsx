import Modal from '@/components/ui/Modal';
import Button from '@/components/layout/Button';
import ImageUploadField from '@/components/ImageUploadField';
import type { Kanban } from '@/types/kanban.types';

interface KanbanBackgroundModalProps {
  isOpen: boolean;
  onClose: () => void;
  kanban: Kanban;
  backgroundColor: string | null;
  backgroundImagePath: string | null;
  onUpdate: (input: Partial<{ backgroundColor: string | null; backgroundImagePath: string | null }>) => void;
}

export default function KanbanBackgroundModal({
  isOpen, onClose, kanban, backgroundColor, backgroundImagePath, onUpdate,
}: KanbanBackgroundModalProps) {
  return (
    <Modal open={isOpen} onClose={onClose} title="Plano de fundo do Kanban">
      <div style={{ padding: 16, width: 380, maxWidth: '90vw', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#666', display: 'block', marginBottom: 6 }}>
            Cor de fundo
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="color"
              value={backgroundColor ?? '#f0f0f0'}
              onChange={(e) => onUpdate({ backgroundColor: e.target.value })}
              style={{ width: 40, height: 32, padding: 0, border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer' }}
            />
            {backgroundColor && (
              <button
                onClick={() => onUpdate({ backgroundColor: null })}
                style={{ fontSize: 12, color: '#c62828', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                Remover cor
              </button>
            )}
          </div>
        </div>

        <div style={{ borderTop: '1px solid #eee', paddingTop: 12 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#666', display: 'block', marginBottom: 4 }}>
            Imagem de fundo
          </label>
          <p style={{ fontSize: 11, color: '#999', margin: '0 0 8px' }}>
            Se definida, a imagem aparece por trás das colunas no lugar da cor.
          </p>
          <ImageUploadField
            entityId={kanban.id}
            currentPath={backgroundImagePath}
            onUploaded={(path) => onUpdate({ backgroundImagePath: path })}
            height={120}
          />
          {backgroundImagePath && (
            <button
              onClick={() => onUpdate({ backgroundImagePath: null })}
              style={{ marginTop: 6, fontSize: 12, color: '#c62828', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              Remover imagem
            </button>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={onClose}>Fechar</Button>
        </div>
      </div>
    </Modal>
  );
}
