import type { FieldComponentProps } from './fieldTypeRegistry';

export default function WeightField({ value, onChange, field }: FieldComponentProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <input
        type="number"
        step="0.1"
        value={value === null || value === undefined ? '' : (value as number)}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        required={field.required}
        style={{ flex: 1, padding: 6, fontSize: 13 }}
      />
      <span style={{ fontSize: 13, color: '#666' }}>kg</span>
    </div>
  );
}
