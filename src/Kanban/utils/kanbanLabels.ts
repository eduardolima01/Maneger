export interface ParsedLabel { name: string; color: string; isGroup: boolean }

const DEFAULT_LABEL_COLOR = '#4338ca';

export function parseLabel(raw: string): ParsedLabel {
  const parts = raw.split('::');
  const name = parts[0] ?? raw;
  const color = parts[1] || DEFAULT_LABEL_COLOR;
  const isGroup = parts[2] === 'group';
  return { name, color, isGroup };
}

export function serializeLabel(name: string, color: string, isGroup = false): string {
  return isGroup ? `${name}::${color}::group` : `${name}::${color}`;
}

export const LABEL_COLOR_PALETTE = [
  '#e53935', '#fb8c00', '#fdd835', '#43a047',
  '#00acc1', '#1e88e5', '#5e35b1', '#8e24aa',
  '#6d4c41', '#546e7a',
];

import type { KanbanCard } from '@/types/kanban.types';

export interface LabelCluster {
  name: string;
  color: string;
  cards: KanbanCard[];
}

/** Separa os cards soltos de uma coluna em clusters (por etiqueta de grupo) + os que sobraram sem etiqueta de grupo. */
export function clusterCardsByGroupLabel(cards: KanbanCard[]): { clusters: LabelCluster[]; loose: KanbanCard[] } {
  const clusterMap = new Map<string, LabelCluster>();
  const loose: KanbanCard[] = [];

  for (const card of cards) {
    const groupLabels = card.labels
      .map(parseLabel)
      .filter((l) => l.isGroup)
      .sort((a, b) => a.name.localeCompare(b.name));
    const groupLabel = groupLabels[0];

    if (!groupLabel) {
      loose.push(card);
      continue;
    }

    const existing = clusterMap.get(groupLabel.name);
    if (existing) {
      existing.cards.push(card);
    } else {
      clusterMap.set(groupLabel.name, { name: groupLabel.name, color: groupLabel.color, cards: [card] });
    }
  }

  const clusters = Array.from(clusterMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  return { clusters, loose };
}

