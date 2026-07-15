import { getFieldPlaceholder } from '@/lib/utils/fieldPreview';
import type { TemplateField } from '@/types/template.types';

interface TemplatePreviewTableProps {
  fields: TemplateField[];
}

export default function TemplatePreviewTable({ fields }: TemplatePreviewTableProps) {
  if (fields.length === 0) {
    return <p style={{ fontSize: 12, color: '#999', margin: 0 }}>Adicione campos para ver como a tabela vai ficar.</p>;
  }

  return (
    <div style={{ overflowX: 'auto', border: '1px solid #eee', borderRadius: 4 }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
        <thead>
          <tr style={{ backgroundColor: '#fafafa' }}>
            {fields.map((f) => (
              <th key={f.id} style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #eee', whiteSpace: 'nowrap' }}>
                {f.label}{f.required && <span style={{ color: '#c62828' }}> *</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {fields.map((f) => (
              <td key={f.id} style={{ padding: '6px 8px', color: '#999', fontStyle: 'italic', whiteSpace: 'nowrap' }}>
                {getFieldPlaceholder(f)}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
