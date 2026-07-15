import { useState } from 'react';

import {
  DndContext, PointerSensor, useSensor, useSensors, closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import SortableFieldRow from './SortableFieldRow';
import TemplatePreviewTable from './TemplatePreviewTable';

import Modal from '@/components/ui/Modal';
import Button from '@/components/layout/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { FIELD_TYPE_LABELS, OPTION_BASED_FIELD_TYPES } from '@/types/template.types';
import type { Template, FieldType, TemplateField } from '@/types/template.types';

interface TemplateEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  template: Template;
  onAddField: (input: { key: string; label: string; type: FieldType; required: boolean; options: { value: string; label: string }[] }) => void;
  onUpdateField: (id: string, input: Partial<{ label: string; required: boolean; options: { value: string; label: string }[] }>) => void;
  onRemoveField: (id: string) => void;
  onReorderFields: (orderedIds: string[]) => void;
}

export default function TemplateEditorModal({
  isOpen, onClose, template, onAddField, onUpdateField, onRemoveField, onReorderFields,
}: TemplateEditorModalProps) {
  const [newKey, setNewKey] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newType, setNewType] = useState<FieldType>('text');
  const [newRequired, setNewRequired] = useState(false);
  const [newOptionsText, setNewOptionsText] = useState(''); // "Opção 1, Opção 2" — simples de propósito
  const [fieldToDelete, setFieldToDelete] = useState<TemplateField | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  function parseOptions(text: string) {
    return text.split(',').map((s) => s.trim()).filter(Boolean).map((label) => ({ value: label.toLowerCase().replace(/\s+/g, '_'), label }));
  }

  function handleAddField() {
    if (!newKey.trim() || !newLabel.trim()) return;
    onAddField({
      key: newKey.trim(),
      label: newLabel.trim(),
      type: newType,
      required: newRequired,
      options: OPTION_BASED_FIELD_TYPES.includes(newType) ? parseOptions(newOptionsText) : [],
    });
    setNewKey('');
    setNewLabel('');
    setNewRequired(false);
    setNewOptionsText('');
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const ids = template.fields.map((f) => f.id);
    const fromIndex = ids.indexOf(active.id as string);
    const toIndex = ids.indexOf(over.id as string);
    if (fromIndex === -1 || toIndex === -1) return;

    onReorderFields(arrayMove(ids, fromIndex, toIndex));
  }

  return (
    <>
      <Modal open={isOpen} onClose={onClose}>
        <div style={{ padding: 16, width: 480, maxWidth: '90vw', maxHeight: '80vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h3 style={{ margin: 0 }}>Campos de "{template.name}"</h3>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={template.fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {template.fields.map((f) => (
                  <SortableFieldRow
                    key={f.id}
                    field={f}
                    onUpdate={(input) => onUpdateField(f.id, input)}
                    onRequestDelete={() => setFieldToDelete(f)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          <div>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#666', display: 'block', marginBottom: 4 }}>Preview da tabela</span>
            <TemplatePreviewTable fields={template.fields} />
          </div>

          <div style={{ borderTop: '1px solid #eee', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#666' }}>Novo campo</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Rótulo (ex: Exercício)" style={{ flex: 1, padding: 6, fontSize: 13 }} />
              <input value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="chave (ex: exercise)" style={{ flex: 1, padding: 6, fontSize: 13 }} />
            </div>
            <select value={newType} onChange={(e) => setNewType(e.target.value as FieldType)} style={{ padding: 6, fontSize: 13 }}>
              {Object.entries(FIELD_TYPE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            {OPTION_BASED_FIELD_TYPES.includes(newType) && (
              <input
                value={newOptionsText}
                onChange={(e) => setNewOptionsText(e.target.value)}
                placeholder="Opções separadas por vírgula (ex: Baixa, Média, Alta)"
                style={{ padding: 6, fontSize: 13 }}
              />
            )}
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
              <input type="checkbox" checked={newRequired} onChange={(e) => setNewRequired(e.target.checked)} />
              Campo obrigatório
            </label>
            <Button variant="secondary" onClick={handleAddField}>+ Adicionar campo</Button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #eee', paddingTop: 12 }}>
            <Button variant="secondary" onClick={onClose}>Fechar</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={fieldToDelete !== null}
        title="Excluir campo?"
        message={`Deseja realmente excluir o campo "${fieldToDelete?.label}"? Logs existentes vão manter o valor salvo, mas ele deixa de aparecer no formulário. Esta ação não pode ser desfeita na definição do template.`}
        onConfirm={() => { if (fieldToDelete) onRemoveField(fieldToDelete.id); setFieldToDelete(null); }}
        onCancel={() => setFieldToDelete(null)}
      />
    </>
  );
}
