import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/layout/Button';
import { PALETTE } from '@/lib/utils/projectColor';
import * as kanbansApi from '@/lib/api/kanban/kanbans';
import type { Kanban } from '@/types/kanban.types';

interface KanbanSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  kanban: Kanban;
  onUpdated: (updated: Kanban) => void;
  onDeleted: () => void;
  onDuplicated: () => void;
}

export default function KanbanSettingsModal({ isOpen, onClose, kanban, onUpdated, onDeleted, onDuplicated }: KanbanSettingsModalProps) {
  const [name, setName] = useState(kanban.name);
  const [description, setDescription] = useState(kanban.description ?? '');
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  async function reloadAndNotify() {
    const fresh = await kanbansApi.getKanbanById(kanban.id);
    if (fresh) onUpdated(fresh);
  }

  async function handleSaveName() {
    if (!name.trim() || name === kanban.name) return;
    await kanbansApi.updateKanban(kanban.id, { name: name.trim() });
    await reloadAndNotify();
  }

  async function handleSaveDescription() {
    if (description === (kanban.description ?? '')) return;
    await kanbansApi.updateKanban(kanban.id, { description: description || null });
    await reloadAndNotify();
  }

  async function handleColorChange(hex: string) {
    await kanbansApi.updateKanban(kanban.id, { color: hex });
    await reloadAndNotify();
  }

  async function handleResetColor() {
    await kanbansApi.updateKanban(kanban.id, { color: null });
    await reloadAndNotify();
  }

  async function handleSetDefault() {
    await kanbansApi.setDefaultKanban(kanban.projectId, kanban.id);
    await reloadAndNotify();
  }

  async function handleToggleArchived() {
    await kanbansApi.updateKanban(kanban.id, { archived: !kanban.archived });
    await reloadAndNotify();
  }

  async function handleDuplicate() {
    await kanbansApi.duplicateKanban(kanban.id);
    onDuplicated();
  }

  async function handleDelete() {
    await kanbansApi.deleteKanban(kanban.id);
    onDeleted();
  }

  return (
    <>
      <Modal open={isOpen} onClose={onClose} title="Configurações do Kanban">
        <div style={{ padding: 16, width: 380, maxWidth: '90vw', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Nome</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={handleSaveName}
              style={{ width: '100%', padding: 8, fontSize: 14 }}
            />
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Descrição</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={handleSaveDescription}
              rows={3}
              style={{ width: '100%', padding: 8, fontSize: 13, resize: 'vertical' }}
            />
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Cor</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <input
                type="color"
                value={kanban.color ?? '#1a73e8'}
                onChange={(e) => handleColorChange(e.target.value)}
                style={{ width: 36, height: 28, padding: 0, border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer' }}
              />
              {kanban.color !== null && (
                <button
                  onClick={handleResetColor}
                  style={{ fontSize: 12, color: '#666', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  usar cor automática
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {PALETTE.map((hex) => (
                <button
                  key={hex}
                  onClick={() => handleColorChange(hex)}
                  title={hex}
                  style={{
                    width: 20, height: 20, borderRadius: '50%', backgroundColor: hex,
                    border: kanban.color === hex ? '2px solid #000' : '1px solid #ccc', cursor: 'pointer', padding: 0,
                  }}
                />
              ))}
            </div>
          </div>

          <div style={{ borderTop: '1px solid #eee', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Button variant="secondary" onClick={handleSetDefault} disabled={kanban.isDefault}>
              {kanban.isDefault ? '⭐ Já é o Kanban padrão deste projeto' : '⭐ Definir como padrão'}
            </Button>
            <Button variant="secondary" onClick={handleToggleArchived}>
              {kanban.archived ? '📤 Desarquivar' : '📥 Arquivar'}
            </Button>
            <Button variant="secondary" onClick={handleDuplicate}>⧉ Duplicar (só estrutura, sem cards)</Button>
          </div>

          <div style={{ borderTop: '1px solid #eee', paddingTop: 12 }}>
            {!confirmingDelete ? (
              <Button variant="danger" onClick={() => setConfirmingDelete(true)}>Excluir Kanban</Button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <p style={{ fontSize: 13, color: '#c62828', margin: 0 }}>
                  Isso apaga as Colunas e a organização deste Kanban. Os Cards têm dados próprios (não são Tasks) e serão apagados junto. Não pode ser desfeito.
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button variant="secondary" onClick={() => setConfirmingDelete(false)}>Cancelar</Button>
                  <Button variant="danger" onClick={handleDelete}>Confirmar exclusão</Button>
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={onClose}>Fechar</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
