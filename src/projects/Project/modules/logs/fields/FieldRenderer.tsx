import type { TemplateField, FieldValue } from '@/types/template.types';
import { FIELD_TYPE_COMPONENTS } from './fieldTypeRegistry';

interface FieldRendererProps {
  field: TemplateField;
  value: FieldValue;
  onChange: (value: FieldValue) => void;
}

export default function FieldRenderer({ field, value, onChange }: FieldRendererProps) {
  const Component = FIELD_TYPE_COMPONENTS[field.type];
  return <Component field={field} value={value} onChange={onChange} />;
}
