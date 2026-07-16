import { useState } from 'react';
import {
  DndContext, PointerSensor, useSensor, useSensors, closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import ProjectMoveDialog from '@/Projects/Project/ProjectMoveDialog';
import ProjectTreeNode from './ProjectTreeNode';
import { useProjectTree } from '@/lib/hooks/project/useProjectTree';
import CreateSubprojectModal from './Project/SubProject/CreateSubprojectModal';

interface ProjectTreeProps {
  api: ReturnType<typeof useProjectTree>;
}

export default function ProjectTree({ api }: ProjectTreeProps) {
  const {
    tree,
    flat,
    expandedIds,
    toggleExpanded,
    createProject,
    rename,
    duplicate,
    move,
    reorderSiblings,
    remove
  } = api;

  const [moveTargetId, setMoveTargetId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string; descendantCount: number } | null>(null);
  const [moveBlockedMessage, setMoveBlockedMessage] = useState<string | null>(null);
  const [newSubprojectParent, setNewSubprojectParent] = useState<{ id: string; name: string } | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  function handleNewSubproject(parentId: string) {
    const parent = flat.find((p) => p.id === parentId);
    if (parent) setNewSubprojectParent({ id: parent.id, name: parent.name });
  }

  function handleRename(id: string, currentName: string) {
    const name = window.prompt('Novo nome:', currentName);
    if (name?.trim() && name !== currentName) rename(id, name.trim());
  }

  async function handleMove(newParentId: string | null) {
    if (!moveTargetId) return;
    const ok = await move(moveTargetId, newParentId);
    if (!ok) setMoveBlockedMessage('Não é possível mover um projeto para dentro de um dos seus próprios subprojetos.');
    setMoveTargetId(null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeParentId = (active.data.current?.parentId as string | null) ?? null;
    const overParentId = (over.data.current?.parentId as string | null) ?? null;
    if (activeParentId !== overParentId) return; // reorder só dentro do mesmo pai — mover entre pais é via menu "Mover para..."

    const siblings = flat.filter((p) => p.parentProjectId === activeParentId)
      .sort((a, b) => a.position - b.position);
    const ids = siblings.map((p) => p.id);
    const fromIndex = ids.indexOf(active.id as string);
    const toIndex = ids.indexOf(over.id as string);
    if (fromIndex === -1 || toIndex === -1) return;

    reorderSiblings(arrayMove(ids, fromIndex, toIndex));
  }

  const moveTarget = flat.find((p) => p.id === moveTargetId) ?? null;

  return (
    <div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext
          items={tree.map((n) => n.id)}
          strategy={verticalListSortingStrategy}
        >
          {tree.map((node) => (
            <ProjectTreeNode
              key={node.id}
              node={node}
              depth={0}
              expandedIds={expandedIds}
              onToggleExpanded={toggleExpanded}
              onNewSubproject={handleNewSubproject}
              onRename={handleRename}
              onDuplicate={duplicate}
              onMove={setMoveTargetId}
              onRequestDelete={(id, name, descendantCount) => setPendingDelete({ id, name, descendantCount })}
            />
          ))}
        </SortableContext>
      </DndContext>

      {newSubprojectParent && (
        <CreateSubprojectModal
          isOpen={!!newSubprojectParent}
          onClose={() => setNewSubprojectParent(null)}
          parentProjectId={newSubprojectParent.id}
          parentName={newSubprojectParent.name}
          onCreateProject={createProject}
          onReload={api.reload}
        />
      )}


      <ProjectMoveDialog
        isOpen={moveTargetId !== null}
        onClose={() => setMoveTargetId(null)}
        project={moveTarget}
        allProjects={flat}
        onMove={handleMove}
      />

      <ConfirmDialog
        isOpen={pendingDelete !== null}
        title="Excluir projeto?"
        message={
          pendingDelete && pendingDelete.descendantCount > 0
            ? `Deseja realmente excluir "${pendingDelete.name}"? Todos os ${pendingDelete.descendantCount} subprojeto(s) e seus dados (Tasks, Logs, Kanbans, etc.) também serão excluídos. Esta ação não poderá ser desfeita.`
            : `Deseja realmente excluir "${pendingDelete?.name}"? Esta ação não poderá ser desfeita.`
        }
        onConfirm={() => { if (pendingDelete) remove(pendingDelete.id); setPendingDelete(null); }}
        onCancel={() => setPendingDelete(null)}
      />

      <ConfirmDialog
        isOpen={moveBlockedMessage !== null}
        title="Movimento não permitido"
        message={moveBlockedMessage ?? ''}
        confirmLabel="Entendi"
        onConfirm={() => setMoveBlockedMessage(null)}
        onCancel={() => setMoveBlockedMessage(null)}
      />
    </div>
  );
}

