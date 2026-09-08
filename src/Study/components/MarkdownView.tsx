import { marked } from 'marked';
import type { CSSProperties } from 'react';

interface MarkdownViewProps {
  value: string;
  style?: CSSProperties;
}

export default function MarkdownView({ value, style }: MarkdownViewProps) {
  const html = marked.parse(value || '', { breaks: true, gfm: true }) as string;
  return (
    <div
      className="markdown-preview"
      style={{ fontSize: 14, lineHeight: 1.5, ...style }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
