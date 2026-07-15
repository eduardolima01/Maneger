import { useState } from 'react';
import Button from '@/components/layout/Button';
import { formatFieldValue } from '@/lib/utils/fieldPreview';
import type { Template } from '@/types/template.types';
import type { Log, LogQueryOptions } from '@/types/log.types';

interface LogGroupCardProps {
  groupName: string;
  template: Template;
  logs: Log[];
  totalCount: number;
  query: LogQueryOptions;
  onQueryChange: (query: LogQueryOptions) => void;
  onNewLog: () => void;
  onEditLog: (log: Log) => void;
  onDuplicateLog: (id: string) => void;
  onRequestDeleteLog: (id: string) => void;
  onRenameGroup: (name: string) => void;
  onRequestDeleteGroup: () => void;
}

export default function LogGroupCard({
  groupName, template, logs, totalCount, query, onQueryChange,
  onNewLog, onEditLog, onDuplicateLog, onRequestDeleteLog, onRenameGroup, onRequestDeleteGroup,
}: LogGroupCardProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(groupName);

  const totalPages = Math.max(1, Math.ceil(totalCount / (query.pageSize ?? 20)));

  return (
    <div style={{ marginBottom: 16, border: '1px solid #eee', borderRadius: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', backgroundColor: '#fafafa', borderBottom: collapsed ? 'none' : '1px solid #eee' }}>
        <button onClick={() => setCollapsed((v) => !v)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 12 }}>
          {collapsed ? '▶' : '▼'}
        </button>

        {editingName ? (
          <input
            autoFocus
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={() => { setEditingName(false); nameDraft.trim() && nameDraft !== groupName && onRenameGroup(nameDraft.trim()); }}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            style={{ fontSize: 13, fontWeight: 600, flex: 1, padding: 2 }}
          />
        ) : (
          <span onClick={() => setEditingName(true)} style={{ fontSize: 13, fontWeight: 600, flex: 1, cursor: 'text' }}>
            {groupName} <span style={{ fontWeight: 400, color: '#999' }}>· {template.name} · {totalCount} logs</span>
          </span>
        )}

        <button onClick={onRequestDeleteGroup} title="Excluir grupo" style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#c62828', fontSize: 12 }}>✕</button>
      </div>

      {!collapsed && (
        <div style={{ padding: 8 }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <input
              value={query.search ?? ''}
              onChange={(e) => onQueryChange({ ...query, search: e.target.value, page: 1 })}
              placeholder="Buscar nos logs..."
              style={{ flex: 1, padding: 6, fontSize: 13 }}
            />
            <select
              value={query.sortByFieldKey ?? ''}
              onChange={(e) => onQueryChange({ ...query, sortByFieldKey: e.target.value || null })}
              style={{ padding: 6, fontSize: 12 }}
            >
              <option value="">Ordenar por data</option>
              {template.fields.map((f) => (
                <option key={f.key} value={f.key}>Ordenar por {f.label}</option>
              ))}
            </select>
            <select
              value={query.sortDir}
              onChange={(e) => onQueryChange({ ...query, sortDir: e.target.value as 'asc' | 'desc' })}
              style={{ padding: 6, fontSize: 12 }}
            >
              <option value="desc">↓</option>
              <option value="asc">↑</option>
            </select>
            <Button variant="primary" onClick={onNewLog}>+ Log</Button>
          </div>

          {template.fields.length === 0 && (
            <p style={{ fontSize: 13, color: '#999' }}>Este template ainda não tem campos definidos.</p>
          )}

          {template.fields.length > 0 && logs.length === 0 && (
            <p style={{ fontSize: 13, color: '#999' }}>Nenhum log ainda.</p>
          )}

          {template.fields.length > 0 && logs.length > 0 && (
            <div style={{ overflowX: 'auto', border: '1px solid #eee', borderRadius: 4 }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
                <thead>
                  <tr style={{ backgroundColor: '#fafafa' }}>
                    {template.fields.map((f) => (
                      <th key={f.id} style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #eee', whiteSpace: 'nowrap' }}>
                        {f.label}
                      </th>
                    ))}
                    <th style={{ borderBottom: '1px solid #eee', width: 80 }} />
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                      {template.fields.map((f) => (
                        <td key={f.id} style={{ padding: '6px 8px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200 }}>
                          {formatFieldValue(f, log.values[f.key])}
                        </td>
                      ))}
                      <td
                        style={{
                          display: 'flex',
                          gap: 4,
                          padding: '4px 8px',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        <button
                          onClick={() => onEditLog(log)}
                          title="Editar"
                          style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 12 }}>✎</button>
                        <button
                          onClick={() => onDuplicateLog(log.id)} title="Duplicar" style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 12 }}>⧉</button>
                        <button
                          onClick={() => onRequestDeleteLog(log.id)} title="Excluir" style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#c62828', fontSize: 12 }}>✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 8, fontSize: 12 }}>
              <button disabled={(query.page ?? 1) <= 1} onClick={() => onQueryChange({ ...query, page: (query.page ?? 1) - 1 })}>‹</button>
              <span>{query.page ?? 1} / {totalPages}</span>
              <button disabled={(query.page ?? 1) >= totalPages} onClick={() => onQueryChange({ ...query, page: (query.page ?? 1) + 1 })}>›</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
