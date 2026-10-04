import { useState } from 'react';
import {
  DndContext, PointerSensor, useSensor, useSensors, closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Button from '@/components/layout/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import KanbanBoard from './KanbanBoard';
import { useKanbans } from '@/lib/hooks/useKanbans';
import { getLastOpenKanban, setLastOpenKanban } from '@/lib/hooks/useLastOpenKanban';
import type { Kanban } from '@/types/kanban.types';

interface KanbanTabProps {
  kanban: Kanban;
  active: boolean;
  onSelect: () => void;
  onRequestMenu: () => void;
}

function KanbanTab({ kanban, active, onSelect, onRequestMenu }: KanbanTabProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: kanban.id });
  const style: React.CSSProperties = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onSelect}
      className="flex items-center gap-1"
    >
      <button
        className={
          active
            ? 'border-0 border-b-2 border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400'
            : 'border-0 border-b-2 border-transparent text-neutral-500 dark:text-neutral-400'
        }
        style={{
          padding: '6px 12px',
          fontSize: 13,
          fontWeight: 600,
          background: 'none',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        {kanban.isDefault && '⭐ '}{kanban.color && <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', backgroundColor: kanban.color, marginRight: 4 }} />}{kanban.name}
      </button>
      <button onClick={(e) => { e.stopPropagation(); onRequestMenu(); }} className="text-neutral-400 dark:text-neutral-500" style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 12 }}>⋮</button>
    </div>
  );
}

interface KanbanManagementProps {
  projectId: string;
}

export default function KanbanManagement({ projectId }: KanbanManagementProps) {
  const { kanbans, loading, create, rename, setDefault, archive, duplicate, remove, reorder } = useKanbans(projectId);

  const [activeId, setActiveId] = useState<string | null>(() => getLastOpenKanban(projectId));
  const [newName, setNewName] = useState('');
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const activeKanban = kanbans.find((k) => k.id === activeId) ?? kanbans.find((k) => k.isDefault) ?? kanbans[0] ?? null;

  function selectKanban(id: string) {
    setActiveId(id);
    setLastOpenKanban(projectId, id);
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    const id = await create({ name: newName.trim() });
    setNewName('');
    selectKanban(id);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = kanbans.map((k) => k.id);
    const fromIndex = ids.indexOf(active.id as string);
    const toIndex = ids.indexOf(over.id as string);
    if (fromIndex === -1 || toIndex === -1) return;
    reorder(arrayMove(ids, fromIndex, toIndex));
  }

  if (loading) return <p className="text-neutral-500 dark:text-neutral-400" style={{ fontSize: 14 }}>Carregando...</p>;

  if (kanbans.length === 0) {
    return (
      <div className="border border-dashed border-neutral-300 dark:border-neutral-600" style={{ textAlign: 'center', padding: 24, borderRadius: 8 }}>
        <p className="text-neutral-500 dark:text-neutral-400" style={{ fontSize: 14, marginBottom: 12 }}>Este Projeto ainda não possui nenhum Kanban.</p>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nome do Kanban..." className="bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 dark:border-neutral-600 dark:[color-scheme:dark]" style={{ padding: 8, fontSize: 14 }} />
          <Button variant="primary" onClick={handleCreate}>Criar primeiro Kanban</Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="border-b border-neutral-200 dark:border-neutral-700" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, position: 'relative' }}>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={kanbans.map((k) => k.id)} strategy={verticalListSortingStrategy}>
            <div style={{ display: 'flex', overflowX: 'auto' }}>
              {kanbans.map((k) => (
                <div key={k.id} style={{ position: 'relative' }}>
                  <KanbanTab
                    kanban={k}
                    active={activeKanban?.id === k.id}
                    onSelect={() => selectKanban(k.id)}
                    onRequestMenu={() => setMenuFor(menuFor === k.id ? null : k.id)}
                  />

                  {menuFor === k.id && (
                    <div
                      onMouseLeave={() => setMenuFor(null)}
                      className="bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 border border-neutral-300 dark:border-neutral-600"
                      style={{ position: 'absolute', top: '100%', left: 0, borderRadius: 4, boxShadow: '0 2px 8px rgba(0,0,0,0.12)', zIndex: 10, minWidth: 160 }}
                    >
                      {([
                        ['Renomear', () => { setRenamingId(k.id); setRenameDraft(k.name); }],
                        ['Definir como padrão', () => setDefault(k.id)],
                        ['Duplicar', () => duplicate(k.id)],
                        [k.archived ? 'Desarquivar' : 'Arquivar', () => archive(k.id, !k.archived)],
                        ['Excluir', () => setDeleteTarget({ id: k.id, name: k.name })],
                      ] as [string, () => void][]).map(([label, action]) => (
                        <button
                          key={label as string}
                          onClick={() => { (action as () => void)(); setMenuFor(null); }}
                          className={`hover:bg-neutral-100 dark:hover:bg-neutral-700 ${label === 'Excluir' ? 'text-red-600 dark:text-red-400' : 'text-neutral-900 dark:text-neutral-100'}`}
                          style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: 13, border: 'none', cursor: 'pointer' }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </SortableContext>
        </DndContext>

        <div style={{ display: 'flex', gap: 4, marginLeft: 'auto', paddingBottom: 6 }}>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="Novo Kanban..."
            className="bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 dark:border-neutral-600 dark:[color-scheme:dark]"
            style={{ padding: 6, fontSize: 12, width: 140 }}
          />
          <Button variant="secondary" onClick={handleCreate}>+</Button>
        </div>
      </div>

      {renamingId && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          <input
            autoFocus
            value={renameDraft}
            onChange={(e) => setRenameDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (rename(renamingId, renameDraft.trim()), setRenamingId(null))}
            className="bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 dark:border-neutral-600 dark:[color-scheme:dark]"
            style={{ flex: 1, padding: 6, fontSize: 13 }}
          />
          <Button variant="primary" onClick={() => { rename(renamingId, renameDraft.trim()); setRenamingId(null); }}>Salvar</Button>
          <Button variant="secondary" onClick={() => setRenamingId(null)}>Cancelar</Button>
        </div>
      )}

      {activeKanban && <KanbanBoard
        key={activeKanban.id}
        kanban={activeKanban}
      />}

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Excluir Kanban?"
        message={`Deseja realmente excluir "${deleteTarget?.name}"? As Colunas e a organização deste Kanban serão apagadas — as Tasks em si permanecem intactas no Projeto. Esta ação não pode ser desfeita.`}
        onConfirm={() => {
          if (deleteTarget) {
            remove(deleteTarget.id);
            if (activeId === deleteTarget.id) setActiveId(null);
          }
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
