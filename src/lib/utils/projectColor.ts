const PALETTE = [
  '#1a73e8', // azul (padrão p/ eventos sem projeto)
  '#e67c73', // vermelho
  '#33b679', // verde
  '#f4511e', // laranja
  '#8e24aa', // roxo
  '#039be5', // ciano
  '#7986cb', // índigo
  '#c0ca33', // lima
  '#f6bf26', // amarelo
];

export function getProjectColor(projectId: string | null): string {
  if (!projectId) return PALETTE[0];

  let hash = 0;
  for (let i = 0; i < projectId.length; i++) {
    hash = (hash * 31 + projectId.charCodeAt(i)) >>> 0;
  }
  return PALETTE[1 + (hash % (PALETTE.length - 1))];
}

