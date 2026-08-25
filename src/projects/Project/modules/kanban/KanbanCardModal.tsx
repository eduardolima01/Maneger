import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import Modal from '@/components/ui/Modal';
import Button from '@/components/layout/Button';
import { createKanban, getSubKanbanByCardId, getKanbanById } from '@/lib/api/kanban/kanbans';
import { PRIORITY_LABELS } from '@/types/kanban.types';
import type { KanbanCard, TaskPriority, Kanban } from '@/types/kanban.types';
import KanbanBoard from './KanbanBoard';
import MarkdownField from '@/components/ui/MarkdownField';
import ChecklistSection from '@/Kanban/ChecklistSection';
import ImageUploadField from '@/components/ImageUploadField';

type Tab = 'details' | 'meta';

interface KanbanCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  card: KanbanCard | null;
  onUpdate: (id: string, input: Parameters<typeof import('@/lib/api/kanban/kanbanCards').updateCard>[1]) => void;
  onDuplicate: (id: string) => void;
  onArchive: (id: string, archived: boolean) => void;
  onRequestDelete: (id: string, title: string) => void;
}

export default function KanbanCardModal({ isOpen, onClose, card, onUpdate, onDuplicate, onArchive, onRequestDelete }: KanbanCardModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>('details');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [labelInput, setLabelInput] = useState('');

  const [subKanban, setSubKanban] = useState<Kanban | null>(null);
  const [loadingSubKanban, setLoadingSubKanban] = useState(false);

  useEffect(() => {
    if (isOpen && card) {
      setTitle(card.title);
      setDescription(card.description ?? '');
      setActiveTab('details');
    }
  }, [isOpen, card]);

  useEffect(() => {
    if (isOpen && card) {
      setLoadingSubKanban(true);
      getSubKanbanByCardId(card.id).then((k) => {
        setSubKanban(k);
        setLoadingSubKanban(false);
      });
    } else {
      setSubKanban(null);
    }
  }, [isOpen, card?.id]);

  if (!card) return null;

  function saveTitle() {
    if (title.trim() && title !== card!.title) onUpdate(card!.id, { title: title.trim() });
  }

  function saveDescription() {
    if (description !== (card!.description ?? '')) onUpdate(card!.id, { description });
  }

  function addLabel() {
    const value = labelInput.trim();
    if (!value || card!.labels.includes(value)) return;
    onUpdate(card!.id, { labels: [...card!.labels, value] });
    setLabelInput('');
  }

  function removeLabel(label: string) {
    onUpdate(card!.id, { labels: card!.labels.filter((l) => l !== label) });
  }

  async function handlePickCover() {
    const selected = await open({ multiple: false, filters: [{ name: 'Imagens', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }] });
    if (!selected || Array.isArray(selected)) return;
    if (card) {
      const newPath = await invoke<string>('save_project_cover', { projectId: card.id, sourcePath: selected });
      onUpdate(card.id, { coverPath: newPath });
    }
  }

  async function handleCreateSubKanban() {
    if (!card) return;
    if (!card.kanbanId) return; // card sem kanban direto (ex: dentro de um grupo) não tem "kanban pai" nesse sentido
    const parentKanban = await getKanbanById(card.kanbanId);

    if (!parentKanban) return;
    const id = await createKanban({
      projectId: parentKanban.projectId,
      parentCardId: card.id,
      name: `${card.title} — subtarefas`,
    });
    const created = await getKanbanById(id);
    setSubKanban(created);
  }

  return (
    <Modal open={isOpen} onClose={onClose} title="Detalhes do card">
      <div style={{ padding: 16, maxWidth: '92vw', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e0e0e0', marginBottom: 12 }}>
          {(['details', 'meta'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '8px 14px', fontSize: 13, fontWeight: 600, background: 'none', border: 'none',
                borderBottom: activeTab === tab ? '2px solid #1a73e8' : '2px solid transparent',
                color: activeTab === tab ? '#1a73e8' : '#666', cursor: 'pointer',
              }}
            >
              {tab === 'details' ? 'Detalhes' : 'Propriedades'}
            </button>
          ))}
        </div>

        <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {activeTab === 'details' ? (
            <>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={saveTitle}
                style={{ fontSize: 18, fontWeight: 600, border: 'none', outline: 'none', padding: '4px 0' }}
              />

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#666', display: 'block', marginBottom: 4 }}>Descrição (Markdown)</label>
                <MarkdownField
                  value={description}
                  onChange={setDescription}
                  onBlur={saveDescription}
                  rows={6}
                />
              </div>

              <div style={{ borderTop: '1px solid #eee', paddingTop: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#666', display: 'block', marginBottom: 6 }}>Sub-kanban</label>
                {loadingSubKanban && <p style={{ fontSize: 12, color: '#999' }}>Verificando...</p>}

                {!loadingSubKanban && subKanban && (
                  <div style={{ border: '1px solid #eee', borderRadius: 6, padding: 8, backgroundColor: '#fafafa' }}>
                    <KanbanBoard kanban={subKanban} />
                  </div>
                )}

                {!loadingSubKanban && !subKanban && (
                  <Button variant="secondary" onClick={handleCreateSubKanban}>
                    + Criar sub-kanban pra dividir esse card
                  </Button>
                )}
              </div>

              <div style={{ borderTop: '1px solid #eee', paddingTop: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#666', display: 'block', marginBottom: 6 }}>Lista de tarefas</label>
                <ChecklistSection cardId={card.id} />
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#666', display: 'block', marginBottom: 4 }}>Data inicial</label>
                  <input
                    type="date"
                    value={card.startDate ?? ''}
                    onChange={(e) => onUpdate(card.id, { startDate: e.target.value || null })}
                    style={{ width: '100%', padding: 6, fontSize: 13 }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#666', display: 'block', marginBottom: 4 }}>Definir data do card</label>
                  <input
                    type="date"
                    value={card.dueDate ?? ''}
                    onChange={(e) => onUpdate(card.id, { dueDate: e.target.value || null })}
                    style={{ width: '100%', padding: 6, fontSize: 13 }}
                  />
                </div>
              </div>

            </>
          ) : (
            <>
              <ImageUploadField
                entityId={card.id}
                currentPath={card.coverPath}
                onUploaded={(path) => onUpdate(card.id, { coverPath: path })}
                height={120}
              />
              <Button variant="secondary" onClick={handlePickCover}>{card.coverPath ? 'Trocar capa' : 'Adicionar capa'}</Button>

              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#666', display: 'block', marginBottom: 4 }}>Prioridade</label>
                  <select
                    value={card.priority ?? ''}
                    onChange={(e) => onUpdate(card.id, { priority: (e.target.value || null) as TaskPriority | null })}
                    style={{ width: '100%', padding: 6, fontSize: 13 }}
                  >
                    <option value="">Nenhuma</option>
                    {(Object.keys(PRIORITY_LABELS) as TaskPriority[]).map((p) => (
                      <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
                    ))}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#666', display: 'block', marginBottom: 4 }}>Cor</label>
                  <input
                    type="color"
                    value={card.color ?? '#cccccc'}
                    onChange={(e) => onUpdate(card.id, { color: e.target.value })}
                    style={{ width: '100%', height: 30, padding: 0, border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#666', display: 'block', marginBottom: 4 }}>Etiquetas</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                  {card.labels.map((l) => (
                    <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 4, backgroundColor: '#eef2ff', color: '#4338ca', borderRadius: 3, padding: '2px 6px', fontSize: 11 }}>
                      {l}
                      <button onClick={() => removeLabel(l)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#4338ca', fontSize: 10, padding: 0 }}>✕</button>
                    </span>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    value={labelInput}
                    onChange={(e) => setLabelInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addLabel()}
                    placeholder="Nova etiqueta..."
                    style={{ flex: 1, padding: 6, fontSize: 12 }}
                  />
                  <Button variant="secondary" onClick={addLabel}>+ Adicionar</Button>
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#999', display: 'block', marginBottom: 4 }}>Responsável, comentários e anexos</label>
                <p style={{ fontSize: 12, color: '#bbb', margin: 0, fontStyle: 'italic' }}>Em breve.</p>
              </div>
            </>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #eee', paddingTop: 12, marginTop: 12 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="danger" onClick={() => onRequestDelete(card.id, card.title)}>Excluir</Button>
            <Button variant="secondary" onClick={() => onDuplicate(card.id)}>Duplicar</Button>
            <Button variant="secondary" onClick={() => onArchive(card.id, !card.archived)}>
              {card.archived ? 'Desarquivar' : 'Arquivar'}
            </Button>
          </div>
          <Button variant="secondary" onClick={onClose}>Fechar</Button>
        </div>
      </div>
    </Modal>
  );
}
