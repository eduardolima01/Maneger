import { ColumnCardCount } from '@/lib/api/kanban/kanbanCards';
import { Kanban } from '@/types/kanban.types';
import { convertFileSrc } from '@tauri-apps/api/core';
import { useState } from 'react';

interface KanbanTileProps {
  kanban: Kanban & { projectName?: string; projectColor?: string | null; projectCoverPath?: string | null; projectArchived?: boolean };
  columnCounts: ColumnCardCount[];
  isPinned: boolean;
  isHidden: boolean;
  onClick: () => void;
  onTogglePinned: () => void;
  onToggleHidden: () => void;
  compact?: boolean;
}

export default function KanbanTile({ kanban, columnCounts, isPinned, isHidden, onClick, onTogglePinned, onToggleHidden, compact = false }: KanbanTileProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const projectColor = kanban.projectColor ?? kanban.color ?? '#1a73e8';
  const totalCards = columnCounts.reduce((sum, c) => sum + c.count, 0);

  return (
    <div
      onClick={onClick}
      className="bg-white dark:bg-neutral-800 hover:bg-gray-50 dark:hover:bg-neutral-700 text-neutral-900 dark:text-neutral-100 border border-neutral-200 dark:border-neutral-700"
      style={{
        borderLeft: `4px solid ${kanban.color ?? projectColor}`,
        borderRadius: 8,
        padding: 0,
        cursor: 'pointer',
        opacity: kanban.archived || isHidden ? 0.55 : 1,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          backgroundColor: projectColor,
          padding: '10px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        {kanban.projectCoverPath ? (
          <img
            src={convertFileSrc(kanban.projectCoverPath)}
            style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '2px solid rgba(255,255,255,0.6)' }}
          />
        ) : (
          <span style={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.3)', flexShrink: 0 }} />
        )}
        <span className="text-white" style={{ fontWeight: 600, fontSize: 14, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {isPinned && '📌 '}
          {kanban.isDefault && '⭐ '}{kanban.name}
        </span>
      </div>

      {!compact && (
        <div style={{ position: 'absolute', top: 8, right: 8 }} onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="text-white"
            style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 14 }}
          >
            ⋮
          </button>
          {menuOpen && (
            <div
              onMouseLeave={() => setMenuOpen(false)}
              className="bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 border border-neutral-300 dark:border-neutral-600"
              style={{ position: 'absolute', right: 0, top: '100%', borderRadius: 4, boxShadow: '0 2px 8px rgba(0,0,0,0.12)', zIndex: 10, minWidth: 150 }}
            >
              <button
                onClick={() => { onTogglePinned(); setMenuOpen(false); }}
                className="hover:bg-neutral-100 dark:hover:bg-neutral-700"
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: 13, border: 'none', cursor: 'pointer' }}
              >
                {isPinned ? '📌 Desafixar' : '📌 Fixar no topo'}
              </button>
              <button
                onClick={() => { onToggleHidden(); setMenuOpen(false); }}
                className="hover:bg-neutral-100 dark:hover:bg-neutral-700"
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: 13, border: 'none', cursor: 'pointer' }}
              >
                {isHidden ? '👁 Mostrar' : '🙈 Ocultar'}
              </button>
            </div>
          )}
        </div>
      )}

      <div style={{ padding: '10px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <span className="text-neutral-500 dark:text-neutral-400" style={{ fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {kanban.projectName}
          </span>
          {kanban.archived && (
            <span className="bg-neutral-200 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-300" style={{ fontSize: 10, borderRadius: 3, padding: '2px 6px' }}>
              Arquivado
            </span>
          )}
          {isHidden && (
            <span className="bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300" style={{ fontSize: 10, borderRadius: 3, padding: '2px 6px' }}>
              Oculto
            </span>
          )}
          {kanban.projectArchived && <span className="text-red-600 dark:text-red-400" style={{ fontSize: 10 }}>(projeto arquivado)</span>}
        </div>

        {kanban.description && (
          <p className="text-neutral-400 dark:text-neutral-500" style={{ fontSize: 11, margin: '4px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {kanban.description}
          </p>
        )}

        <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {columnCounts.length === 0 && (
            <span className="text-neutral-400 dark:text-neutral-500" style={{ fontSize: 11 }}>Sem colunas visíveis</span>
          )}
          {columnCounts.map((c) => (
            <span
              key={c.columnId}
              title={`${c.columnName}: ${c.count} card${c.count !== 1 ? 's' : ''}`}
              className="bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-200"
              style={{
                fontSize: 10, borderRadius: 10,
                padding: '2px 8px', display: 'flex', alignItems: 'center', gap: 3,
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 70 }}>{c.columnName}</span>
              <span style={{ fontWeight: 700 }}>{c.count}</span>
            </span>
          ))}
        </div>
        {totalCards > 0 && (
          <div className="text-neutral-400 dark:text-neutral-500" style={{ marginTop: 4, fontSize: 10 }}>{totalCards} card{totalCards !== 1 ? 's' : ''} no total</div>
        )}
      </div>
    </div>
  );
}
