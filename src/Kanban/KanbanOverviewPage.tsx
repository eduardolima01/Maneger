import { useMemo, useState } from 'react';
import Button from '@/components/layout/Button';
import { useAllKanbans } from '@/lib/hooks/kanban/useAllKanbans';
import { useKanbanOverviewPrefs } from '@/lib/hooks/kanban/useKanbanOverviewPrefs';
import KanbanTile from './KanbanTile';
import KanbanBoardModal from './KanbanBoardModal';
import CreateKanbanModal from './CreateKanbanModal';
import type { KanbanWithProject } from '@/types/kanban.types';

export default function KanbanOverviewPage() {
  const { kanbans, columnCounts, loading, reload } = useAllKanbans();
  const { prefs, loading: loadingPrefs, togglePinned, toggleHidden } = useKanbanOverviewPrefs();

  const [search, setSearch] = useState('');
  const [groupByProject, setGroupByProject] = useState(true);
  const [showArchived, setShowArchived] = useState(true);
  const [showHidden, setShowHidden] = useState(false);
  const [selectedKanban, setSelectedKanban] = useState<KanbanWithProject | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return kanbans.filter((k) => {
      if (!showArchived && k.archived) return false;
      if (!showHidden && prefs.hiddenKanbanIds.includes(k.id)) return false;
      if (!term) return true;
      return k.name.toLowerCase().includes(term) || k.projectName.toLowerCase().includes(term);
    });
  }, [kanbans, search, showArchived, showHidden, prefs.hiddenKanbanIds]);

  const pinned = useMemo(
    () => visible.filter((k) => prefs.pinnedKanbanIds.includes(k.id)),
    [visible, prefs.pinnedKanbanIds]
  );
  const unpinned = useMemo(
    () => visible.filter((k) => !prefs.pinnedKanbanIds.includes(k.id)),
    [visible, prefs.pinnedKanbanIds]
  );

  const grouped = useMemo(() => {
    if (!groupByProject) return { '': unpinned };
    const map: Record<string, KanbanWithProject[]> = {};
    for (const k of unpinned) {
      const key = k.projectName;
      if (!map[key]) map[key] = [];
      map[key].push(k);
    }
    return map;
  }, [unpinned, groupByProject]);

  function renderTile(k: KanbanWithProject) {
    return (
      <KanbanTile
        key={k.id}
        kanban={k}
        columnCounts={columnCounts[k.id] ?? []}
        isPinned={prefs.pinnedKanbanIds.includes(k.id)}
        isHidden={prefs.hiddenKanbanIds.includes(k.id)}
        onClick={() => setSelectedKanban(k)}
        onTogglePinned={() => togglePinned(k.id)}
        onToggleHidden={() => toggleHidden(k.id)}
      />
    );
  }

  if (loading || loadingPrefs) return <p>Carregando...</p>;

  return (
    <div style={{ maxWidth: 900, margin: '2rem auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>Kanban</h1>
        <Button variant="primary" onClick={() => setCreateOpen(true)}>+ Novo Kanban</Button>
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar Kanban ou projeto..."
          style={{ flex: 1, minWidth: 200, padding: 8, fontSize: 14 }}
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
          <input type="checkbox" checked={groupByProject} onChange={(e) => setGroupByProject(e.target.checked)} />
          Agrupar por projeto
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
          Mostrar arquivados
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
          <input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} />
          Mostrar ocultos
        </label>
      </div>

      {visible.length === 0 && (
        <p style={{ color: '#999', fontSize: 14, textAlign: 'center', padding: 40 }}>
          {kanbans.length === 0 ? 'Nenhum Kanban criado ainda em nenhum projeto.' : 'Nenhum resultado para essa busca.'}
        </p>
      )}

      {pinned.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>📌 Fixados</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
            {pinned.map(renderTile)}
          </div>
        </div>
      )}

      {Object.entries(grouped).map(([groupName, items]) => (
        items.length > 0 && (
          <div key={groupName} style={{ marginBottom: 20 }}>
            {groupByProject && groupName && (
              <h3 style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>{groupName}</h3>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
              {items.map(renderTile)}
            </div>
          </div>
        )
      ))}

      <KanbanBoardModal
        isOpen={selectedKanban !== null}
        onClose={() => setSelectedKanban(null)}
        kanban={selectedKanban}
        onKanbanChanged={reload}
        onKanbanDeleted={() => {
          setSelectedKanban(null);
          reload();
        }}
      />

      <CreateKanbanModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={reload}
      />
    </div>
  );
}
