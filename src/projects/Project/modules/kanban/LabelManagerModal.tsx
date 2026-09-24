import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { LABEL_COLOR_PALETTE, ParsedLabel } from '@/Kanban/utils/kanbanLabels';
import type { LabelIcon } from '@/types/kanban.types';
import LabelIconPicker from '@/Kanban/components/LabelIconPicker';

interface LabelManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  labels: ParsedLabel[];
  cardCounts: Record<string, number>;
  /** Quantos GRUPOS/subgrupos usam cada etiqueta (por nome) — as etiquetas também podem ir em grupos. */
  groupCounts?: Record<string, number>;
  /** Ícone (emoji ou imagem) de cada etiqueta, pelo nome. */
  labelIcons: Record<string, LabelIcon>;
  onSetLabelIcon: (name: string, icon: LabelIcon | null) => void;
  onRename: (oldName: string, newName: string, color: string, isGroup: boolean) => Promise<void>;
  onDelete: (name: string) => Promise<void>;
  /** Cria uma etiqueta nova, sem aplicar em nenhum card/grupo — só entra no catálogo. */
  onCreate: (name: string, color: string, isGroup: boolean) => void;
  onFixInconsistentGroupLabels: () => Promise<void>;
}

export default function LabelManagerModal({ isOpen, onClose, labels, cardCounts, groupCounts = {}, labelIcons, onSetLabelIcon, onRename, onDelete, onCreate, onFixInconsistentGroupLabels }: LabelManagerModalProps) {
  const [fixing, setFixing] = useState(false);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [colorDraft, setColorDraft] = useState(LABEL_COLOR_PALETTE[0]);
  const [isGroupDraft, setIsGroupDraft] = useState(false);
  const [iconDraft, setIconDraft] = useState<LabelIcon | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(LABEL_COLOR_PALETTE[0]);
  const [newIsGroup, setNewIsGroup] = useState(false);

  function startCreate() {
    setCreating(true);
    setNewName('');
    setNewColor(LABEL_COLOR_PALETTE[0]);
    setNewIsGroup(false);
  }

  function submitCreate() {
    const trimmed = newName.trim();
    if (!trimmed) { setCreating(false); return; }
    if (!labels.some((l) => l.name === trimmed)) onCreate(trimmed, newColor, newIsGroup);
    setCreating(false);
  }

  function startEdit(label: ParsedLabel) {
    setEditingName(label.name);
    setNameDraft(label.name);
    setColorDraft(label.color);
    setIsGroupDraft(label.isGroup);
    setIconDraft(labelIcons[label.name] ?? null);
  }

  async function submitEdit() {
    if (!editingName) return;
    const trimmed = nameDraft.trim();
    if (!trimmed) return;
    const original = labels.find((l) => l.name === editingName);
    if (trimmed !== editingName || colorDraft !== original?.color || isGroupDraft !== original?.isGroup) {
      await onRename(editingName, trimmed, colorDraft, isGroupDraft); // já leva o ícone antigo pro nome novo
    }
    const iconChanged = JSON.stringify(iconDraft) !== JSON.stringify(labelIcons[editingName] ?? null);
    if (iconChanged) onSetLabelIcon(trimmed, iconDraft); // depois do rename, pra valer pro nome novo
    setEditingName(null);
  }

  return (
    <>
      <Modal open={isOpen} onClose={onClose}>
        <div style={{ padding: 16, minWidth: 320 }}>
          <h3 style={{ marginTop: 0 }}>Etiquetas do Kanban</h3>


          <button
            onClick={async () => { setFixing(true); await onFixInconsistentGroupLabels(); setFixing(false); }}
            disabled={fixing}
            style={{ display: 'block', fontSize: 11, color: '#1a73e8', background: 'none', border: 'none', cursor: fixing ? 'default' : 'pointer', padding: '0 0 8px', textAlign: 'left' }}
          >
            {fixing ? 'Corrigindo...' : '🔧 Corrigir agrupamento de etiquetas antigas'}
          </button>

          {labels.length === 0 && !creating && (
            <p style={{ color: '#999', fontSize: 13 }}>Nenhuma etiqueta criada ainda neste kanban.</p>
          )}

          {creating ? (
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px',
                border: '1px solid #eee', borderRadius: 6, marginBottom: 8,
              }}
            >
              <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', maxWidth: 90 }}>
                {LABEL_COLOR_PALETTE.map((c) => (
                  <button
                    key={c}
                    onClick={() => setNewColor(c)}
                    style={{
                      width: 16, height: 16, borderRadius: 4, backgroundColor: c, cursor: 'pointer', padding: 0,
                      border: newColor === c ? '2px solid #000' : '1px solid rgba(0,0,0,0.15)',
                    }}
                  />
                ))}
              </div>
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nome da etiqueta..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitCreate();
                  if (e.key === 'Escape') setCreating(false);
                }}
                style={{ flex: 1, fontSize: 13, padding: 4, border: '1px solid #ddd', borderRadius: 4 }}
              />
              <label title="Etiqueta de grupo" style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                <input type="checkbox" checked={newIsGroup} onChange={(e) => setNewIsGroup(e.target.checked)} />
              </label>
              <button onClick={submitCreate} title="Salvar" style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#1a73e8', fontSize: 13 }}>✓</button>
              <button onClick={() => setCreating(false)} title="Cancelar" style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#999', fontSize: 13 }}>✕</button>
            </div>
          ) : (
            <button
              onClick={startCreate}
              style={{ display: 'block', fontSize: 12, color: '#1a73e8', background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 10px', textAlign: 'left', fontWeight: 600 }}
            >
              + Nova etiqueta
            </button>
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
                      <LabelIconPicker value={iconDraft} onChange={setIconDraft} />
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
                      <label title="Etiqueta de grupo" style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                        <input type="checkbox" checked={isGroupDraft} onChange={(e) => setIsGroupDraft(e.target.checked)} />
                      </label>
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
                      {/* sempre visível: dá pra trocar o ícone sem entrar no modo de edição (✏️) */}
                      <LabelIconPicker value={labelIcons[label.name] ?? null} onChange={(icon) => onSetLabelIcon(label.name, icon)} />
                      <span style={{ flex: 1, fontSize: 13 }}>{label.name}</span>
                      {label.isGroup && <span title="Etiqueta de grupo — agrupa cards na coluna" style={{ fontSize: 11 }}>🏷</span>}
                      <span style={{ fontSize: 11, color: '#999' }}>
                        {cardCounts[label.name] ?? 0} card{(cardCounts[label.name] ?? 0) !== 1 ? 's' : ''}
                        {(groupCounts[label.name] ?? 0) > 0 && ` · ${groupCounts[label.name]} grupo${groupCounts[label.name] !== 1 ? 's' : ''}`}
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
        message={`A etiqueta "${deleteTarget}" será removida de todos os cards (${deleteTarget ? cardCounts[deleteTarget] ?? 0 : 0}) e grupos (${deleteTarget ? groupCounts[deleteTarget] ?? 0 : 0}) que a usam, e o ícone dela também. Nada é apagado além da etiqueta.`}
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
