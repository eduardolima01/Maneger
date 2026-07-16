import { PALETTE, getProjectColor } from '@/lib/utils/projectColor';

interface ProjectColorPickerProps {
  value: string | null;
  seedId: string; // usado só pro fallback determinístico enquanto o projeto ainda não tem id real (ex: criação)
  onChange: (color: string | null) => void;
}

export default function ProjectColorPicker({ value, seedId, onChange }: ProjectColorPickerProps) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <input
          type="color"
          value={value ?? getProjectColor(seedId)}
          onChange={(e) => onChange(e.target.value)}
          style={{ width: 36, height: 28, padding: 0, border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer' }}
        />
        {value !== null && (
          <button
            onClick={() => onChange(null)}
            style={{ fontSize: 12, color: '#666', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
          >
            usar cor automática
          </button>
        )}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {PALETTE.map((hex) => (
          <button
            key={hex}
            onClick={() => onChange(hex)}
            title={hex}
            style={{
              width: 20, height: 20, borderRadius: '50%', backgroundColor: hex,
              border: value === hex ? '2px solid #000' : '1px solid #ccc', cursor: 'pointer', padding: 0,
            }}
          />
        ))}
      </div>
    </div>
  );
}
