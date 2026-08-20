import { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import MomentComposer from '../components/MomentComposer';
import { useFeed } from '../hooks/useFeed';

export default function GlobalMomentComposerHost() {
  const feed = useFeed();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <Modal open={open} onClose={() => setOpen(false)} title="Novo momento">
      <MomentComposer
        onCancel={() => setOpen(false)}
        onSubmit={(input) => { feed.create(input); setOpen(false); }}
      />
    </Modal>
  );
}
