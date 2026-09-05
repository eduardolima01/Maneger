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
          style={{
            fontSize: 11, padding: '3px 8px', border: '1px solid #ccc', borderRadius: 4,
            cursor: 'pointer', backgroundColor: mode === 'preview' ? '#1a73e8' : '#fff',
            color: mode === 'preview' ? '#fff' : '#666',
          }}
        >
          👁 Visualizar
        </button>
        <button
          type="button"
          onClick={() => setMode('edit')}
          style={{
            fontSize: 11, padding: '3px 8px', border: '1px solid #ccc', borderRadius: 4,
            cursor: 'pointer', backgroundColor: mode === 'edit' ? '#1a73e8' : '#fff',
            color: mode === 'edit' ? '#fff' : '#666',
          }}
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
          style={{ width: '100%', padding: 8, fontSize: 13, resize: 'vertical', fontFamily: 'monospace' }}
        />
      ) : (
        <div
          className="markdown-preview"
          style={{
            border: '1px solid #eee', borderRadius: 4, padding: 10, minHeight: rows * 20,
            fontSize: 13, backgroundColor: '#fafafa', overflowY: 'auto', maxHeight: 300,
          }}
          dangerouslySetInnerHTML={{ __html: value.trim() ? html : '<p style="color:#999;font-style:italic">Sem conteúdo ainda...</p>' }}
        />
      )}
    </div>
  );
}
