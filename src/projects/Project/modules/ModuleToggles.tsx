import { ALL_MODULES } from '../../../types/module.types';
import type { ModuleStatus } from '../../../lib/api/modules';
import type { ModuleKey } from '../../../types/module.types';

interface ModuleTogglesProps {
  modules: ModuleStatus;
  onToggle: (moduleKey: ModuleKey, enabled: boolean) => void;
}

export default function ModuleToggles({ modules, onToggle }: ModuleTogglesProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: 12,
        border: '1px solid #e0e0e0',
        borderRadius: 6
      }}
    >
      <h4
        style={{ margin: '0 0 4px 0', fontSize: 14, fontWeight: 600 }}
      >
        Módulos deste projeto
      </h4>
      {ALL_MODULES.map(({ key: key, label }) => (
        <label
          key={key}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 14,
            cursor: 'pointer'
          }}>
          <input
            type="checkbox"
            checked={modules[key]}
            onChange={(e) => onToggle(key, e.target.checked)}
          />
          {label}
        </label>
      ))}
    </div>
  );
}
