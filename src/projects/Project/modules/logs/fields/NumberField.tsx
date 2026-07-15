import type { FieldComponentProps } from './fieldTypeRegistry';

export default function NumberField({ value, onChange, field }: FieldComponentProps) {
  return (
    <input
      type="number"
      value={value === null || value === undefined ? '' : (value as number)}
      onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
      required={field.required}
      style={{ width: '100%', padding: 6, fontSize: 13 }}
    />
  );
}
