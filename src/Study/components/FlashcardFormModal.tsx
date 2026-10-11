import { useEffect, useRef, useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/layout/Button';
import MarkdownField from '@/components/ui/MarkdownField';
import { resizeImageToDataUrl } from '../utils/imageResize';
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
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setFront(card?.front ?? '');
    setBack(card?.back ?? '');
    setImageUrl(card?.imageUrl ?? null);
    setError(null);
  }, [open, card]);

  const handleImageFile = async (file: File) => {
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      setImageUrl(dataUrl);
      setError(null);
    } catch {
      setError('Não foi possível processar essa imagem. Tente outro arquivo.');
    }
  };

  const handleSubmit = async () => {
    if (!front.trim() || !back.trim()) {
      setError('Preencha a pergunta (frente) e a resposta (verso).');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit({ front: front.trim(), back: back.trim(), imageUrl });
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

        <div>
          <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>
            Imagem de referência (opcional)
          </label>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImageFile(file);
              e.target.value = '';
            }}
          />
          {imageUrl ? (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <img
                src={imageUrl}
                alt="Prévia da imagem de referência"
                style={{ maxWidth: 200, maxHeight: 140, borderRadius: 6, border: '1px solid #eee', display: 'block' }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <Button variant="secondary" onClick={() => imageInputRef.current?.click()}>Trocar</Button>
                <Button variant="danger" onClick={() => setImageUrl(null)}>Remover</Button>
              </div>
            </div>
          ) : (
            <Button variant="secondary" onClick={() => imageInputRef.current?.click()}>
              🖼 Adicionar imagem
            </Button>
          )}
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
