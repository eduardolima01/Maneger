import { convertFileSrc } from '@tauri-apps/api/core';

interface AvatarChipProps {
  name: string;
  color?: string | null;
  coverPath?: string | null;
  onClick: () => void;
}

export default function AvatarChip({ name, color, coverPath, onClick }: AvatarChipProps) {
  const initial = name.trim().charAt(0).toUpperCase() || '?';

  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      title={name}
      style={{
        width: 20, height: 20, borderRadius: '50%', border: '1px solid #fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: color ?? '#999', color: '#fff', fontSize: 10, fontWeight: 700,
        cursor: 'pointer', overflow: 'hidden', flexShrink: 0, padding: 0, marginLeft: -6,
      }}
    >
      {coverPath ? (
        <img src={convertFileSrc(coverPath)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        initial
      )}
    </button>
  );
}
