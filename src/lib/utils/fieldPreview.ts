import type { TemplateField } from '@/types/template.types';

export function getFieldPlaceholder(field: TemplateField): string {
  switch (field.type) {
    case 'text': return 'Texto';
    case 'textarea': return 'Texto longo';
    case 'number': return '0';
    case 'currency': return 'R$ 0,00';
    case 'duration': return '00:00';
    case 'weight': return '0 kg';
    case 'distance': return '0 km';
    case 'percentage': return '0%';
    case 'checkbox': return '☐';
    case 'select': return field.options[0]?.label ?? 'Valor selecionado';
    case 'multiselect': return 'Valores selecionados';
    case 'date': return 'DD/MM/AAAA';
    case 'datetime': return 'DD/MM/AAAA 00:00';
    case 'time': return '00:00';
    default: {
      // switch exaustivo — se um novo FieldType for adicionado sem entrada aqui, TS aponta o erro nesta linha
      const _exhaustive: never = field.type;
      return String(_exhaustive);
    }
  }
}

export function formatFieldValue(field: TemplateField, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';

  switch (field.type) {
    case 'currency':
      return `R$ ${Number(value).toFixed(2).replace('.', ',')}`;
    case 'weight':
      return `${value} kg`;
    case 'distance':
      return `${value} km`;
    case 'percentage':
      return `${value}%`;
    case 'duration': {
      const min = Number(value);
      const h = Math.floor(min / 60);
      const m = min % 60;
      return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m}min`;
    }
    case 'checkbox':
      return value ? '☑' : '☐';
    case 'multiselect':
      return Array.isArray(value) ? value.join(', ') : String(value);
    default:
      return String(value);
  }
}
