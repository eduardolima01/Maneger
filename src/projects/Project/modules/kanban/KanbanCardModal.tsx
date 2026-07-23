import { useEffect, useState } from 'react';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import Modal from '@/components/ui/Modal';
import Button from '@/components/layout/Button';
import { PRIORITY_LABELS } from '@/types/kanban.types';
import type { KanbanCard, TaskPriority } from '@/types/kanban.types';

interface KanbanCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  card: KanbanCard | null;
  onUpdate: (
    id: string,
    input: Parameters<typeof import('@/lib/api/kanban/kanbanCards').updateCard>[1]) => void;
  onDuplicate: (id: string) => void;
  onArchive: (id: string, archived: boolean) => void;
  onRequestDelete: (id: string, title: string) => void;
}

export default function KanbanCardModal({ isOpen, onClose, card, onUpdate, onDuplicate, onArchive, onRequestDelete }: KanbanCardModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [labelInput, setLabelInput] = useState('');

  useEffect(() => {
    if (isOpen && card) {
      setTitle(card.title);
      setDescription(card.description ?? '');
    }
  }, [isOpen, card]);

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
    // reaproveita o mesmo comando Rust já usado pra capa de Projeto — genérico o suficiente (id + path), não é acoplamento com Tasks
    const newPath = await invoke<string>('save_project_cover', { projectId: card?.id, sourcePath: selected });
    onUpdate(card.id, { coverPath: newPath });
  }

  return (
    <Modal open={isOpen} onClose={onClose} title="Detalhes do card">
      <div style={{ padding: 16, width: 1460, maxWidth: '100%', maxHeight: '80vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {card.coverPath && (
          <img src={convertFileSrc(card.coverPath)} style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 6 }} />
        )}
        <Button variant="secondary" onClick={handlePickCover}>{card.coverPath ? 'Trocar capa' : 'Adicionar capa'}</Button>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={saveTitle}
          style={{ fontSize: 18, fontWeight: 600, border: 'none', outline: 'none', padding: '4px 0' }}
        />

        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#666', display: 'block', marginBottom: 4 }}>Descrição (Markdown)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={saveDescription}
            rows={5}
            style={{ width: '100%', padding: 8, fontSize: 13, resize: 'vertical', fontFamily: 'monospace' }}
            placeholder="Suporta sintaxe Markdown (renderização visual ainda não implementada — texto puro por ora)"
          />
        </div>

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
            <label style={{ fontSize: 12, fontWeight: 600, color: '#666', display: 'block', marginBottom: 4 }}>Prazo</label>
            <input
              type="date"
              value={card.dueDate ?? ''}
              onChange={(e) => onUpdate(card.id, { dueDate: e.target.value || null })}
              style={{ width: '100%', padding: 6, fontSize: 13 }}
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

        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #eee', paddingTop: 12 }}>
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
