import { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/layout/Button';
import MarkdownField from '@/components/ui/MarkdownField';
import type { Flashcard, CreateFlashcardInput, UpdateFlashcardInput } from '../types/study.types';

interface FlashcardFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: Omit<CreateFlashcardInput, 'deckId'> | UpdateFlashcardInput) => Promise<void>;
  card?: Flashcard | null; // presente = edição
}

export default function FlashcardFormModal({ open, onClose, onSubmit, card }: FlashcardFormModalProps) {
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setFront(card?.front ?? '');
    setBack(card?.back ?? '');
    setError(null);
  }, [open, card]);

  const handleSubmit = async () => {
    if (!front.trim() || !back.trim()) {
      setError('Preencha a pergunta (frente) e a resposta (verso).');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit({ front: front.trim(), back: back.trim() });
      onClose();
    } catch {
      setError('Não foi possível salvar o card. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={card ? 'Editar card' : 'Novo card'}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 420 }}>
        <div>
          <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>Frente (pergunta)</label>
          <MarkdownField value={front} onChange={setFront} rows={4} placeholder="O que você quer perguntar?" />
        </div>

        <div>
          <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>Verso (resposta)</label>
          <MarkdownField value={back} onChange={setBack} rows={4} placeholder="Qual é a resposta?" />
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
