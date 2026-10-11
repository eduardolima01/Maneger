import type { Deck, Flashcard } from '../types/study.types';

/**
 * Formato de arquivo de flashcards (import/export).
 *
 * Objetivo: ser fácil de gerar por uma IA a partir de um tutorial, e fácil de
 * editar à mão num editor de texto qualquer. Usa marcadores `%%` porque esse
 * padrão dificilmente aparece dentro do conteúdo de um flashcard normal — ao
 * contrário de `#`/`---`, que são markdown válido e poderiam se confundir com
 * o conteúdo de FRENTE/VERSO (que suportam markdown).
 *
 * %%CARD [id=xxx]      → início de um card. "id=" é opcional:
 *                         - ausente  → sempre CRIA um card novo ao importar
 *                         - presente → ATUALIZA o card existente com esse id
 *                           (se não existir mais, cria um novo — nunca falha)
 * %%FRENTE              → tudo abaixo até %%VERSO é a pergunta (markdown)
 * %%VERSO               → tudo abaixo até o próximo %%CARD (ou fim) é a resposta
 *
 * Linhas fora de qualquer bloco %%CARD (ex: comentários começando com "%%" no
 * cabeçalho do arquivo) são ignoradas pelo parser.
 */

export interface ParsedCard {
  id?: string;
  front: string;
  back: string;
}

const CARD_MARKER = /^%%CARD(?:\s+id=(\S+))?\s*$/i;
const FRENTE_MARKER = /^%%FRENTE\s*$/i;
const VERSO_MARKER = /^%%VERSO\s*$/i;

/** Converte o texto colado/importado em uma lista de cards (front/back e id opcional). */
export function parseCardsFile(text: string): ParsedCard[] {
  const lines = text.split(/\r?\n/);
  const cards: ParsedCard[] = [];

  let current: { id?: string; front: string[]; back: string[] } | null = null;
  let section: 'none' | 'front' | 'back' = 'none';

  const flush = () => {
    if (!current) return;
    const front = current.front.join('\n').trim();
    const back = current.back.join('\n').trim();
    if (front && back) cards.push({ id: current.id, front, back });
  };

  for (const line of lines) {
    const cardMatch = line.match(CARD_MARKER);
    if (cardMatch) {
      flush();
      current = { id: cardMatch[1], front: [], back: [] };
      section = 'none';
      continue;
    }
    if (FRENTE_MARKER.test(line)) { section = 'front'; continue; }
    if (VERSO_MARKER.test(line)) { section = 'back'; continue; }
    if (!current) continue;
    if (section === 'front') current.front.push(line);
    else if (section === 'back') current.back.push(line);
  }
  flush();

  return cards;
}

/** Gera o texto do arquivo pra importação por IA: só o formato + um exemplo, sem cards reais. */
export function buildImportTemplate(deckName?: string): string {
  return [
    '%% TEMPLATE DE IMPORTAÇÃO DE FLASHCARDS',
    deckName ? `%% Deck de destino: ${deckName}` : '%% Preencha os cards abaixo com base no material fornecido.',
    '%% Não escreva "id=" nos cards novos — isso é só usado no arquivo de exportação/edição.',
    '%% Markdown é permitido na FRENTE e no VERSO.',
    '',
    '%%CARD',
    '%%FRENTE',
    'Pergunta gerada a partir do tutorial aqui.',
    '%%VERSO',
    'Resposta correspondente aqui.',
    '',
    '%%CARD',
    '%%FRENTE',
    'Outra pergunta.',
    '%%VERSO',
    'Outra resposta.',
    '',
  ].join('\n');
}

/** Gera o texto exportado de um deck, pronto pra editar e reimportar (mesmo id = atualiza). */
export function serializeCardsFile(deck: Deck, cards: Flashcard[]): string {
  const header = [
    `%% Cards do deck "${deck.name}" — exportado em ${new Date().toLocaleString('pt-BR')}`,
    '%% Edite a FRENTE/VERSO à vontade. Não mexa nas linhas que começam com "%%".',
    '%% Cards com "id=" são ATUALIZADOS ao reimportar (não duplicam).',
    '%% Pra adicionar um card novo, copie um bloco %%CARD inteiro e apague o "id=...".',
    '%% Apagar um bloco aqui NÃO exclui o card no app — use a exclusão pela tela normal.',
    '',
  ].join('\n');

  const blocks = cards.map((c) => [`%%CARD id=${c.id}`, '%%FRENTE', c.front, '%%VERSO', c.back].join('\n'));

  return `${header}\n${blocks.join('\n\n')}\n`;
}

/** Dispara o download de um arquivo de texto no navegador (sem lib nova). */
export function downloadTextFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
