import { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/layout/Button';

interface NamePromptModalProps {
  open: boolean;
  title: string;
  initialValue?: string;
  confirmLabel?: string;
  onClose: () => void;
  onSubmit: (name: string) => Promise<void>;
}

export default function NamePromptModal({ open, title, initialValue = '', confirmLabel = 'Confirmar', onClose, onSubmit }: NamePromptModalProps) {
  const [name, setName] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(initialValue);
    setError(null);
  }, [open, initialValue]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Digite um nome.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit(name.trim());
      onClose();
    } catch (e) {
      setError(typeof e === 'string' ? e : 'Não foi possível concluir. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 320 }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
          autoFocus
          style={{ width: '100%', padding: 8, fontSize: 14, border: '1px solid #ccc', borderRadius: 4 }}
        />
        {error && <p style={{ color: '#d93025', fontSize: 12, margin: 0 }}>{error}</p>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit}>{saving ? 'Salvando...' : confirmLabel}</Button>
        </div>
      </div>
    </Modal>
  );
}
