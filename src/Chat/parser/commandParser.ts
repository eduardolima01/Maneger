
import type { ParsedCommand } from '../types/command.types';

const TOKEN_REGEX = /(?:([a-zA-Z_][\w-]*)=)?(?:"([^"]*)"|(\S+))/g;

export function isCommand(input: string): boolean {
  return input.trim().startsWith('!');
}

export function parseCommand(input: string): ParsedCommand | null {
  const trimmed = input.trim();
  if (!trimmed.startsWith('!')) return null;

  const withoutBang = trimmed.slice(1);
  const firstSpace = withoutBang.search(/\s/);
  const name = (firstSpace === -1 ? withoutBang : withoutBang.slice(0, firstSpace)).toLowerCase();
  const rest = firstSpace === -1 ? '' : withoutBang.slice(firstSpace + 1);

  const positional: string[] = [];
  const named: Record<string, string> = {};

  let match: RegExpExecArray | null;
  TOKEN_REGEX.lastIndex = 0;
  while ((match = TOKEN_REGEX.exec(rest)) !== null) {
    const [, namedKey, quotedValue, plainValue] = match;
    const value = quotedValue ?? plainValue ?? '';
    if (namedKey) {
      named[namedKey] = value;
    } else if (value) {
      positional.push(value);
    }
  }

  return { name, positional, named, raw: trimmed };
}
