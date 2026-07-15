export type FieldType =
  | 'text' | 'textarea' | 'number' | 'currency' | 'duration' | 'weight'
  | 'distance' | 'percentage' | 'checkbox' | 'select' | 'multiselect'
  | 'date' | 'datetime' | 'time';

export interface TemplateFieldOption {
  value: string;
  label: string;
}

export type FieldValue = string | number | boolean | string[] | null;

export interface TemplateField {
  id: string;
  templateId: string;
  key: string;          // usado como chave em Log.values, ex: 'exercise'
  label: string;
  type: FieldType;
  required: boolean;
  defaultValue: FieldValue;
  options: TemplateFieldOption[]; // só select/multiselect
  placeholder: string | null;
  readOnly: boolean;    // preparado, sem uso ainda
  order: number;
}

export interface Template {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  fields: TemplateField[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateTemplateInput {
  projectId: string;
  name: string;
  description?: string;
}

export type UpdateTemplateInput = Partial<Pick<CreateTemplateInput, 'name' | 'description'>>;

export interface CreateTemplateFieldInput {
  templateId: string;
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  defaultValue?: FieldValue;
  options?: TemplateFieldOption[];
  placeholder?: string;
}

export type UpdateTemplateFieldInput = Partial<Omit<CreateTemplateFieldInput, 'templateId'>>;

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: 'Texto curto',
  textarea: 'Texto longo',
  number: 'Número',
  currency: 'Moeda',
  duration: 'Duração',
  weight: 'Peso',
  distance: 'Distância',
  percentage: 'Porcentagem',
  checkbox: 'Sim/Não',
  select: 'Seleção única',
  multiselect: 'Seleção múltipla',
  date: 'Data',
  datetime: 'Data e hora',
  time: 'Hora',
};

export const OPTION_BASED_FIELD_TYPES: FieldType[] = ['select', 'multiselect'];
