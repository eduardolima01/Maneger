import { useState } from 'react';
import {
  DndContext, PointerSensor, useSensor, useSensors, closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Modal from '@/components/ui/Modal';
import Button from '@/components/layout/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import type { KanbanColumn } from '@/types/kanban.types';

interface ColumnRowProps {
  column: KanbanColumn;
  onUpdate: (input: Partial<{ name: string; wipLimit: number | null; visible: boolean; color: string | null }>) => void;
  onDuplicate: () => void;
  onRequestDelete: () => void;
}

function ColumnRow({ column, onUpdate, onDuplicate, onRequestDelete }: ColumnRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: column.id });
  const [nameDraft, setNameDraft] = useState(column.name);

  const style: React.CSSProperties = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <div ref={setNodeRef} style={{ ...style, display: 'flex', alignItems: 'center', gap: 6, border: '1px solid #eee', borderRadius: 4, padding: '6px 8px' }}>
      <span {...attributes} {...listeners} style={{ color: '#bbb', fontSize: 12, cursor: 'grab', touchAction: 'none' }} title="Arrastar">⠿</span>

      <input
        value={nameDraft}
        onChange={(e) => setNameDraft(e.target.value)}
        onBlur={() => nameDraft.trim() && nameDraft !== column.name && onUpdate({ name: nameDraft.trim() })}
        style={{ flex: 1, fontSize: 13, border: 'none', outline: 'none' }}
      />

      <input
        type="color"
        value={column.color ?? '#cccccc'}
        onChange={(e) => onUpdate({ color: e.target.value })}
        style={{ width: 24, height: 24, padding: 0, border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer' }}
      />

      <input
        type="number"
        min={0}
        placeholder="WIP"
        value={column.wipLimit ?? ''}
        onChange={(e) => onUpdate({ wipLimit: e.target.value === '' ? null : Number(e.target.value) })}
        style={{ width: 50, fontSize: 12, padding: 4 }}
      />

      <label style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 11 }}>
        <input type="checkbox" checked={column.visible} onChange={(e) => onUpdate({ visible: e.target.checked })} />
        vis.
      </label>

      <button onClick={onDuplicate} title="Duplicar" style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 12 }}>⧉</button>
      <button onClick={onRequestDelete} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#c62828', fontSize: 12 }}>✕</button>
    </div>
  );
}

interface KanbanColumnSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  columns: KanbanColumn[];
  onCreate: (name: string) => void;
  onUpdate: (id: string, input: Parameters<ColumnRowProps['onUpdate']>[0]) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onReorder: (orderedIds: string[]) => void;
}

export default function KanbanColumnSettingsModal({
  isOpen, onClose, columns, onCreate, onUpdate, onDuplicate, onDelete, onReorder,
}: KanbanColumnSettingsModalProps) {
  const [newName, setNewName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = columns.map((c) => c.id);
    const fromIndex = ids.indexOf(active.id as string);
    const toIndex = ids.indexOf(over.id as string);
    if (fromIndex === -1 || toIndex === -1) return;
    onReorder(arrayMove(ids, fromIndex, toIndex));
  }

  return (
    <>
      <Modal open={isOpen} onClose={onClose} title="Colunas do Kanban">
        <div style={{ padding: 16, width: 460, maxWidth: '90vw', maxHeight: '70vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={columns.map((c) => c.id)} strategy={verticalListSortingStrategy}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {columns.map((c) => (
                  <ColumnRow
                    key={c.id}
                    column={c}
                    onUpdate={(input) => onUpdate(c.id, input)}
                    onDuplicate={() => onDuplicate(c.id)}
                    onRequestDelete={() => setDeleteTarget({ id: c.id, name: c.name })}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          <div style={{ display: 'flex', gap: 6, borderTop: '1px solid #eee', paddingTop: 12 }}>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && newName.trim() && (onCreate(newName.trim()), setNewName(''))}
              placeholder="Nome da nova coluna..."
              style={{ flex: 1, padding: 8, fontSize: 13 }}
            />
            <Button variant="primary" onClick={() => { if (newName.trim()) { onCreate(newName.trim()); setNewName(''); } }}>
              + Coluna
            </Button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={onClose}>Fechar</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Excluir coluna?"
        message={`Deseja realmente excluir "${deleteTarget?.name}"? Os cards dela deixam de aparecer neste Kanban (a Task em si não é apagada). Esta ação não pode ser desfeita.`}
        onConfirm={() => { if (deleteTarget) onDelete(deleteTarget.id); setDeleteTarget(null); }}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}

