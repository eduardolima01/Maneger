import type { FieldComponentProps } from './fieldTypeRegistry';

export default function PercentageField({ value, onChange, field }: FieldComponentProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <input
        type="number"
        min={0}
        max={100}
        value={value === null || value === undefined ? '' : (value as number)}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        required={field.required}
        style={{ flex: 1, padding: 6, fontSize: 13 }}
      />
      <span style={{ fontSize: 13, color: '#666' }}>%</span>
    </div>
  );
}
