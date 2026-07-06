import CreateProjects from './components/CreateProjects';
import { useProjects } from '../lib/hooks/useProjects';
import CardProject from './components/CardProject';

export const Projects = () => {
  const { projects, loading, error, add } = useProjects();

  if (loading) return <p>Carregando...</p>;
  if (error) return <p>Erro: {error}</p>;

  return (
    <div>
      <h1>Projetos</h1>
      <CreateProjects onCreate={add} />
      <ul>
        {projects.map((p) => (
          <li key={p.id}>
            <CardProject
              project={p}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
