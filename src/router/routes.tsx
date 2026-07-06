import { createRootRoute, createRoute } from '@tanstack/react-router'
import { AppLayout } from '@/components/layout/AppLayout'
import { Dashboard } from '@/Dashboard/Dashboard'
import { Projects } from '@/Projects/Projects'
import { Project } from '@/Projects/Project/Project'
import { Settings } from '@/Settings/Settings'

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

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: Settings,
})

export const routeTree = rootRoute.addChildren([
  dashboardRoute,
  projectsRoute,
  projectRoute,
  settingsRoute,
])
