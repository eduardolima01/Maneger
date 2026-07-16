import { useState } from 'react';
import CreateProjects from './components/CreateProjects';
import ProjectTree from './ProjectTree';
import { getArchivedProjects, setProjectArchived } from '../lib/api/projects';
import type { ProjectType } from '../types/project.types';
import { useProjectTree } from '@/lib/hooks/project/useProjectTree';

export const Projects = () => {
  const treeApi = useProjectTree();

  const [showArchived, setShowArchived] = useState(false);
  const [archivedProjects, setArchivedProjects] = useState<ProjectType[]>([]);
  const [loadingArchived, setLoadingArchived] = useState(false);

  async function handleCreateRoot(name: string) {
    await treeApi.createProject({ name });
  }

  async function toggleShowArchived() {
    if (!showArchived) {
      setLoadingArchived(true);
      const data = await getArchivedProjects();
      setArchivedProjects(data);
      setLoadingArchived(false);
    }
    setShowArchived((v) => !v);
  }

  async function handleUnarchive(id: string) {
    await setProjectArchived(id, false);
    setArchivedProjects((prev) => prev.filter((p) => p.id !== id));
    await treeApi.reload(); // agora é um reload de verdade, sem remount — expandedIds sobrevive
  }

  return (
    <div>
      <h1>Projetos</h1>
      <CreateProjects onCreate={handleCreateRoot} />

      {treeApi.loading ? <p>Carregando...</p> : <ProjectTree api={treeApi} />}

      <div style={{ marginTop: 24, borderTop: '1px solid #eee', paddingTop: 12 }}>
        <button
          onClick={toggleShowArchived}
          style={{ background: 'none', border: 'none', color: '#666', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}
        >
          {showArchived ? 'Ocultar projetos arquivados' : 'Ver projetos arquivados'}
        </button>

        {showArchived && (
          <div style={{ marginTop: 12 }}>
            {loadingArchived && <p style={{ fontSize: 13, color: '#666' }}>Carregando...</p>}
            {!loadingArchived && archivedProjects.length === 0 && (
              <p style={{ fontSize: 13, color: '#999' }}>Nenhum projeto arquivado.</p>
            )}
            <ul>
              {archivedProjects.map((p) => (
                <li key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
                  <span>{p.name}</span>
                  <button
                    onClick={() => handleUnarchive(p.id)}
                    style={{ fontSize: 12, color: '#1a73e8', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    Desarquivar
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};
