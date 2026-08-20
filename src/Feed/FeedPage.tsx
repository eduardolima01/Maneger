import { useEffect, useRef, useState } from 'react';
import { useSearch } from '@tanstack/react-router';
import Modal from '@/components/ui/Modal';
import Button from '@/components/layout/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog'; // TODO: confirmar caminho real
import MomentComposer from './components/MomentComposer';
import MomentEditor from './components/MomentEditor';
import MomentCard from './components/MomentCard';
import { useFeed } from './hooks/useFeed';
import type { Moment } from './types/feed.types';

export default function FeedPage() {
  // momentId vem como search param da URL (?momentId=xxx) — preenchido pela Pesquisa Global
  // ao selecionar um resultado do Feed. Ver routes.tsx (validateSearch) e feed.provider.ts.
  const { momentId: focusMomentId } = useSearch({ from: '/feed' }) as { momentId?: string };
  const feed = useFeed();
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingMoment, setEditingMoment] = useState<Moment | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [movingDateMoment, setMovingDateMoment] = useState<Moment | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!focusMomentId) return;
    setHighlightedId(focusMomentId);
    // espera o próximo frame pra garantir que o elemento já está renderizado
    requestAnimationFrame(() => {
      cardRefs.current[focusMomentId]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    const timer = setTimeout(() => setHighlightedId(null), 2500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusMomentId]);

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 16px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Feed</h1>
          <p style={{ fontSize: 13, color: '#999', margin: '4px 0 0' }}>Registre seus momentos</p>
        </div>
        <Button variant="primary" onClick={() => setComposerOpen(true)}>+ Novo momento</Button>
      </div>

      {feed.loading && <p style={{ fontSize: 13, color: '#999' }}>Carregando...</p>}

      {!feed.loading && feed.groups.length === 0 && (
        <p style={{ fontSize: 13, color: '#999' }}>Nenhum momento registrado ainda.</p>
      )}

      {feed.groups.map((group) => (
        <div key={group.label} style={{ marginBottom: 24 }}>
          <div style={{
            fontSize: 13, fontWeight: 700, color: '#666', padding: '4px 0',
            borderBottom: '1px solid #eee', marginBottom: 12,
          }}>
            {group.label}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {group.moments.map((m) => (
              <div key={m.id} ref={(el) => { cardRefs.current[m.id] = el; }}>
                <MomentCard
                  moment={m}
                  highlighted={highlightedId === m.id}
                  onEdit={() => setEditingMoment(m)}
                  onDuplicate={() => feed.duplicate(m.id)}
                  onDelete={() => setDeletingId(m.id)}
                  onMoveDate={() => setMovingDateMoment(m)}
                />
              </div>
            ))}
          </div>
        </div>
      ))}

      <Modal open={composerOpen} onClose={() => setComposerOpen(false)} title="Novo momento">
        <MomentComposer
          onCancel={() => setComposerOpen(false)}
          onSubmit={(input) => { feed.create(input); setComposerOpen(false); }}
        />
      </Modal>

      <MomentEditor
        moment={editingMoment}
        onClose={() => setEditingMoment(null)}
        onSave={(id, input) => feed.update(id, input)}
      />

      <ConfirmDialog
        isOpen={deletingId !== null}
        title="Excluir momento?"
        message="Esta ação não poderá ser desfeita."
        onConfirm={() => { if (deletingId) feed.remove(deletingId); setDeletingId(null); }}
        onCancel={() => setDeletingId(null)}
      />

      {movingDateMoment && (
        <Modal open onClose={() => setMovingDateMoment(null)} title="Mover data">
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              type="datetime-local"
              defaultValue={movingDateMoment.occurredAt.slice(0, 16)}
              onChange={(e) => {
                const iso = new Date(e.target.value).toISOString();
                feed.update(movingDateMoment.id, { occurredAt: iso });
              }}
              style={{ padding: 8, fontSize: 14, border: '1px solid #e5e7eb', borderRadius: 4 }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button onClick={() => setMovingDateMoment(null)}>Fechar</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
