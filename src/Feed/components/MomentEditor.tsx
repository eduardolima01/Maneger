import Modal from '@/components/ui/Modal';
import MomentComposer from './MomentComposer';
import type { Moment, UpdateMomentInput } from '../types/feed.types';

interface MomentEditorProps {
  moment: Moment | null;
  onClose: () => void;
  onSave: (id: string, input: UpdateMomentInput) => void;
}

export default function MomentEditor({ moment, onClose, onSave }: MomentEditorProps) {
  return (
    <Modal open={moment !== null} onClose={onClose} title="Editar momento">
      {moment && (
        <MomentComposer
          initial={moment}
          onCancel={onClose}
          onSubmit={(input) => { onSave(moment.id, input); onClose(); }}
        />
      )}
    </Modal>
  );
}
