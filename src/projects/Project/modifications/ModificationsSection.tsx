import { useEffect, useRef, useState, useCallback } from 'react';
import Button from '@/components/layout/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import ContextMenu from '@/components/ui/ContextMenu';
import ModificationRuntime from './runtime/ModificationRuntime';
import * as modsApi from './api/modifications';
import type { ModificationManifest } from '@/types/modification.types';

interface ModificationsSectionProps {
  projectId: string;
  projectName: string;
  focusKey?: string | null;
  focusNonce?: number;
}

export default function ModificationsSection({ projectId, projectName, focusKey, focusNonce }: ModificationsSectionProps) {
  const [keys, setKeys] = useState<string[]>([]);
  const [manifests, setManifests] = useState<Record<string, ModificationManifest>>({});
  const [loading, setLoading] = useState(true);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editingSource, setEditingSource] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [cardMenu, setCardMenu] = useState<{ key: string; x: number; y: number } | null>(null);
  const [highlightKey, setHighlightKey] = useState<string | null>(null);

  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const reload = useCallback(async () => {
    setLoading(true);
    const list = await modsApi.listModifications(projectId);
    const entries = await Promise.all(list.map(async (k) => [k, await modsApi.loadManifest(projectId, k)] as const));
    const map: Record<string, ModificationManifest> = {};
    for (const [k, m] of entries) if (m) map[k] = m;
    setKeys(list.filter((k) => map[k]));
    setManifests(map);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { reload(); }, [reload]);

  // pulo vindo de fora (avatar na faixa de abas): rola até o card e dá um destaque temporário
  useEffect(() => {
    if (!focusKey) return;
    const el = cardRefs.current[focusKey];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setHighlightKey(focusKey);
      const timeout = setTimeout(() => setHighlightKey(null), 1500);
      return () => clearTimeout(timeout);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusNonce]);

  async function handleCreate() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    await modsApi.createModification(projectId, trimmed);
    setNewName('');
    setCreating(false);
    await reload();
  }

  async function handleToggleEnabled(key: string) {
    const manifest = manifests[key];
    if (!manifest) return;
    await modsApi.setModificationEnabled(projectId, key, !manifest.enabled);
    await reload();
  }

  async function handleOpenEditor(key: string) {
    const source = await modsApi.loadEntry(projectId, key);
    setEditingSource(source);
    setEditingKey(key);
  }

  async function handleSaveEditor() {
    if (!editingKey || editingSource === null) return;
    await modsApi.saveEntry(projectId, editingKey, editingSource);
    const manifest = manifests[editingKey];
    if (manifest) {
      await modsApi.saveManifest(projectId, editingKey, { ...manifest, updatedAt: new Date().toISOString() });
    }
    setEditingKey(null);
    setEditingSource(null);
    await reload();
  }

  function openCardMenu(key: string, e: React.MouseEvent) {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setCardMenu({ key, x: rect.left, y: rect.bottom + 4 });
  }

  if (loading) return <p style={{ color: '#666', fontSize: 14 }}>Carregando modificações...</p>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>Modificações</h3>
        <Button variant="primary" onClick={() => setCreating(true)}>+ Nova modificação</Button>
      </div>

      {creating && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="Nome da modificação (ex: Workout Log)"
            style={{ flex: 1, padding: 8, fontSize: 13 }}
          />
          <Button variant="primary" onClick={handleCreate}>Criar</Button>
          <Button variant="secondary" onClick={() => { setCreating(false); setNewName(''); }}>Cancelar</Button>
        </div>
      )}

      {keys.length === 0 && !creating && (
        <p style={{ color: '#999', fontSize: 13 }}>Nenhuma modificação criada neste projeto ainda.</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {keys.map((key) => {
          const manifest = manifests[key];
          const isEditing = editingKey === key;
          const isHighlighted = highlightKey === key;

          return (
            <div
              key={key}
              ref={(el) => { cardRefs.current[key] = el; }}
              style={{
                border: '1px solid #e0e0e0',
                borderRadius: 8,
                padding: 12,
                transition: 'box-shadow 0.3s, border-color 0.3s',
                boxShadow: isHighlighted ? '0 0 0 3px rgba(26,115,232,0.35)' : undefined,
                borderColor: isHighlighted ? '#1a73e8' : '#e0e0e0',
                opacity: manifest.enabled ? 1 : 0.6,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>{manifest.name}</span>
                {!manifest.enabled && (
                  <span style={{ fontSize: 11, color: '#999', fontStyle: 'italic' }}>desativada</span>
                )}
                <button
                  onClick={(e) => openCardMenu(key, e)}
                  title="Configurações da modificação"
                  style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 15, color: '#666', padding: '2px 6px' }}
                >
                  ⚙
                </button>
              </div>

              {isEditing ? (
                <div>
                  <textarea
                    value={editingSource ?? ''}
                    onChange={(e) => setEditingSource(e.target.value)}
                    spellCheck={false}
                    style={{ width: '100%', minHeight: 260, fontFamily: 'monospace', fontSize: 12, padding: 8, boxSizing: 'border-box', border: '1px solid #ddd', borderRadius: 4 }}
                  />
                  <div style={{ display: 'flex', gap: 6, marginTop: 6, justifyContent: 'flex-end' }}>
                    <Button variant="secondary" onClick={() => { setEditingKey(null); setEditingSource(null); }}>Cancelar</Button>
                    <Button variant="primary" onClick={handleSaveEditor}>Salvar e recarregar</Button>
                  </div>
                </div>
              ) : (
                <div style={{ height: 780, overflowY: 'auto', overflowX: 'hidden' }}>
                  <ModificationRuntime key={`${key}-${manifest.updatedAt}`} projectId={projectId} projectName={projectName} modKey={key} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {cardMenu && (
        <ContextMenu
          x={cardMenu.x}
          y={cardMenu.y}
          onClose={() => setCardMenu(null)}
          items={[
            {
              label: manifests[cardMenu.key]?.enabled ? '⏸ Desativar' : '▶ Ativar',
              onClick: () => handleToggleEnabled(cardMenu.key),
            },
            { label: '✏️ Editar código', onClick: () => handleOpenEditor(cardMenu.key) },
            { label: '🗑 Excluir', onClick: () => setDeleteTarget(cardMenu.key), danger: true },
          ]}
        />
      )}

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Excluir modificação?"
        message={`A modificação "${deleteTarget ? manifests[deleteTarget]?.name : ''}" e todo o seu código/dados serão apagados permanentemente.`}
        confirmLabel="Excluir"
        onConfirm={async () => {
          if (deleteTarget) {
            await modsApi.deleteModification(projectId, deleteTarget);
          }
          setDeleteTarget(null);
          await reload();
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
