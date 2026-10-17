// build.js
// Uso: node build.js
//
// O runtime de Modificações só carrega UM arquivo (entry.tsx) e não tem
// import/require. Este script concatena os arquivos-fonte de src/, na
// ordem de dependência abaixo, e gera o entry.tsx final — que é o único
// arquivo que você copia para:
//   projects/academia/modifications/workout-log/entry.tsx
//
// Edite sempre nos arquivos de src/. Depois de editar, rode `node build.js`
// de novo para regenerar o entry.tsx.
//
// Escrito como ES module (import/export) porque o package.json do projeto
// Manager usa "type": "module" — com require() ele dá
// "ReferenceError: require is not defined in ES module scope".

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ORDER = [
  'src/tipos/workout.types.ts',
  'src/servicos/format.service.ts',
  'src/servicos/stats.service.ts',
  'src/servicos/week.service.ts',
  'src/servicos/data.service.ts',
  'src/servicos/image.service.ts',
  'src/stores/workout.store.ts',
  'src/hooks/useWorkoutStore.ts',
  'src/componentes/theme.ts',
  'src/componentes/Tabs.tsx',
  'src/componentes/StatCard.tsx',
  'src/componentes/SearchInput.tsx',
  'src/componentes/ExercisePhotoField.tsx',
  'src/componentes/ExerciseListItem.tsx',
  'src/componentes/PlanCard.tsx',
  'src/paginas/DashboardPage.tsx',
  'src/paginas/ExercisesPage.tsx',
  'src/paginas/ExerciseDetailPage.tsx',
  'src/paginas/PlansPage.tsx',
  'src/paginas/WeekPage.tsx',
  'src/paginas/HistoryPage.tsx',
  'src/app.entry.tsx', // por último: contém o export default
];

const header = [
  '// ============================================================',
  '// ARQUIVO GERADO AUTOMATICAMENTE por build.js — NÃO EDITE AQUI.',
  '// Edite os arquivos em src/ e rode `node build.js` de novo.',
  '// ============================================================',
  '',
].join('\n');

let out = header;
for (const rel of ORDER) {
  const full = path.join(__dirname, rel);
  const content = fs.readFileSync(full, 'utf8');
  out += '\n// ---- ' + rel + ' ----\n' + content.trimEnd() + '\n';
}

fs.writeFileSync(path.join(__dirname, 'entry.tsx'), out, 'utf8');
console.log('entry.tsx gerado (' + out.split('\n').length + ' linhas).');
