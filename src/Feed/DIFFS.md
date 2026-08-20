# router/routes.tsx

Import novo:
```tsx
import FeedPage from '@/Feed/FeedPage'
```

Nova rota — precisa de `validateSearch` pra aceitar `?momentId=` (usado pela Pesquisa Global):
```tsx
const feedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/feed',
  component: FeedPage,
  validateSearch: (search: Record<string, unknown>) => ({
    momentId: typeof search.momentId === 'string' ? search.momentId : undefined,
  }),
})
```

Incluir em `addChildren([...])`:
```tsx
return rootRoute.addChildren([
    dashboardRoute, projectsRoute, projectRoute, kanbanRoute, kanbanBoardRoute,
    settingsRoute, agendaRoute, logsRoute, chatRoute, canvasRoute, feedRoute,
])
```

---

# components/layout/Aside/Aside.tsx

Import novo (ícone):
```tsx
import { MdHistoryEdu } from 'react-icons/md' // ou outro ícone de sua preferência
```

Item novo em `menuItems`:
```tsx
{ label: 'Feed', icon: MdHistoryEdu, to: '/feed' },
```

---

# components/layout/tabs/tabStore.ts

```tsx
const ROUTE_LABELS: Record<string, string> = {
  // ...existentes
  '/feed': 'Feed',
};

const ROUTE_ICONS: Record<string, string> = {
  // ...existentes
  '/feed': '🕓',
};
```

---

# modules/search/components/GlobalSearchWidget.tsx

Import novo:
```tsx
import { createFeedProvider } from '@/Feed/search/feed.provider';
```

Registro (dentro do useEffect que registra os outros providers):
```tsx
searchRegistry.register(createFeedProvider(nav));
```

Em `resolveRecentAction`, novo case:
```tsx
case 'feed': return () => navigateFn.current(`/feed?momentId=${entry.id}`);
```

---

# components/layout/AppLayout.tsx

Import novo:
```tsx
import GlobalMomentComposerHost from '@/Feed/components/GlobalMomentComposerHost'
```

Adicionar ao lado dos outros widgets globais:
```tsx
<GlobalMomentComposerHost />
```

---

# src-tauri/src/lib.rs

Colar o conteúdo de `feed_commands.rs` (ou, se preferir módulo separado como foi feito
com Canvas: `mod feed_commands;` + `use feed_commands::*;` no topo, e funções `pub fn`).

Adicionar ao `tauri::generate_handler![...]`:
```rust
load_feed_data,
save_feed_data,
save_moment_asset_bytes,
delete_moment_asset,
```
