import type { Command } from '../types/command.types';

class CommandRegistry {
  private commands = new Map<string, Command>();

  register(command: Command): void {
    this.commands.set(command.name, command);
    for (const alias of command.aliases) {
      this.commands.set(alias, command);
    }
  }

  resolve(name: string): Command | null {
    return this.commands.get(name) ?? null;
  }

  list(): Command[] {
    return Array.from(new Set(this.commands.values()));
  }
}

export const commandRegistry = new CommandRegistry();
