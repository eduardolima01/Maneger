import { commandRegistry } from './registry';
import { noteCommand } from './note.command';

// Registrar novos comandos aqui, um import + uma chamada cada — nada mais precisa mudar.
commandRegistry.register(noteCommand);
