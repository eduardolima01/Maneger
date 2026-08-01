import KanbanBoardModal from './KanbanBoardModal';
import { getKanbanById } from '@/lib/api/kanban/kanbans';
import { closeGlobalKanbanModal, openGlobalKanbanModal, useGlobalKanbanModal } from './globalKanbanModal';

export default function GlobalKanbanModalHost() {
  const kanban = useGlobalKanbanModal();

  return (
    <KanbanBoardModal
      isOpen={kanban !== null}
      onClose={closeGlobalKanbanModal}
      kanban={kanban}
      onKanbanChanged={() => {
        if (kanban) getKanbanById(kanban.id).then(openGlobalKanbanModal);
      }}
      onKanbanDeleted={closeGlobalKanbanModal}
    />
  );
}
