import type { FieldComponentProps } from './fieldTypeRegistry';

export default function DatetimeField({ field, value, onChange }: FieldComponentProps) {
  return (
    <input
      type="datetime-local"
      value={(value as string) ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
      required={field.required}
      style={{ padding: 6, fontSize: 13 }}
    />
  );
}
