import type { FieldComponentProps } from './fieldTypeRegistry';

export default function TextField({ field, value, onChange }: FieldComponentProps) {
  return (
    <input
      type="text"
      value={(value as string) ?? ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.placeholder ?? undefined}
      required={field.required}
      style={{ width: '100%', padding: 6, fontSize: 13 }}
    />
  );
}
