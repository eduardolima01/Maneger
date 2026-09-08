import { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/layout/Button';
import { DECK_COLOR_PRESETS, DECK_ICON_PRESETS } from '../types/study.types';
import type { Deck, CreateDeckInput, UpdateDeckInput } from '../types/study.types';

interface DeckFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: CreateDeckInput | UpdateDeckInput) => Promise<void>;
  deck?: Deck | null; // presente = edição
}

export default function DeckFormModal({ open, onClose, onSubmit, deck }: DeckFormModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState<string>(DECK_COLOR_PRESETS[0]);
  const [icon, setIcon] = useState<string>(DECK_ICON_PRESETS[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(deck?.name ?? '');
    setDescription(deck?.description ?? '');
    setColor(deck?.color ?? DECK_COLOR_PRESETS[0]);
    setIcon(deck?.icon ?? DECK_ICON_PRESETS[0]);
    setError(null);
  }, [open, deck]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Dê um nome ao deck.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit({ name: name.trim(), description: description.trim() || null, color, icon });
      onClose();
    } catch {
      setError('Não foi possível salvar o deck. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={deck ? 'Editar deck' : 'Novo deck'}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 360 }}>
        <div>
          <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>Nome</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Inglês — Vocabulário"
            style={{ width: '100%', padding: 8, fontSize: 14, border: '1px solid #ccc', borderRadius: 4 }}
            autoFocus
          />
        </div>

        <div>
          <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>Descrição (opcional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            style={{ width: '100%', padding: 8, fontSize: 13, border: '1px solid #ccc', borderRadius: 4, resize: 'vertical' }}
          />
        </div>

        <div style={{ display: 'flex', gap: 24 }}>
          <div>
            <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>Ícone</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', maxWidth: 180 }}>
              {DECK_ICON_PRESETS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setIcon(emoji)}
                  style={{
                    width: 32,
                    height: 32,
                    fontSize: 16,
                    borderRadius: 6,
                    cursor: 'pointer',
                    border: icon === emoji ? '2px solid #1a73e8' : '1px solid #ccc',
                    background: '#fff',
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>Cor</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', maxWidth: 180 }}>
              {DECK_COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={c}
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    cursor: 'pointer',
                    backgroundColor: c,
                    border: color === c ? '2px solid #333' : '1px solid #ccc',
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {error && <p style={{ color: '#d93025', fontSize: 12, margin: 0 }}>{error}</p>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit}>{saving ? 'Salvando...' : 'Salvar'}</Button>
        </div>
      </div>
    </Modal>
  );
}
