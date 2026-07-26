import Modal from '@/components/ui/Modal';
import Button from '@/components/layout/Button';
import type { Kanban } from '@/types/kanban.types';
import KanbanBoard from '@/Projects/Project/modules/kanban/KanbanBoard';
import { useState } from 'react';
import KanbanSettingsModal from './KanbanSettingsModal';

interface KanbanBoardModalProps {
  isOpen: boolean;
  onClose: () => void;
  kanban: Kanban | null;
  onKanbanChanged: () => void; // avisa a galeria pra recarregar (nome/cor/arquivado mudaram)
  onKanbanDeleted: () => void; // avisa a galeria pra recarregar e fecha o board
}

export default function KanbanBoardModal({ isOpen, onClose, kanban, onKanbanChanged, onKanbanDeleted }: KanbanBoardModalProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [localKanban, setLocalKanban] = useState<Kanban | null>(kanban);

  if (kanban && localKanban?.id !== kanban.id) setLocalKanban(kanban); // sincroniza quando a galeria abre um kanban diferente
  if (!kanban) return null;
  const displayKanban = localKanban ?? kanban;

  return (
    <Modal open={isOpen} onClose={onClose} title={displayKanban.name}>
      <div style={{ padding: 16, width: '90vw', maxWidth: "100%", maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
          <Button variant="secondary" onClick={() => setSettingsOpen(true)}>⚙ Configurações do Kanban</Button>
        </div>

        <KanbanBoard kanban={displayKanban} />

        <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #eee', paddingTop: 12, marginTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #eee', paddingTop: 12, marginTop: 12 }}>
            <Button variant="secondary" onClick={onClose}>Fechar</Button>
          </div>
        </div>
      </div>

      <KanbanSettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        kanban={displayKanban}
        onUpdated={(updated) => {
          setLocalKanban(updated);
          onKanbanChanged();
        }}
        onDeleted={() => {
          setSettingsOpen(false);
          onClose();
          onKanbanDeleted();
        }}
        onDuplicated={() => {
          setSettingsOpen(false);
          onKanbanChanged();
        }}
      />
    </Modal>
  );
}
