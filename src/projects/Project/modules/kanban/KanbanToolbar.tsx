import { useState } from 'react';
import Button from '@/components/layout/Button';
import KanbanFilters from './KanbanFilters';
import type { KanbanFilters as Filters, KanbanDensity } from '@/types/kanban.types';

interface KanbanToolbarProps {
  search: string;
  onSearchChange: (v: string) => void;
  filters: Filters;
  onFiltersChange: (f: Filters) => void;
  filtersActive: boolean;
  availableLabels: string[];
  density: KanbanDensity;
  onDensityChange: (d: KanbanDensity) => void;
  onOpenColumnSettings: () => void;
}

const DENSITY_OPTIONS: { key: KanbanDensity; label: string }[] = [
  { key: 'compact', label: 'Compacta' },
  { key: 'normal', label: 'Normal' },
  { key: 'expanded', label: 'Expandida' },
];

export default function KanbanToolbar({
  search, onSearchChange, filters, onFiltersChange, filtersActive, availableLabels,
  density, onDensityChange, onOpenColumnSettings,
}: KanbanToolbarProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, position: 'relative' }}>
      <input
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Buscar título, descrição ou etiqueta..."
        style={{ flex: 1, padding: 8, fontSize: 14 }}
      />

      <select value={density} onChange={(e) => onDensityChange(e.target.value as KanbanDensity)} style={{ padding: 8, fontSize: 13 }}>
        {DENSITY_OPTIONS.map((d) => (
          <option key={d.key} value={d.key}>{d.label}</option>
        ))}
      </select>

      <div style={{ position: 'relative' }}>
        <Button variant={filtersActive ? 'primary' : 'secondary'} onClick={() => setFiltersOpen((v) => !v)}>
          Filtros {filtersActive ? '●' : ''}
        </Button>
        {filtersOpen && (
          <KanbanFilters filters={filters} onChange={onFiltersChange} availableLabels={availableLabels} />
        )}
      </div>

      <Button variant="secondary" onClick={onOpenColumnSettings}>⚙ Colunas</Button>
    </div>
  );
}
