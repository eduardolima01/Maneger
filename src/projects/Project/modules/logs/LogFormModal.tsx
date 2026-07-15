import { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/layout/Button';
import FieldRenderer from './fields/FieldRenderer';
import type { Template } from '@/types/template.types';
import type { Log, LogValues } from '@/types/log.types';

interface LogFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  template: Template;
  editingLog: Log | null;
  onSave: (values: LogValues) => void;
}

function buildDefaultValues(template: Template): LogValues {
  return Object.fromEntries(template.fields.map((f) => [f.key, f.defaultValue]));
}

export default function LogFormModal({ isOpen, onClose, template, editingLog, onSave }: LogFormModalProps) {
  const [values, setValues] = useState<LogValues>({});

  useEffect(() => {
    if (isOpen) {
      setValues(editingLog ? editingLog.values : buildDefaultValues(template));
    }
  }, [isOpen, editingLog, template]);

  function handleSave() {
    const missingRequired = template.fields.find((f) => f.required && (values[f.key] === null || values[f.key] === undefined || values[f.key] === ''));
    if (missingRequired) return; // validação simples — o botão fica ativo, mas não salva sem obrigatórios preenchidos
    onSave(values);
  }

  return (
    <Modal open={isOpen} onClose={onClose}>
      <div style={{
        padding: 16,
        width: 420,
        maxWidth: '90vw',
        maxHeight: '80vh',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 12
      }}>
        <h3 style={{ margin: 0 }}>{editingLog ? 'Editar log' : `Novo log — ${template.name}`}</h3>

        {template.fields.map((field) => (
          <div key={field.id}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#666', display: 'block', marginBottom: 4 }}>
              {field.label} {field.required && <span style={{ color: '#c62828' }}>*</span>}
            </label>
            <FieldRenderer
              field={field}
              value={values[field.key] ?? null}
              onChange={(v) => setValues((prev) => ({ ...prev, [field.key]: v }))}
            />
          </div>
        ))}

        {template.fields.length === 0 && (
          <p style={{ fontSize: 13, color: '#999' }}>Este template ainda não tem campos definidos.</p>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, borderTop: '1px solid #eee', paddingTop: 12 }}>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={handleSave}>Salvar</Button>
        </div>
      </div>
    </Modal>
  );
}

