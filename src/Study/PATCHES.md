# Patches — módulo de Estudos (Flashcards)

Três arquivos existentes precisam de edições pontuais. Nenhum outro arquivo do
projeto é tocado.

---

## 1. `src-tauri/src/lib.rs`

### 1.1 — Adicionar os dois comandos (junto dos outros `load_*`/`save_*` de topo,
ex: logo depois de `save_tabs_state`)

```rust
#[tauri::command]
fn load_study_data() -> Result<String, String> {
    let dir = std::env::current_dir().map_err(|e| e.to_string())?;
    let path = dir.join("study-data.json");
    if !path.exists() {
        return Ok("{}".to_string());
    }
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_study_data(data: String) -> Result<(), String> {
    let dir = std::env::current_dir().map_err(|e| e.to_string())?;
    let path = dir.join("study-data.json");
    fs::write(&path, data).map_err(|e| e.to_string())
}
```

Segue exatamente o padrão de `load_tabs_state`/`save_tabs_state`: arquivo
global na raiz (`study-data.json`), não por projeto — decks/cards não têm
relação com Projetos no escopo desta feature.

### 1.2 — Registrar no `invoke_handler!`

Adicionar `load_study_data, save_study_data,` na lista (posição sugerida:
logo após `save_aside_collapsed_prefs,`):

```rust
            load_aside_collapsed_prefs,
            save_aside_collapsed_prefs,
            load_study_data,
            save_study_data,
            //
            load_card_timer_data,
```

---

## 2. `src/router/routes.tsx`

### 2.1 — Imports (junto dos outros imports de página)

```tsx
import DecksPage from '@/Study/DecksPage'
import DeckPage from '@/Study/DeckPage'
import StudySessionPage from '@/Study/StudySessionPage'
```

### 2.2 — Dentro de `buildRouteTree`, adicionar as 3 rotas (mesmo padrão flat
usado por `kanbanRoute`/`kanbanBoardRoute`)

```tsx
  const studyRoute = createRoute({ getParentRoute: () => rootRoute, path: '/study', component: DecksPage })
  const studyDeckRoute = createRoute({ getParentRoute: () => rootRoute, path: '/study/$deckId', component: DeckPage })
  const studySessionRoute = createRoute({ getParentRoute: () => rootRoute, path: '/study/$deckId/session', component: StudySessionPage })
```

### 2.3 — Incluir as 3 no `addChildren([...])`

```tsx
  return rootRoute.addChildren([
    dashboardRoute, projectsRoute, projectRoute, kanbanRoute, kanbanBoardRoute,
    settingsRoute, agendaRoute, logsRoute, chatRoute, canvasRoute, feedRoute,
    studyRoute, studyDeckRoute, studySessionRoute,
  ])
```

---

## 3. `src/components/layout/Aside/Aside.tsx`

### 3.1 — Import do ícone

```tsx
import {
  MdDashboard,
  MdFolder,
  MdTask,
  MdCalendarMonth,
  MdNotes,
  MdSettings,
  MdChevronLeft,
  MdChevronRight,
  MdViewKanban,
  MdChat,
  MdGesture,
  MdHistoryEdu,
  MdSchool, // novo
} from 'react-icons/md'
```

### 3.2 — Item no menu (posição sugerida: depois de "Feed", antes de "Kanban" —
mas qualquer posição funciona)

```tsx
const menuItems = [
  { label: 'Dashboard', icon: MdDashboard, to: '/' },
  { label: 'Agenda', icon: MdCalendarMonth, to: '/agenda' },
  { label: 'Projetos', icon: MdFolder, to: '/projects' },
  { label: 'Feed', icon: MdHistoryEdu, to: '/feed' },
  { label: 'Estudos', icon: MdSchool, to: '/study' }, // novo
  { label: 'Kanban', icon: MdViewKanban, to: '/kanban' },
  { label: 'Canvas', icon: MdGesture, to: '/canvas' },
  { label: 'Chat', icon: MdChat, to: '/chat' },
  { label: 'Tarefas', icon: MdTask, to: '/tasks' },
  { label: 'Notas', icon: MdNotes, to: '/notes' },
  { label: 'Logs', icon: LuLogs, to: '/logs' },
]
```

Nada mais muda em `Aside.tsx` — `visibleMenuItems`/`disabledRoutes` já
funcionam automaticamente pro novo item, sem código extra (é filtro
genérico por `to`).

---

## Onde colocar os arquivos novos

Copiar a pasta `src/Study/` inteira (deste pacote) para dentro do `src/` real
do projeto, preservando a estrutura:

```
src/Study/
  DecksPage.tsx
  DeckPage.tsx
  StudySessionPage.tsx
  api/
    studyStorage.ts
    decks.ts
    flashcards.ts
  components/
    DeckCard.tsx
    DeckFormModal.tsx
    FlashcardFormModal.tsx
    FlashcardListItem.tsx
    MarkdownView.tsx
  hooks/
    useDecks.ts
    useFlashcards.ts
    useStudySession.ts
  types/
    study.types.ts
  utils/
    studyRating.ts
```

---

## Pendência aberta (ver `utils/studyRating.ts`)

`applyRating()` é hoje um no-op estrutural (só incrementa `reviewCount`).
Quando a repetição espaçada (FSRS/SM-2) for implementada, a mudança real
fica concentrada ali dentro — quem chama (`useStudySession.rate`) não precisa
mudar. Também será preciso, nesse momento, persistir o `srs` atualizado do
card (hoje `rate()` calcula mas não salva, de propósito, já que sem SRS de
verdade calcular a cada revisão sem usar o resultado seria trabalho morto).
