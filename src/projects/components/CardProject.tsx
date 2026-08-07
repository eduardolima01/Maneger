import { ProjectType } from "@/types/project.types";
import { convertFileSrc } from "@tauri-apps/api/core";
import { useNavigate } from "@tanstack/react-router";
import AvatarChip from "@/Projects/Project/components/AvatarChip";

export const CARD_PROJECT_WIDTH = 260;

export interface CardProjectBadge {
  label: string;
}

export interface CardProjectSubAvatar {
  id: string;
  name: string;
  color?: string | null;
  coverPath?: string | null;
}

interface CardProjectProps {
  project: ProjectType;
  onClick?: () => void;
  subtitle?: string;
  badges?: CardProjectBadge[];
  footerText?: string;
  subAvatars?: CardProjectSubAvatar[];
}

export default function CardProject({ project, onClick, subtitle, badges, footerText, subAvatars }: CardProjectProps) {
  const navigate = useNavigate();
  const headerColor = project.color || '#1a73e8';

  function handleClick() {
    if (onClick) {
      onClick();
    } else {
      navigate({ to: '/projects/$projectId', params: { projectId: String(project.id) } });
    }
  }

  return (
    <div
      onClick={handleClick}
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        overflow: 'hidden',
        cursor: 'pointer',
        backgroundColor: '#fff',
        width: CARD_PROJECT_WIDTH,
      }}
      className="hover:shadow-sm"
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 12px',
          backgroundColor: headerColor,
          color: '#fff',
        }}
      >
        {project.cover_path ? (
          <img
            src={convertFileSrc(project.cover_path)}
            style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
          />
        ) : (
          <span style={{ width: 24, height: 24, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0 }}>
            📁
          </span>
        )}
        <span style={{ fontWeight: 700, fontSize: 14, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {project.name}
        </span>
      </div>

      <div style={{ padding: '10px 12px' }}>
        {subtitle && (
          <div style={{ fontSize: 13, color: '#333', marginBottom: badges || footerText || subAvatars ? 8 : 0 }}>{subtitle}</div>
        )}

        {badges && badges.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: footerText || subAvatars ? 6 : 0 }}>
            {badges.map((b, i) => (
              <span
                key={i}
                style={{
                  backgroundColor: '#f1f3f4', color: '#444', fontSize: 11,
                  borderRadius: 10, padding: '2px 8px', fontWeight: 500,
                }}
              >
                {b.label}
              </span>
            ))}
          </div>
        )}

        {subAvatars && subAvatars.length > 0 && (
          <div style={{ display: 'flex', marginLeft: 6, marginBottom: footerText ? 6 : 0 }}>
            {subAvatars.slice(0, 8).map((sa) => (
              <AvatarChip
                key={sa.id}
                name={sa.name}
                color={sa.color}
                coverPath={sa.coverPath}
                onClick={() => navigate({ to: '/projects/$projectId', params: { projectId: sa.id } })}
              />
            ))}
          </div>
        )}

        {footerText && (
          <div style={{ fontSize: 11, color: '#999' }}>{footerText}</div>
        )}
      </div>
    </div>
  );
}
