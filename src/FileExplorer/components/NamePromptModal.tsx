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
      <div className="flex min-w-[320px] flex-col gap-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
          autoFocus
          className="w-full rounded border border-zinc-300 bg-white p-2 text-sm text-zinc-900 outline-none focus:border-blue-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
        />
        {error && <p className="m-0 text-xs text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit}>{saving ? 'Salvando...' : confirmLabel}</Button>
        </div>
      </div>
    </Modal>
  );
}