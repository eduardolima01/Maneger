# Workout Log — estrutura de desenvolvimento

## Por que existe um build.js

O runtime de Modificações do Manager só lê **um arquivo** (`entry.tsx`) e não
tem `import`/`require`. Então a organização abaixo é só para o
**desenvolvimento**: você edita em arquivos separados (agora em JSX de
verdade), e `node build.js` concatena tudo, na ordem certa, gerando o
`entry.tsx` final — que é o único arquivo que vai para
`projects/academia/modifications/workout-log/entry.tsx`.

## Estrutura

```
src/
  tipos/        -> interfaces TypeScript (apagadas no build)
  servicos/     -> funções puras: formatação, estatísticas/evolução, semana, defaults dos dados
  stores/       -> funções puras de transição de estado (data -> novo data), sem React
  hooks/        -> useWorkoutStore: conecta os stores ao React + persiste via modApi.storage
  componentes/  -> peças de UI em JSX (Tabs, StatCard, PlanCard...)
  paginas/      -> telas em JSX (Dashboard, Exercícios, Fichas, Semana, Histórico)
  app.entry.tsx -> componente raiz em JSX; único arquivo com `export default`
build.js        -> concatena tudo acima em entry.tsx
entry.tsx       -> ARQUIVO GERADO — é o que você copia para o Manager
```

## Fluxo de trabalho

1. Edite o que precisar dentro de `src/`.
2. Rode `node build.js`.
3. Copie o `entry.tsx` gerado para
   `projects/academia/modifications/workout-log/entry.tsx`.

## Mudanças desta versão

- **Removido o sistema de sessão** (aba "Sessão", cronômetro ao vivo,
  registro de séries em tempo real). Fichas e a divisão semanal agora
  são só planejamento; o Histórico continua mostrando o que já existir
  em `data.sessions`, mas não há mais nenhuma tela para criar uma sessão
  nova — isso precisa de um mecanismo novo (a definir) se você quiser
  voltar a registrar treinos.
- **Todo o código de UI foi convertido para JSX** (antes usava
  `React.createElement` diretamente). O `sucrase` já transpila JSX
  automaticamente; `React` continua chegando via props em cada
  componente/página porque o runtime não tem `import`.

## Persistência

Os dados ficam em `data.json` dentro da própria pasta da Modificação
(`projects/academia/modifications/workout-log/data.json`), gerenciado por
`modApi.storage.get()/set()`.
