import { useMemo, useRef, useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/layout/Button';
import { buildImportTemplate, downloadTextFile, parseCardsFile, type ParsedCard } from '../utils/cardFileFormat';
import type { Flashcard } from '../types/study.types';
import type { ImportCardsResult } from '../api/flashcards';

interface ImportCardsModalProps {
  open: boolean;
  onClose: () => void;
  deckName: string;
  existingCards: Flashcard[];
  onImport: (items: ParsedCard[]) => Promise<ImportCardsResult>;
}

export default function ImportCardsModal({ open, onClose, deckName, existingCards, onImport }: ImportCardsModalProps) {
  const [text, setText] = useState('');
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<ImportCardsResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const existingIds = useMemo(() => new Set(existingCards.map((c) => c.id)), [existingCards]);
  const parsed = useMemo(() => parseCardsFile(text), [text]);
  const willUpdate = parsed.filter((c) => c.id && existingIds.has(c.id)).length;
  const willCreate = parsed.length - willUpdate;

  const reset = () => {
    setText('');
    setError(null);
    setDone(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFile = async (file: File) => {
    const content = await file.text();
    setText(content);
    setError(null);
    setDone(null);
  };

  const handleImport = async () => {
    if (parsed.length === 0) {
      setError('Nenhum card reconhecido nesse texto. Confira se ele segue o formato (%%CARD / %%FRENTE / %%VERSO).');
      return;
    }
    setImporting(true);
    setError(null);
    try {
      const result = await onImport(parsed);
      setDone(result);
      setText('');
    } catch {
      setError('Não foi possível importar. Tente novamente.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title="Importar cards">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 480 }}>
        <p style={{ margin: 0, fontSize: 13, color: '#666' }}>
          Cole aqui o texto gerado pela IA (ou por você) a partir de um tutorial, ou selecione um
          arquivo. Formato esperado: blocos <code>%%CARD</code> / <code>%%FRENTE</code> / <code>%%VERSO</code>.
        </p>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = '';
            }}
          />
          <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
            📄 Selecionar arquivo (.txt/.md)
          </Button>
          <Button
            variant="secondary"
            onClick={() => downloadTextFile('template-flashcards.txt', buildImportTemplate(deckName))}
          >
            ⬇️ Baixar template pra IA
          </Button>
        </div>

        <textarea
          value={text}
          onChange={(e) => { setText(e.target.value); setError(null); setDone(null); }}
          rows={12}
          placeholder={'%%CARD\n%%FRENTE\nPergunta...\n%%VERSO\nResposta...'}
          style={{
            width: '100%',
            fontFamily: 'monospace',
            fontSize: 12,
            padding: 8,
            borderRadius: 6,
            border: '1px solid #ddd',
            resize: 'vertical',
            boxSizing: 'border-box',
          }}
        />

        {text.trim() && (
          <p style={{ margin: 0, fontSize: 12, color: '#666' }}>
            {parsed.length === 0
              ? 'Nenhum card reconhecido ainda.'
              : `${parsed.length} card(s) reconhecido(s) — ${willCreate} novo(s), ${willUpdate} atualização(ões).`}
          </p>
        )}

        {error && <p style={{ color: '#d93025', fontSize: 12, margin: 0 }}>{error}</p>}
        {done && (
          <p style={{ color: '#1e8e3e', fontSize: 12, margin: 0 }}>
            Importado: {done.created} card(s) criado(s), {done.updated} atualizado(s).
          </p>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
          <Button variant="secondary" onClick={handleClose}>{done ? 'Fechar' : 'Cancelar'}</Button>
          {!done && (
            <Button onClick={handleImport} disabled={importing || parsed.length === 0}>
              {importing ? 'Importando...' : 'Importar'}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
