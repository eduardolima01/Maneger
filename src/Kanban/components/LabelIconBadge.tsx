import { convertFileSrc } from '@tauri-apps/api/core';
import type { LabelIcon } from '@/types/kanban.types';

interface LabelIconBadgeProps {
  icon: LabelIcon | null | undefined;
  size?: number;
}

/** Emoji ou miniatura do ícone de uma etiqueta. Não renderiza nada se a etiqueta não tem ícone. */
export default function LabelIconBadge({ icon, size = 12 }: LabelIconBadgeProps) {
  if (!icon) return null;
  if (icon.kind === 'emoji') {
    return <span style={{ fontSize: size, lineHeight: 1, flexShrink: 0 }}>{icon.value}</span>;
  }
  return (
    <img
      src={convertFileSrc(icon.path)}
      alt=""
      style={{ width: size, height: size, objectFit: 'cover', borderRadius: 2, flexShrink: 0 }}
    />
  );
}
