import type { ComponentType } from 'react';
import type { FieldType, TemplateField, FieldValue } from '@/types/template.types';
import TextField from './TextField';
import TextareaField from './TextareaField';
import NumberField from './NumberField';
import CurrencyField from './CurrencyField';
import DurationField from './DurationField';
import WeightField from './WeightField';
import DistanceField from './DistanceField';
import PercentageField from './PercentageField';
import CheckboxField from './CheckboxField';
import SelectField from './SelectField';
import MultiselectField from './MultiselectField';
import DateField from './DateField';
import DatetimeField from './DatetimeField';
import TimeField from './TimeField';

export interface FieldComponentProps {
  field: TemplateField;
  value: FieldValue;
  onChange: (value: FieldValue) => void;
}

export const FIELD_TYPE_COMPONENTS: Record<FieldType, ComponentType<FieldComponentProps>> = {
  text: TextField,
  textarea: TextareaField,
  number: NumberField,
  currency: CurrencyField,
  duration: DurationField,
  weight: WeightField,
  distance: DistanceField,
  percentage: PercentageField,
  checkbox: CheckboxField,
  select: SelectField,
  multiselect: MultiselectField,
  date: DateField,
  datetime: DatetimeField,
  time: TimeField,
};
