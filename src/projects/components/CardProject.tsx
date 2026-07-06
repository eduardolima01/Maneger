import { ProjectType } from "@/types/project.types";
import { Link } from "@tanstack/react-router";

interface CardProjectProps {
  project: ProjectType;
  onClick?: (project: ProjectType) => void;
}

export default function CardProject({ project, onClick }: CardProjectProps) {
  return (
    <div
      onClick={() => onClick?.(project)}
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderRadius: 8,
        border: '1px solid #e5e7eb',
        marginBottom: 8,
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <span style={{ fontWeight: 500 }}>{project.name}</span>

      <Link
        to="/projects/$projectId"
        params={{ projectId: String(project.id) }}
      >
        selecionar
      </Link>
    </div>
  );
}
