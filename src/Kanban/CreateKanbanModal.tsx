import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/layout/Button';
import ProjectSearchSelect from '@/Projects/components/ProjectSearchSelect';
import { createKanban } from '@/lib/api/kanban/kanbans';

interface CreateKanbanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export default function CreateKanbanModal({ isOpen, onClose, onCreated }: CreateKanbanModalProps) {
  const [projectId, setProjectId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetAndClose() {
    setProjectId(null);
    setName('');
    setError(null);
    onClose();
  }

  async function handleCreate() {
    if (!projectId || !name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await createKanban({ projectId, name: name.trim() });
      onCreated();
      resetAndClose();
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={isOpen} onClose={resetAndClose} title="Novo Kanban">
      <div className="text-neutral-900 dark:text-neutral-100" style={{ padding: 16, width: "100%", height: '300px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label className="text-neutral-500 dark:text-neutral-400" style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Projeto ou subprojeto</label>
          <ProjectSearchSelect value={projectId} onChange={(id) => setProjectId(id)} />
        </div>

        <div>
          <label className="text-neutral-500 dark:text-neutral-400" style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Nome do Kanban</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="Ex: Sprint Atual"
            className="bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 dark:border-neutral-600 dark:[color-scheme:dark]" style={{ width: '100%', padding: 8, fontSize: 14 }}
          />
        </div>

        {error && <p className="text-red-600 dark:text-red-400" style={{ fontSize: 12 }}>{error}</p>}

      </div>
      <div className="border-t border-neutral-200 dark:border-neutral-700" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 12 }}>
        <Button variant="secondary" onClick={resetAndClose}>Cancelar</Button>
        <Button variant="primary" onClick={handleCreate} disabled={saving || !projectId || !name.trim()}>
          {saving ? 'Criando...' : 'Criar'}
        </Button>
      </div>
    </Modal>
  );
}
