import { useEffect, useRef } from 'react';
import { SECTION_ORDER, SECTION_LABELS } from './types/projectSection.types';
import type { ProjectSectionConfig, ProjectSectionKey } from './types/projectSection.types';

interface ProjectSectionSettingsPopoverProps {
  config: ProjectSectionConfig;
  onSetDefault: (key: ProjectSectionKey) => void;
  onToggleEnabled: (key: ProjectSectionKey) => void;
  onClose: () => void;
}

export default function ProjectSectionSettingsPopover({ config, onSetDefault, onToggleEnabled, onClose }: ProjectSectionSettingsPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const enabledCount = SECTION_ORDER.filter((k) => config.enabledSections[k]).length;

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute', top: '100%', right: 0, marginTop: 4, backgroundColor: '#fff',
        border: '1px solid #ddd', borderRadius: 6, boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
        zIndex: 20, minWidth: 220, padding: 10,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 600, color: '#999', marginBottom: 6 }}>ABAS DO PROJETO</div>

      {SECTION_ORDER.map((key) => {
        const enabled = config.enabledSections[key];
        const isDefault = config.defaultSection === key;
        const isLastEnabled = enabled && enabledCount === 1;

        return (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0' }}>
            <input
              type="checkbox"
              checked={enabled}
              disabled={isLastEnabled}
              title={isLastEnabled ? 'Pelo menos uma aba precisa ficar habilitada' : undefined}
              onChange={() => onToggleEnabled(key)}
              style={{ cursor: isLastEnabled ? 'not-allowed' : 'pointer' }}
            />
            <span style={{ flex: 1, fontSize: 13, color: enabled ? '#000' : '#aaa' }}>{SECTION_LABELS[key]}</span>
            <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: '#666', cursor: enabled ? 'pointer' : 'default' }}>
              <input
                type="radio"
                name="default-section"
                checked={isDefault}
                disabled={!enabled}
                onChange={() => onSetDefault(key)}
              />
              padrão
            </label>
          </div>
        );
      })}
    </div>
  );
}
