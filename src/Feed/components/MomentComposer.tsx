import { useState } from 'react';
import Button from '@/components/layout/Button';
// TODO: confirmar caminho real de ProjectSearchSelect (usado hoje em CreateKanbanModal.tsx)
import ProjectSearchSelect from '@/Projects/components/ProjectSearchSelect';
import TagInput from './TagInput';
import MomentAttachments from './MomentAttachments';
import { useMomentClipboard } from '../hooks/useMomentClipboard';
import type { Attachment, CreateMomentInput, Moment } from '../types/feed.types';

interface MomentComposerProps {
  /** Se fornecido, o composer inicia populado pra edição (não cria, atualiza). */
  initial?: Moment;
  onSubmit: (input: CreateMomentInput) => void;
  onCancel?: () => void;
}

function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function MomentComposer({ initial, onSubmit, onCancel }: MomentComposerProps) {
  const [content, setContent] = useState(initial?.content ?? '');
  const [occurredAt, setOccurredAt] = useState(toLocalInputValue(initial?.occurredAt ?? new Date().toISOString()));
  const [projectId, setProjectId] = useState<string | null>(initial?.projectId ?? null);
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [attachments, setAttachments] = useState<Attachment[]>(initial?.attachments ?? []);

  const clipboard = useMomentClipboard({
    onAddAttachment: (a) => setAttachments((prev) => [...prev, a]),
  });

  function removeAttachment(id: string) {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }

  function handleSubmit() {
    if (!content.trim()) return;
    onSubmit({
      content: content.trim(),
      occurredAt: new Date(occurredAt).toISOString(),
      projectId,
      tags,
      attachments,
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 16 }}>
      <textarea
        autoFocus
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onPaste={clipboard.handlePaste}
        onDrop={clipboard.handleDrop}
        onDragOver={(e) => e.preventDefault()}
        placeholder="O que aconteceu? (aceita Markdown)"
        rows={4}
        style={{ width: '100%', padding: 10, fontSize: 14, border: '1px solid #e5e7eb', borderRadius: 6, resize: 'vertical', boxSizing: 'border-box' }}
      />

      <MomentAttachments attachments={attachments} onRemove={removeAttachment} />

      <label style={{ fontSize: 12, color: '#1a73e8', cursor: 'pointer', width: 'fit-content' }}>
        📷 Adicionar imagem
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          multiple
          onChange={(e) => clipboard.handleFileSelect(e.target.files)}
          style={{ display: 'none' }}
        />
      </label>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="datetime-local"
          value={occurredAt}
          onChange={(e) => setOccurredAt(e.target.value)}
          style={{ fontSize: 12, padding: 6, border: '1px solid #e5e7eb', borderRadius: 4 }}
        />
        <div style={{ minWidth: 200, flex: 1 }}>
          <ProjectSearchSelect value={projectId} onChange={(id) => setProjectId(id)} />
        </div>
      </div>

      <TagInput tags={tags} onChange={setTags} />

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        {onCancel && <Button variant="secondary" onClick={onCancel}>Cancelar</Button>}
        <Button variant="primary" onClick={handleSubmit} disabled={!content.trim()}>
          {initial ? 'Salvar' : 'Publicar'}
        </Button>
      </div>
    </div>
  );
}
