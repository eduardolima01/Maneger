import type { FieldComponentProps } from './fieldTypeRegistry';

export default function SelectField({ field, value, onChange }: FieldComponentProps) {
  return (
    <select
      value={(value as string) ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
      required={field.required}
      style={{ width: '100%', padding: 6, fontSize: 13 }}
    >
      <option value="">Selecione...</option>
      {field.options.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
}
