import CreateProjects from './components/CreateProjects';
import { useProjects } from '../lib/hooks/useProjects';

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
          <li key={p.id}>{p.name}</li>
        ))}
      </ul>
    </div>
  );
}
