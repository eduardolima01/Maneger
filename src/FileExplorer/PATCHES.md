# Patches — Explorador de Arquivos

## Por que `capabilities/default.json` e `tauri.conf.json` NÃO mudam

Comandos custom (`#[tauri::command]`, chamados via `invoke()`) não passam pelo
sistema de *capabilities* do Tauri 2 — isso só governa comandos de **plugins**
(sql, dialog, opener). Todo o app já segue esse padrão: `save_project_cover`,
`load_agenda_data`, etc. nunca precisaram de entrada em `default.json`. O
Explorador segue exatamente o mesmo caminho (comandos próprios), então zero
mudança de capability é necessária.

`assetProtocol.scope` também não muda: o Explorador desta primeira versão não
carrega miniaturas de imagem via `asset://` (ver pendência no README do
módulo) — só ícones por extensão. Se isso for adicionado depois, aí sim
precisará entrar em `assetProtocol.scope`, escopado à Home.

`opener:default` (já concedido) cobre o `open()` usado pra abrir arquivo com
o app padrão do SO.

---

## 1. `src-tauri/Cargo.toml`

Duas dependências novas, ambas justificadas (não são conveniência, são
necessárias pra funcionalidades pedidas):

- `chrono`: formatar data de modificação de forma confiável (evita
  reimplementar cálculo de calendário à mão em `std` puro — risco real de bug
  sutil em algo que afeta ordenação por data).
- `trash`: exclusão via lixeira/reciclagem do SO, decisão explícita sua nesta
  conversa (em vez de `fs::remove` direto, que é o padrão do resto do app).

```toml
[dependencies]
tauri = { version = "2", features = ["protocol-asset"] }
tauri-plugin-opener = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tauri-plugin-sql = { version = "2.4.0", features = ["sqlite"] }
tauri-plugin-dialog = "2.7.1"
uuid = { version = "1", features = ["v4"] }
chrono = "0.4"
trash = "5"
```

**Nota sobre a versão do `trash`:** testei a lógica do módulo com sucesso
usando um toolchain Rust 1.75 (sandbox), mas a crate `trash` v5 exige Rust
1.85+. Praticamente certo que seu toolchain real já é mais novo que isso (Tauri
2 já exige 1.77+ como mínimo, e já estamos em 2026), mas se o `cargo build`
reclamar de versão do compilador, use `trash = "4"` em vez de `"5"` — a API
usada aqui (`trash::delete`) é idêntica nas duas majors.

---

## 2. `src-tauri/src/lib.rs`

### 2.1 — Novo módulo (junto dos outros `mod`/`use` do topo do arquivo)

```rust
mod canvas_commands;
mod feed_commands;
mod file_explorer_commands; // novo
mod schema;
mod timer_commands;

use canvas_commands::*;
use feed_commands::*;
use file_explorer_commands::*; // novo
use timer_commands::*;
```

Copiar o arquivo `file_explorer_commands.rs` (deste pacote) para
`src-tauri/src/file_explorer_commands.rs`.

### 2.2 — Prefs do Explorador (path padrão)

Adicionar junto dos outros `load_*_prefs`/`save_*_prefs` de topo (ex: logo
após `save_tabs_state`):

```rust
#[tauri::command]
fn load_explorer_prefs() -> Result<String, String> {
    let dir = std::env::current_dir().map_err(|e| e.to_string())?;
    let path = dir.join("explorer-prefs.json");
    if !path.exists() {
        return Ok("{}".to_string());
    }
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_explorer_prefs(data: String) -> Result<(), String> {
    let dir = std::env::current_dir().map_err(|e| e.to_string())?;
    let path = dir.join("explorer-prefs.json");
    fs::write(&path, data).map_err(|e| e.to_string())
}
```

Mesmo padrão de `tabs-state.json`/`page-visibility.json`: arquivo global,
sem escopo por projeto (path padrão é uma preferência única do app).

### 2.3 — Registrar no `invoke_handler!`

```rust
            load_aside_collapsed_prefs,
            save_aside_collapsed_prefs,
            load_explorer_prefs,       // novo
            save_explorer_prefs,       // novo
            list_directory,            // novo
            get_home_path,             // novo
            get_quick_access_locations,// novo
            create_folder,             // novo
            rename_path,               // novo
            delete_to_trash,           // novo
            copy_path,                 // novo
            move_path,                 // novo
            //
            load_card_timer_data,
```

---

## 3. `src/router/routes.tsx`

### Import

```tsx
import FileExplorerPage from '@/FileExplorer/FileExplorerPage'
```

### Rota (dentro de `buildRouteTree`)

```tsx
  const explorerRoute = createRoute({ getParentRoute: () => rootRoute, path: '/explorer', component: FileExplorerPage })
```

### Incluir no `addChildren([...])`

```tsx
  return rootRoute.addChildren([
    dashboardRoute, projectsRoute, projectRoute, kanbanRoute, kanbanBoardRoute,
    settingsRoute, agendaRoute, logsRoute, chatRoute, canvasRoute, feedRoute,
    explorerRoute,
  ])
```

---

## 4. `src/components/layout/Aside/Aside.tsx`

### Import do ícone

```tsx
import { MdFolderOpen } from 'react-icons/md' // novo, junto dos outros MdX
```

### Item no menu

```tsx
  { label: 'Explorador', icon: MdFolderOpen, to: '/explorer' },
```

---

## 5. `src/Settings/Settings.tsx`

Ver `SettingsExplorerSection.tsx` (deste pacote) — é um bloco pronto pra
colar dentro do JSX existente do `Settings.tsx`, logo abaixo do bloco de
`TOGGLEABLE_PAGES`. Import necessário:

```tsx
import { SettingsExplorerSection } from './SettingsExplorerSection';
```

E no JSX, após o `</div>` que fecha a lista de checkboxes:

```tsx
      <SettingsExplorerSection />
```

---

## Onde colocar os arquivos novos

```
src-tauri/src/file_explorer_commands.rs        (novo)
src/Settings/SettingsExplorerSection.tsx       (novo)
src/FileExplorer/                              (pasta inteira, novo módulo)
```
