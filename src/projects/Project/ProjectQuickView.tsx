import { useEffect, useState } from 'react';
import Button from '@/components/layout/Button';
import { useProjectModules } from '@/lib/hooks/useProjectModules';
import { getAllProjects } from '@/lib/api/projects';
import { buildProjectTree, flattenSubtree } from '@/lib/utils/projectTree';
import type { ProjectType } from '../../types/project.types';
import ProjectInlineEditForm from '../components/ProjectInlineEditForm';
import ModuleToggles from './modules/ModuleToggles';
import ProjectModuleTabs from './modules/ProjectModuleTabs';
import SubprojectsSection from './SubProject/SubprojectsSection';
import { buildProjectBreadcrumbPath } from '../utils/projectBreadcrumb';

interface ProjectQuickViewProps {
  project: ProjectType;
  onGoToProject: (projectId: string) => void;
}

export default function ProjectQuickView({ project, onGoToProject }: ProjectQuickViewProps) {
  const [allProjects, setAllProjects] = useState<ProjectType[]>([]);
  const [currentId, setCurrentId] = useState(project.id);
  const [editing, setEditing] = useState(false);

  const { modules, loading, toggle } = useProjectModules(currentId);
  const [showModuleSettings, setShowModuleSettings] = useState(false);

  const reload = async () => {
    const data = await getAllProjects();
    setAllProjects(data);
  };

  useEffect(() => {
    reload();
  }, []);

  useEffect(() => {
    setCurrentId(project.id); // reabrir o modal com outro evento reseta a navegação
    setEditing(false);
  }, [project.id]);

  useEffect(() => {
    setShowModuleSettings(false);
    setEditing(false);
  }, [currentId]);

  const current = allProjects.find((p) => p.id === currentId) ?? project;
  const breadcrumb = allProjects.length > 0 ? buildProjectBreadcrumbPath(allProjects, currentId) : [current];

  const tree = buildProjectTree(allProjects);
  const subtreeOptions = flattenSubtree(tree, project.id); // sempre relativo ao projeto RAIZ do modal, não ao nível atual

  function jumpTo(targetId: string) {
    setCurrentId(targetId);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {subtreeOptions.length > 1 && (
          <select
            value={currentId}
            onChange={(e) => jumpTo(e.target.value)}
            style={{ padding: 6, fontSize: 12, alignSelf: 'flex-start' }}
          >
            {subtreeOptions.map(({ node, depth }) => (
              <option key={node.id} value={node.id}>
                {'—'.repeat(depth)} {depth > 0 ? ' ' : ''}{node.name}
              </option>
            ))}
          </select>
        )}

        {breadcrumb.length > 1 && (
          <nav style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4, fontSize: 12, color: '#666' }}>
            {breadcrumb.map((p, i) => {
              const isLast = i === breadcrumb.length - 1;
              return (
                <span key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
                  {i > 0 && <span style={{ color: '#ccc' }}>/</span>}
                  {isLast ? (
                    <span title={p.name} style={{ fontWeight: 600, color: '#000', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.name}
                    </span>
                  ) : (
                    <button
                      onClick={() => jumpTo(p.id)}
                      title={p.name}
                      style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#1a73e8', padding: 0, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                      {p.name}
                    </button>
                  )}
                </span>
              );
            })}
          </nav>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>{current.name}</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setEditing((v) => !v)}
            title="Editar projeto"
            style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #ccc', borderRadius: 4, background: editing ? '#f0f0f0' : '#fff', cursor: 'pointer' }}
          >
            ✎
          </button>
          <button
            onClick={() => setShowModuleSettings((v) => !v)}
            title="Configurar módulos"
            style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #ccc', borderRadius: 4, background: showModuleSettings ? '#f0f0f0' : '#fff', cursor: 'pointer' }}
          >
            ⚙
          </button>
          <Button variant="secondary" onClick={() => onGoToProject(current.id)}>Ir para o projeto</Button>
        </div>
      </div>

      {editing && (
        <ProjectInlineEditForm
          project={current}
          onSaved={reload}
          onDeleted={() => {
            const parentBreadcrumb = breadcrumb.length > 1 ? breadcrumb[breadcrumb.length - 2] : null;
            setEditing(false);
            if (parentBreadcrumb) setCurrentId(parentBreadcrumb.id);
            reload(); // depois de já ter trocado o currentId, evita renderizar current apontando pro projeto recém-excluído
          }}
          onCancel={() => setEditing(false)}
        />
      )}

      {loading && <p style={{ color: '#666', fontSize: 14 }}>Carregando módulos...</p>}

      {!loading && showModuleSettings && modules && (
        <div style={{ border: '1px solid #e0e0e0', borderRadius: 6, padding: 12, backgroundColor: '#fafafa' }}>
          <ModuleToggles modules={modules} onToggle={toggle} />
        </div>
      )}

      {!loading && !editing && modules && (
        <div style={{ maxHeight: '60vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <ProjectModuleTabs projectId={current.id} projectName={current.name} modules={modules} />
          <SubprojectsSection
            projectId={current.id}
            projectName={current.name}
            onOpenSubproject={(sub) => { jumpTo(sub.id); reload(); }}
            onEditSubproject={(sub) => { jumpTo(sub.id); setEditing(true); reload(); }}
          />
        </div>
      )}
    </div>
  );
}
