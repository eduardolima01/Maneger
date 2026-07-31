import type { Command, ParsedCommand, CommandResult } from '../types/command.types';
import { createNoteViaChat } from '../services/notesGateway';
import { findProjectByName, getProjectName } from '../services/projectsGateway';
import { getSetting, setSetting } from '../services/chatSettingsService';

const LAST_PROJECT_KEY = 'lastProjectId';

export const noteCommand: Command = {
  name: 'note',
  aliases: ['n', 'nota'],
  description: 'Cria uma nova nota. Uso: !note "texto" ou !note project="Projeto" title="Título" content="Texto"',

  async execute(parsed: ParsedCommand): Promise<CommandResult> {
    const title = parsed.named.title;
    const content = parsed.named.content ?? (parsed.positional.length > 0 ? parsed.positional.join(' ') : undefined);

    if (!content || !content.trim()) {
      return { success: false, message: 'Uso: !note "texto da nota" ou !note title="Título" content="Texto"' };
    }

    let projectId: string;
    let projectName: string;

    if (parsed.named.project) {
      const found = await findProjectByName(parsed.named.project);
      if (!found) {
        return { success: false, message: `Projeto "${parsed.named.project}" não encontrado.` };
      }
      projectId = found.id;
      projectName = found.name;
    } else {
      const lastId = await getSetting(LAST_PROJECT_KEY);
      if (!lastId) {
        return { success: false, message: 'Nenhum projeto informado ainda. Use: !note project="NomeDoProjeto" "texto da nota"' };
      }
      const name = await getProjectName(lastId);
      if (!name) {
        return { success: false, message: 'O último projeto usado não existe mais. Use: !note project="NomeDoProjeto" "texto da nota"' };
      }
      projectId = lastId;
      projectName = name;
    }

    await createNoteViaChat({ projectId, title, content: content.trim() });
    await setSetting(LAST_PROJECT_KEY, projectId);

    return { success: true, message: `✓ Nota criada com sucesso em "${projectName}".` };
  },
};
