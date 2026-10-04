import { useEffect, useRef, useState } from 'react';
import { marked } from 'marked';

interface MarkdownFieldProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  rows?: number;
  toggleEditSignal?: number;
}

export default function MarkdownField({ value, onChange, onBlur, placeholder, rows = 6, toggleEditSignal }: MarkdownFieldProps) {
  const [mode, setMode] = useState<'edit' | 'preview'>('preview');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const appliedToggleRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (toggleEditSignal !== undefined && toggleEditSignal !== appliedToggleRef.current) {
      appliedToggleRef.current = toggleEditSignal;
      setMode((m) => (m === 'edit' ? 'preview' : 'edit'));
    }
  }, [toggleEditSignal]);

  useEffect(() => {
    if (mode === 'edit') textareaRef.current?.focus();
  }, [mode]);

  const html = marked.parse(value || '', { breaks: true, gfm: true }) as string;

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
        <button
          type="button"
          onClick={() => setMode('preview')}
          className={
            mode === 'preview'
              ? 'bg-blue-600 text-white border border-neutral-300 dark:border-neutral-600'
              : 'bg-white dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 border border-neutral-300 dark:border-neutral-600'
          }
          style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, cursor: 'pointer' }}
        >
          👁 Visualizar
        </button>
        <button
          type="button"
          onClick={() => setMode('edit')}
          className={
            mode === 'edit'
              ? 'bg-blue-600 text-white border border-neutral-300 dark:border-neutral-600'
              : 'bg-white dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 border border-neutral-300 dark:border-neutral-600'
          }
          style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, cursor: 'pointer' }}
        >
          ✎ Editar
        </button>
      </div>

      {mode === 'edit' ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          rows={rows}
          className="bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 dark:border-neutral-600 dark:[color-scheme:dark]"
          style={{ width: '100%', padding: 8, fontSize: 13, resize: 'vertical', fontFamily: 'monospace' }}
        />
      ) : (
        <div
          className="markdown-preview border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
          style={{
            borderRadius: 4, padding: 10, minHeight: rows * 20,
            fontSize: 13, overflowY: 'auto', maxHeight: 300,
          }}
          dangerouslySetInnerHTML={{ __html: value.trim() ? html : '<p class="text-neutral-400 dark:text-neutral-500" style="font-style:italic">Sem conteúdo ainda...</p>' }}
        />
      )}
    </div>
  );
}
