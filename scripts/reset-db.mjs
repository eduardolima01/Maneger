import { existsSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbDir = join(__dirname, '..', 'src-tauri');

// apaga o banco principal + arquivos auxiliares do SQLite (WAL/journal),
// que às vezes ficam presos e impedem o schema novo de "pegar"
const filesToRemove = ['app.db', 'app.db-journal', 'app.db-wal', 'app.db-shm'];

let removed = 0;
for (const file of filesToRemove) {
  const filePath = join(dbDir, file);
  if (existsSync(filePath)) {
    unlinkSync(filePath);
    console.log(`✔ removido: src-tauri/${file}`);
    removed++;
  }
}

if (removed === 0) {
  console.log('Nenhum arquivo de banco encontrado (já estava limpo).');
} else {
  console.log(`\n${removed} arquivo(s) removido(s). Rode "bun tauri dev" para recriar o banco com o schema atual.`);
}
