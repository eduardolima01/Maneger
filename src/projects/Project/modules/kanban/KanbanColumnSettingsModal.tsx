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
import ImageUploadField from '@/components/ImageUploadField';
import type { KanbanColumn } from '@/types/kanban.types';

interface ColumnRowProps {
  column: KanbanColumn;
  onUpdate: (input: Partial<{ name: string; wipLimit: number | null; visible: boolean; color: string | null; coverPath: string | null }>) => void;
  onDuplicate: () => void;
  onRequestDelete: () => void;
}

function ColumnRow({ column, onUpdate, onDuplicate, onRequestDelete }: ColumnRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: column.id });
  const [nameDraft, setNameDraft] = useState(column.name);
  const [showCoverEditor, setShowCoverEditor] = useState(false);

  const style: React.CSSProperties = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <div ref={setNodeRef} className="border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100" style={{ ...style, borderRadius: 4, padding: '6px 8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span {...attributes} {...listeners} className="text-neutral-400 dark:text-neutral-500" style={{ fontSize: 12, cursor: 'grab', touchAction: 'none' }} title="Arrastar">⠿</span>

        <input
          value={nameDraft}
          onChange={(e) => setNameDraft(e.target.value)}
          onBlur={() => nameDraft.trim() && nameDraft !== column.name && onUpdate({ name: nameDraft.trim() })}
          className="bg-transparent text-neutral-900 dark:text-neutral-100"
          style={{ flex: 1, fontSize: 13, border: 'none', outline: 'none' }}
        />

        <input
          type="color"
          value={column.color ?? '#cccccc'}
          onChange={(e) => onUpdate({ color: e.target.value })}
          className="border border-neutral-300 dark:border-neutral-600" style={{ width: 24, height: 24, padding: 0, borderRadius: 4, cursor: 'pointer' }}
        />

        <input
          type="number"
          min={0}
          placeholder="WIP"
          value={column.wipLimit ?? ''}
          onChange={(e) => onUpdate({ wipLimit: e.target.value === '' ? null : Number(e.target.value) })}
          className="bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 dark:border-neutral-600 dark:[color-scheme:dark]" style={{ width: 50, fontSize: 12, padding: 4 }}
        />

        <label style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 11 }}>
          <input type="checkbox" checked={column.visible} onChange={(e) => onUpdate({ visible: e.target.checked })} />
          vis.
        </label>

        <button
          onClick={() => setShowCoverEditor((v) => !v)}
          title="Capa da coluna"
          style={{
            border: 'none', background: 'none', cursor: 'pointer', fontSize: 13,
            opacity: column.coverPath ? 1 : 0.4,
          }}
        >
          🖼️
        </button>

        <button onClick={onDuplicate} title="Duplicar" style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 12 }}>⧉</button>
        <button onClick={onRequestDelete} className="text-red-600 dark:text-red-400" style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 12 }}>✕</button>
      </div>

      {showCoverEditor && (
        <div className="border-t border-dashed border-neutral-200 dark:border-neutral-700" style={{ marginTop: 8, paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label className="text-neutral-500 dark:text-neutral-400" style={{ fontSize: 11, fontWeight: 600 }}>Capa da coluna (aparece no calendário)</label>
          <ImageUploadField
            entityId={column.id}
            currentPath={column.coverPath}
            onUploaded={(path) => onUpdate({ coverPath: path })}
            height={80}
          />
          {column.coverPath && (
            <button
              onClick={() => onUpdate({ coverPath: null })}
              className="text-red-600 dark:text-red-400"
              style={{ alignSelf: 'flex-start', fontSize: 11, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              Remover capa
            </button>
          )}
        </div>
      )}
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
        <div className="text-neutral-900 dark:text-neutral-100" style={{ padding: 16, width: 460, maxWidth: '90vw', maxHeight: '70vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
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

          <div className="border-t border-neutral-200 dark:border-neutral-700" style={{ display: 'flex', gap: 6, paddingTop: 12 }}>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && newName.trim() && (onCreate(newName.trim()), setNewName(''))}
              placeholder="Nome da nova coluna..."
              className="bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 dark:border-neutral-600 dark:[color-scheme:dark]"
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
