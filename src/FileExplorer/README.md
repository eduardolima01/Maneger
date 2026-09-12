# Explorador de Arquivos — README do módulo

## Arquitetura (conforme pedido)

```
FileExplorer UI              → FileExplorerPage.tsx + components/
      ↓
Explorer Store                → hooks/useFileExplorerStore.ts
      ↓
File System Service            → api/fileSystemService.ts (+ api/explorerPrefs.ts p/ path padrão)
      ↓
Tauri                          → comandos custom em file_explorer_commands.rs (invoke())
      ↓
Sistema de arquivos             → std::fs + crate `trash`, escopado à Home
```

Nenhuma camada pula a outra: componentes de UI só chamam o Store (nunca
`invoke()` direto), o Store só chama o Service, o Service é o único lugar
que conhece `invoke()`/nomes de comando.

## Por que comandos custom em vez de `@tauri-apps/plugin-fs`

O projeto já tem um padrão 100% estabelecido de operações de arquivo via
`#[tauri::command]` + `std::fs` (covers, canvas-assets, feed-assets,
modifications) — nunca usa `plugin-fs`. Manter esse padrão evita:
- Uma segunda forma de fazer a mesma coisa no código (arquitetura paralela).
- Configurar `capabilities` com escopo de fs (comandos custom não passam
  pelo sistema de capabilities de plugin — ver PATCHES.md).

## Escopo de segurança

Toda operação passa por `ensure_within_home()` no Rust antes de tocar no
disco — único ponto de checagem, testado (bloqueia `/etc`, aceita subpastas
da Home). Decisão explícita sua nesta conversa: Home do usuário + subpastas,
não o computador inteiro. Se decidir expandir depois, é essa função (e só
ela) que muda.

## Exclusão = lixeira, não permanente

Diferente do resto do app (covers/modifications apagam direto com
`fs::remove`), aqui usa a crate `trash` — decisão explícita sua, porque são
arquivos reais do usuário, não dados internos do Manager.

## O que NÃO entrou nesta primeira versão (de propósito)

- **Miniaturas de imagem**: ícones são só por extensão (emoji). Mostrar
  preview real da imagem exigiria abrir `assetProtocol.scope` pra dentro da
  Home inteira, o que é uma superfície de exposição bem maior — melhor
  decidir isso separado, não de carona nesta entrega.
- **Tamanho de pastas**: aparece como "—" nas duas visualizações. Calcular
  o tamanho real exigiria varrer a pasta inteira recursivamente toda vez que
  a lista é exibida — caro pra pastas grandes. Se quiser isso depois, dá pra
  calcular sob demanda (só quando pedido) em vez de em toda listagem.
- **Seleção múltipla** (shift/ctrl+clique, arrastar retângulo de seleção):
  todas as ações (renomear/copiar/recortar/excluir) operam em um item por
  vez. O menu de contexto e o clipboard (`ClipboardState`) já são desenhados
  pra um item só; estender pra múltiplos é uma mudança de tipo
  (`sourcePath: string` → `sourcePaths: string[]`) espalhada pelo Store e
  pelos comandos Rust (`copy_path`/`move_path` teriam que aceitar lista).
- **Abas e múltiplas localizações**: o hook `useFileExplorerStore` hoje é
  uma instância única = uma "localização". Preparar pra abas no futuro
  significa levantar esse hook pra fora do componente (uma instância por
  aba) e trocar `FileExplorerPage` pra renderizar várias — a lógica interna
  do Store não muda.
- **Favoritos personalizados**: `ExplorerSidebar` só mostra os 4 atalhos
  fixos vindos do backend (Início/Documentos/Downloads/Área de trabalho).
  Comentário no componente já marca onde entraria uma segunda lista
  editável (persistida em prefs, mesmo padrão de `explorer-prefs.json`).
- **Drag and drop de arquivo entre pastas**: copiar/mover é via menu de
  contexto (Copiar/Recortar/Colar), não arrastar. Mais simples de implementar
  corretamente numa visualização de pasta única (sem duas colunas lado a
  lado pra soltar), e "não implementar funcionalidades avançadas
  desnecessárias" cobre isso.

## Testado de verdade, não só "parece certo"

- Lógica Rust (escopo de Home, criar/renomear/listar, copiar/mover com
  detecção de conflito) rodou com `cargo test` num crate isolado — 3/3
  passando.
- Lógica de breadcrumb/pasta-pai rodou com Node real pros dois formatos de
  path (`C:\Users\...` e `/home/...`) — confere no README/histórico da
  conversa, não é suposição.

## Pendência de verificação (ambiente real, não simulável aqui)

- Versão da crate `trash` (`5` vs `4`) depende do toolchain Rust real do
  projeto — ver nota em PATCHES.md.
- Nunca rodou de fato dentro do Tauri/webview real (só a lógica de backend
  isolada + lógica de path em Node). Comportamento de `invoke()`,
  `plugin-opener`'s `open()`, e o dialog de escolher pasta precisam de teste
  manual no app rodando.
