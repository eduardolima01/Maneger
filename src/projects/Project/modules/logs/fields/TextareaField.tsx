import type { FieldComponentProps } from './fieldTypeRegistry';

export default function TextareaField({ field, value, onChange }: FieldComponentProps) {
  return (
    <textarea
      value={(value as string) ?? ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.placeholder ?? undefined}
      required={field.required}
      rows={3}
      style={{ width: '100%', padding: 6, fontSize: 13, resize: 'vertical' }}
    />
  );
}
