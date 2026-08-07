import Modal from '@/components/ui/Modal';
import Button from '@/components/layout/Button';
import { useEffect } from 'react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({ isOpen, title, message, confirmLabel = 'Excluir', onConfirm, onCancel }: ConfirmDialogProps) {
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'q' || e.key === 'Q') {
        e.preventDefault();
        e.stopPropagation(); // impede que listeners por baixo (ex: KanbanCardModal) também reajam ao mesmo "q"
        onConfirm();
      }
    }
    document.addEventListener('keydown', handleKeyDown, true); // fase de captura: roda antes dos listeners de fase de bolha
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, onConfirm]);

  return (
    <Modal open={isOpen} onClose={onCancel}>
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h3 style={{ margin: 0, fontSize: 16 }}>{title}</h3>
        <p style={{ margin: 0, fontSize: 13, color: '#666' }}>{message}</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
          <Button variant="secondary" onClick={onCancel}>Cancelar</Button>
          <Button variant="danger" onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </Modal>
  );
}
