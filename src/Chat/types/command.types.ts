export interface ParsedCommand {
  name: string;
  positional: string[];
  named: Record<string, string>;
  raw: string;
}

export interface CommandResult {
  success: boolean;
  message: string; // texto de confirmação/erro mostrado no chat como resposta do sistema
  metadata?: Record<string, unknown>;
}

export interface Command {
  name: string;
  aliases: string[];
  description: string;
  execute: (parsed: ParsedCommand) => Promise<CommandResult>;
}
