import { createRootRoute, createRoute } from '@tanstack/react-router'

import { AppLayout } from '@/components/layout/AppLayout'
import { Dashboard } from '@/Dashboard/Dashboard'
import { Projects } from '@/Projects/Projects'
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

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: Settings,
})

export const routeTree = rootRoute.addChildren([
  dashboardRoute,
  projectsRoute,
  settingsRoute
])
