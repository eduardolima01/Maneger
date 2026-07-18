import { useEffect, useMemo, useState } from 'react';
import {
  DndContext, PointerSensor, useSensor, useSensors, closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import Button from '@/components/layout/Button';
import ProjectMoveDialog from '../ProjectMoveDialog';
import ProjectSettingsModal from '../ProjectSettingsModal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import CreateSubprojectModal from './CreateSubprojectModal';
import SubprojectCard from './SubprojectCard';
import { useSubprojects } from '@/lib/hooks/useSubprojects';
import { useProjectModules } from '@/lib/hooks/useProjectModules';
import { getModuleCountsByProjectIds } from '@/lib/api/projectModuleCounts';
import { getAllProjects } from '@/lib/api/projects';
import type { ProjectType } from '@/types/project.types';
import type { ModuleCounts } from '@/lib/api/projectModuleCounts';

interface SubprojectsSectionProps {
  projectId: string;
  projectName: string;
  onOpenSubproject?: (project: ProjectType) => void;
  onEditSubproject?: (project: ProjectType) => void;
}

function SubprojectEditModal({ project, onClose, onUpdated, onDeleted }: {
  project: ProjectType; onClose: () => void; onUpdated: () => void; onDeleted: () => void;
}) {
  const { modules, toggle } = useProjectModules(project.id);
  return (
    <ProjectSettingsModal
      isOpen
      onClose={onClose}
      project={project}
      modules={modules}
      onToggleModule={toggle}
      onUpdated={onUpdated}
      onDeleted={onDeleted}
    />
  );
}

export default function SubprojectsSection({ projectId, projectName, onOpenSubproject, onEditSubproject }: SubprojectsSectionProps) {
  const { subprojects, loading, reload, createProject, remove, duplicate, move, reorder } = useSubprojects(projectId);

  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [moveTargetId, setMoveTargetId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [counts, setCounts] = useState<Record<string, ModuleCounts>>({});
  const [allProjects, setAllProjects] = useState<ProjectType[]>([]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  useEffect(() => {
    if (subprojects.length > 0) {
      getModuleCountsByProjectIds(subprojects.map((s) => s.id)).then(setCounts);
    }
  }, [subprojects]);

  useEffect(() => {
    if (moveTargetId) getAllProjects().then(setAllProjects);
  }, [moveTargetId]);

  const filtered = useMemo(
    () => subprojects.filter((s) => s.name.toLowerCase().includes(search.toLowerCase())),
    [subprojects, search]
  );

  const editingProject = subprojects.find((s) => s.id === editingId) ?? null;
  const moveTarget = subprojects.find((s) => s.id === moveTargetId) ?? null;

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = subprojects.map((s) => s.id);
    const fromIndex = ids.indexOf(active.id as string);
    const toIndex = ids.indexOf(over.id as string);
    if (fromIndex === -1 || toIndex === -1) return;
    reorder(arrayMove(ids, fromIndex, toIndex));
  }

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>Subprojetos</h3>
        {subprojects.length > 0 && (
          <Button variant="primary" onClick={() => setCreateOpen(true)}>+ Novo Subprojeto</Button>
        )}
      </div>

      {loading && <p style={{ color: '#666', fontSize: 14 }}>Carregando...</p>}

      {!loading && subprojects.length === 0 && (
        <div style={{ textAlign: 'center', padding: 24, border: '1px dashed #ddd', borderRadius: 8 }}>
          <p style={{ color: '#666', fontSize: 14, marginBottom: 12 }}>Este Projeto ainda não possui Subprojetos.</p>
          <Button variant="primary" onClick={() => setCreateOpen(true)}>Criar primeiro Subprojeto</Button>
        </div>
      )}

      {!loading && subprojects.length > 0 && (
        <>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar subprojeto..."
            style={{ width: '100%', padding: 8, fontSize: 14, marginBottom: 12 }}
          />

          {search.trim() && (
            <p style={{ fontSize: 11, color: '#999', marginTop: -8, marginBottom: 8 }}>
              Reordenar por arraste fica desativado durante a busca.
            </p>
          )}

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={filtered.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              {filtered.map((sp) => (
                <SubprojectCard
                  key={sp.id}
                  project={sp}
                  counts={counts[sp.id]}
                  onOpen={onOpenSubproject ? () => onOpenSubproject(sp) : undefined}
                  onEdit={() => setEditingId(sp.id)}
                  onEditInPlace={onEditSubproject ? () => onEditSubproject(sp) : undefined}
                  onDuplicate={() => duplicate(sp.id)}
                  onMove={() => setMoveTargetId(sp.id)}
                  onRequestDelete={() => setDeleteTarget({ id: sp.id, name: sp.name })}
                />
              ))}
            </SortableContext>
          </DndContext>
        </>
      )}

      <CreateSubprojectModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        parentProjectId={projectId}
        parentName={projectName}
        onCreateProject={createProject}
        onReload={reload}
      />

      {editingProject && (
        <SubprojectEditModal
          project={editingProject}
          onClose={() => setEditingId(null)}
          onUpdated={reload}
          onDeleted={() => { setEditingId(null); reload(); }}
        />
      )}

      <ProjectMoveDialog
        isOpen={moveTargetId !== null}
        onClose={() => setMoveTargetId(null)}
        project={moveTarget}
        allProjects={allProjects}
        onMove={(newParentId) => moveTargetId && move(moveTargetId, newParentId)}
      />

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Excluir subprojeto?"
        message={`Deseja realmente excluir "${deleteTarget?.name}"? Todos os dados dele (Tasks, Logs, Kanban, subprojetos dele) também serão excluídos. Esta ação não poderá ser desfeita.`}
        onConfirm={() => { if (deleteTarget) remove(deleteTarget.id); setDeleteTarget(null); }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
