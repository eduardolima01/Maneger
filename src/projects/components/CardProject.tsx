import { ProjectType } from "@/types/project.types";
import { Link } from "@tanstack/react-router";
import { convertFileSrc } from "@tauri-apps/api/core";

interface CardProjectProps {
  project: ProjectType;
}

export default function CardProject({ project }: CardProjectProps) {
  return (
    <Link
      to="/projects/$projectId"
      params={{ projectId: String(project.id) }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: 16,
          borderRadius: 8,
          border: '1px solid #e5e7eb',
          marginBottom: 8,
          cursor: 'pointer'
        }}
        className="hover:bg-gray-50"
      >
        <div className="flex gap-1 items-center">
          {project.cover_path && (
            <img
              src={convertFileSrc(project.cover_path)}
              className="w-16 h-16 object-cover rounded-full mr-4"
            />
          )}
          <span style={{ fontWeight: 500 }}>{project.name}</span>
        </div>
      </div>
    </Link>
  );
}
