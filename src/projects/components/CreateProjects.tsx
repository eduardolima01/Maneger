import Button from '@/components/layout/Button';
import Modal from '@/components/ui/Modal';
import { useState } from 'react';

interface CreateProjectsProps {
  onCreate: (name: string) => Promise<void>;
}

export default function CreateProjects({ onCreate }: CreateProjectsProps) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [viewNewProject, setViewNewProject] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      setLoading(true);
      setError(null);
      await onCreate(name.trim());
      setName('');
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Button
        onClick={_ => setViewNewProject(!viewNewProject)}
        variant={viewNewProject ? "danger" : "primary"}
      >
        {viewNewProject
          ? "Cancelar"
          : 'Criar projeto'
        }
      </Button>

      <Modal
        open={viewNewProject}
        onClose={() => setViewNewProject(false)}
        title="Criar projeto"
      >
        <form
          onSubmit={handleSubmit}
          style={{ display: 'flex', gap: 8, marginBottom: 16 }}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome do projeto..."
            disabled={loading}
            style={{ flex: 1, padding: 8 }}
          />
          <Button
            type="submit" disabled={loading}
          >
            {loading ? 'Criando...' : 'Criar projeto'}
          </Button>
          {error && <p style={{ color: 'red' }}>{error}</p>}
        </form>

      </Modal>
    </div>

  );
}
