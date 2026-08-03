import { useState } from 'react';
import { useTabs, activateTab, closeTab, tabDisplayTitle, openNewTab, tabDisplayIcon, setCustomTitle, clearCustomTitle } from './tabStore';

export default function TabBar() {
  const { tabs, activeTabId } = useTabs();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');

  function startRename(id: string, currentTitle: string) {
    setEditingId(id);
    setEditingValue(currentTitle);
  }

  function commitRename() {
    if (editingId) setCustomTitle(editingId, editingValue);
    setEditingId(null);
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid #eee', background: '#fafafa' }}>
      <button
        onClick={() => activateTab(null)}
        style={{
          padding: '8px 16px', border: 'none', cursor: 'pointer', fontWeight: 500,
          background: activeTabId === null ? '#fff' : 'transparent',
          borderBottom: activeTabId === null ? '2px solid #333' : '2px solid transparent',
        }}
      >
        Início
      </button>

      {tabs.map((tab) => (
        <div
          key={tab.id}
          onClick={() => activateTab(tab.id)}
          onDoubleClick={() => startRename(tab.id, tabDisplayTitle(tab))}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', cursor: 'pointer',
            background: activeTabId === tab.id ? '#fff' : 'transparent',
            borderBottom: activeTabId === tab.id ? '2px solid #333' : '2px solid transparent',
          }}
        >
          {editingId === tab.id ? (
            <input
              autoFocus
              value={editingValue}
              onChange={(e) => setEditingValue(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename();
                if (e.key === 'Escape') setEditingId(null);
              }}
              onClick={(e) => e.stopPropagation()}
              style={{ fontSize: 14, padding: '2px 4px', width: 120 }}
            />
          ) : (
            <span>{tabDisplayIcon(tab)} {tabDisplayTitle(tab)}</span>
          )}

          {tab.customTitle && editingId !== tab.id && (
            <button
              onClick={(e) => { e.stopPropagation(); clearCustomTitle(tab.id); }}
              aria-label={`Restaurar nome padrão da aba ${tabDisplayTitle(tab)}`}
              title="Restaurar nome padrão"
              style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#bbb', fontSize: 12 }}
            >
              ↺
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
            aria-label={`Fechar aba ${tabDisplayTitle(tab)}`}
            style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#999' }}
          >
            ✕
          </button>
        </div>
      ))}

      <button
        onClick={() => openNewTab('/')}
        aria-label="Nova aba"
        style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '8px 12px', fontSize: 16 }}
      >
        +
      </button>
    </div>
  );
}
