import { useState } from 'react';
// TODO: confirmar caminho real de CreateProjects.tsx no projeto (assumido em Projects/components/)
import CreateProjects from '@/Projects/components/CreateProjects';
// TODO: confirmar caminho real de CreateKanbanModal.tsx no projeto
import Button from '@/components/layout/Button';
import CreateKanbanModal from '@/Kanban/CreateKanbanModal';

interface FrequentActionsSectionProps {
  /** Mesma função `add` de useProjects() — reaproveitada, sem duplicar lógica de criação. */
  onCreateProject: (name: string) => Promise<void>;
  /** Disparado quando um Kanban é criado, pra seção de Kanban recarregar a lista. */
  onKanbanCreated: () => void;
}

export default function FrequentActionsSection({ onCreateProject, onKanbanCreated }: FrequentActionsSectionProps) {
  const [kanbanModalOpen, setKanbanModalOpen] = useState(false);

  return (
    <div>
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Ações Frequentes</h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-start' }}>
        <CreateProjects onCreate={onCreateProject} />
        <Button variant="secondary" onClick={() => setKanbanModalOpen(true)}>
          + Novo Kanban
        </Button>
      </div>

      <CreateKanbanModal
        isOpen={kanbanModalOpen}
        onClose={() => setKanbanModalOpen(false)}
        onCreated={() => { setKanbanModalOpen(false); onKanbanCreated(); }}
      />
    </div>
  );
}
