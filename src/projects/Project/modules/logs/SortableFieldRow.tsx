import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FIELD_TYPE_LABELS } from '@/types/template.types';
import type { TemplateField } from '@/types/template.types';

interface SortableFieldRowProps {
  field: TemplateField;
  onUpdate: (input: Partial<{ label: string; required: boolean }>) => void;
  onRequestDelete: () => void;
}

export default function SortableFieldRow({ field, onUpdate, onRequestDelete }: SortableFieldRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.id });
  const [labelDraft, setLabelDraft] = useState(field.label);

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={{ ...style, display: 'flex', alignItems: 'center', gap: 6, border: '1px solid #eee', borderRadius: 4, padding: '6px 8px' }}>
      <span {...attributes} {...listeners} style={{ color: '#bbb', fontSize: 12, cursor: 'grab', touchAction: 'none' }} title="Arrastar">
        ⠿
      </span>

      <div style={{ flex: 1 }}>
        <input
          value={labelDraft}
          onChange={(e) => setLabelDraft(e.target.value)}
          onBlur={() => labelDraft.trim() && labelDraft !== field.label && onUpdate({ label: labelDraft.trim() })}
          style={{ fontSize: 13, fontWeight: 600, border: 'none', outline: 'none', width: '100%' }}
        />
        <span style={{ fontSize: 11, color: '#999' }}>{FIELD_TYPE_LABELS[field.type]} {field.required && '· obrigatório'}</span>
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
        <input type="checkbox" checked={field.required} onChange={(e) => onUpdate({ required: e.target.checked })} />
        obrig.
      </label>

      <button onClick={onRequestDelete} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#c62828', fontSize: 12 }}>✕</button>
    </div>
  );
}
