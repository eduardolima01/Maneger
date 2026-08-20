import { useState } from 'react';

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
}

export default function TagInput({ tags, onChange }: TagInputProps) {
  const [draft, setDraft] = useState('');

  function commit() {
    const clean = draft.trim().replace(/^#/, '');
    if (clean && !tags.includes(clean)) onChange([...tags, clean]);
    setDraft('');
  }

  function remove(tag: string) {
    onChange(tags.filter((t) => t !== tag));
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
      {tags.map((t) => (
        <span
          key={t}
          style={{
            fontSize: 12, padding: '3px 8px', borderRadius: 12, background: '#eef2ff',
            color: '#1a73e8', display: 'flex', alignItems: 'center', gap: 4,
          }}
        >
          #{t}
          <button
            onClick={() => remove(t)}
            style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#1a73e8', fontSize: 11, padding: 0 }}
          >
            ✕
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commit(); }
          if (e.key === 'Backspace' && !draft && tags.length > 0) remove(tags[tags.length - 1]);
        }}
        onBlur={commit}
        placeholder={tags.length === 0 ? 'Tags (Enter para adicionar)' : ''}
        style={{ border: 'none', outline: 'none', fontSize: 12, flex: 1, minWidth: 100, padding: 4 }}
      />
    </div>
  );
}
