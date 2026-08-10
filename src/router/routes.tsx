import { createRootRoute, createRoute, type AnyRootRoute } from '@tanstack/react-router'
import { AppLayout } from '@/components/layout/AppLayout'
import { Dashboard } from '@/Dashboard/Dashboard'
import { Projects } from '@/Projects/Projects'
import { Project } from '@/Projects/Project/Project'
import { Settings } from '@/Settings/Settings'
import Agenda from '@/Agenda/Agenda';
import LogsPage from '@/Logs/LogsPage';
import KanbanOverviewPage from '@/Kanban/KanbanOverviewPage'
import ChatPage from '@/Chat/ChatPage'
import KanbanBoardPage from '@/Kanban/KanbanBoardPage'
import { TabRootLayout } from '@/components/layout/tabs/TabRootLayout'
import CanvasPage from '@/Canvas/CanvasPage'

// fábrica: mesmas rotas-filha, reaproveitada tanto pro router principal quanto por cada aba
function buildRouteTree(rootRoute: AnyRootRoute) {
  const dashboardRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: Dashboard })
  const projectsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/projects', component: Projects })
  const projectRoute = createRoute({ getParentRoute: () => rootRoute, path: '/projects/$projectId', component: Project })
  const kanbanRoute = createRoute({ getParentRoute: () => rootRoute, path: '/kanban', component: KanbanOverviewPage })
  const kanbanBoardRoute = createRoute({ getParentRoute: () => rootRoute, path: '/kanban/$kanbanId', component: KanbanBoardPage })
  const settingsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/settings', component: Settings })
  const agendaRoute = createRoute({ getParentRoute: () => rootRoute, path: '/agenda', component: Agenda })
  const logsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/logs', component: LogsPage })
  const chatRoute = createRoute({ getParentRoute: () => rootRoute, path: '/chat', component: ChatPage })
  const canvasRoute = createRoute({ getParentRoute: () => rootRoute, path: '/canvas', component: CanvasPage })

  return rootRoute.addChildren([
    dashboardRoute, projectsRoute, projectRoute, kanbanRoute, kanbanBoardRoute,
    settingsRoute, agendaRoute, logsRoute, chatRoute, canvasRoute
  ])
}

// router principal — janela real, com Aside/TabBar/widgets globais
const mainRootRoute = createRootRoute({ component: AppLayout })
export const routeTree = buildRouteTree(mainRootRoute)

// árvore "nua" — reaproveitada por CADA aba, sem duplicar Aside/TabBar/widgets
export function buildTabRouteTree() {
  const tabRootRoute = createRootRoute({ component: TabRootLayout })
  return buildRouteTree(tabRootRoute)
}
