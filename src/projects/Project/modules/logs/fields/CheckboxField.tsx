import type { FieldComponentProps } from './fieldTypeRegistry';

export default function CheckboxField({ value, onChange }: FieldComponentProps) {
  return (
    <input
      type="checkbox"
      checked={!!value}
      onChange={(e) => onChange(e.target.checked)}
    />
  );
}
