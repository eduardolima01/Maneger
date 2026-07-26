import { createRootRoute, createRoute } from '@tanstack/react-router'
import { AppLayout } from '@/components/layout/AppLayout'
import { Dashboard } from '@/Dashboard/Dashboard'
import { Projects } from '@/Projects/Projects'
import { Project } from '@/Projects/Project/Project'
import { Settings } from '@/Settings/Settings'
import Agenda from '@/Agenda/Agenda';
import LogsPage from '@/Logs/LogsPage';
import KanbanOverviewPage from '@/Kanban/KanbanOverviewPage'

const rootRoute = createRootRoute({
  component: AppLayout,
})

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: Dashboard,
})

const projectsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/projects',
  component: Projects,
})

const projectRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/projects/$projectId',
  component: Project,
})

const kanbanRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/kanban',
  component: KanbanOverviewPage,
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: Settings,
})

const agendaRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/agenda',
  component: Agenda,
});

const logsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/logs',
  component: LogsPage,
});

export const routeTree = rootRoute.addChildren([
  dashboardRoute,
  projectsRoute,
  projectRoute,
  kanbanRoute,
  settingsRoute,
  agendaRoute,
  logsRoute
])
