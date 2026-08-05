import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { LABEL_COLOR_PALETTE, ParsedLabel } from '@/Kanban/utils/kanbanLabels';

interface LabelManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  labels: ParsedLabel[];
  cardCounts: Record<string, number>;
  onRename: (oldName: string, newName: string, color: string) => Promise<void>;
  onDelete: (name: string) => Promise<void>;
}

export default function LabelManagerModal({ isOpen, onClose, labels, cardCounts, onRename, onDelete }: LabelManagerModalProps) {
  const [editingName, setEditingName] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [colorDraft, setColorDraft] = useState(LABEL_COLOR_PALETTE[0]);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  function startEdit(label: ParsedLabel) {
    setEditingName(label.name);
    setNameDraft(label.name);
    setColorDraft(label.color);
  }

  async function submitEdit() {
    if (!editingName) return;
    const trimmed = nameDraft.trim();
    if (!trimmed) return;
    if (trimmed !== editingName || colorDraft !== labels.find((l) => l.name === editingName)?.color) {
      await onRename(editingName, trimmed, colorDraft);
    }
    setEditingName(null);
  }

  return (
    <>
      <Modal open={isOpen} onClose={onClose}>
        <div style={{ padding: 16, minWidth: 320 }}>
          <h3 style={{ marginTop: 0 }}>Etiquetas do Kanban</h3>

          {labels.length === 0 && (
            <p style={{ color: '#999', fontSize: 13 }}>Nenhuma etiqueta criada ainda neste kanban.</p>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 360, overflowY: 'auto' }}>
            {labels.map((label) => {
              const isEditing = editingName === label.name;
              return (
                <div
                  key={label.name}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px',
                    border: '1px solid #eee', borderRadius: 6,
                  }}
                >
                  {isEditing ? (
                    <>
                      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', maxWidth: 90 }}>
                        {LABEL_COLOR_PALETTE.map((c) => (
                          <button
                            key={c}
                            onClick={() => setColorDraft(c)}
                            style={{
                              width: 16, height: 16, borderRadius: 4, backgroundColor: c, cursor: 'pointer', padding: 0,
                              border: colorDraft === c ? '2px solid #000' : '1px solid rgba(0,0,0,0.15)',
                            }}
                          />
                        ))}
                      </div>
                      <input
                        autoFocus
                        value={nameDraft}
                        onChange={(e) => setNameDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') submitEdit();
                          if (e.key === 'Escape') setEditingName(null);
                        }}
                        style={{ flex: 1, fontSize: 13, padding: 4, border: '1px solid #ddd', borderRadius: 4 }}
                      />
                      <button
                        onClick={submitEdit}
                        title="Salvar"
                        style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#1a73e8', fontSize: 13 }}
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => setEditingName(null)}
                        title="Cancelar"
                        style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#999', fontSize: 13 }}
                      >
                        ✕
                      </button>
                    </>
                  ) : (
                    <>
                      <span style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: label.color, flexShrink: 0 }} />
                      <span style={{ flex: 1, fontSize: 13 }}>{label.name}</span>
                      <span style={{ fontSize: 11, color: '#999' }}>
                        {cardCounts[label.name] ?? 0} card{(cardCounts[label.name] ?? 0) !== 1 ? 's' : ''}
                      </span>
                      <button
                        onClick={() => startEdit(label)}
                        title="Editar"
                        style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 13 }}
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => setDeleteTarget(label.name)}
                        title="Excluir"
                        style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#c62828', fontSize: 13 }}
                      >
                        🗑
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Excluir etiqueta?"
        message={`A etiqueta "${deleteTarget}" será removida de todos os cards que a usam (${deleteTarget ? cardCounts[deleteTarget] ?? 0 : 0} card${deleteTarget && (cardCounts[deleteTarget] ?? 0) !== 1 ? 's' : ''}). Os cards não são apagados.`}
        confirmLabel="Excluir"
        onConfirm={async () => {
          if (deleteTarget) await onDelete(deleteTarget);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
