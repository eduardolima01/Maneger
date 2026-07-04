import { createRootRoute, createRoute } from '@tanstack/react-router'

// import Home from '@/pages/Home'
import { Projects } from '@/projects/Projects'
// import Calendar from '@/pages/Calendar'
// import Settings from '@/pages/Settings'

const rootRoute = createRootRoute()

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: Projects,
})

const projectsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/projects',
  component: Projects,
})

// const calendarRoute = createRoute({
//   getParentRoute: () => rootRoute,
//   path: '/calendar',
//   component: Calendar,
// })
//
// const settingsRoute = createRoute({
//   getParentRoute: () => rootRoute,
//   path: '/settings',
//   component: Settings,
// })

export const routeTree = rootRoute.addChildren([
  homeRoute,
  projectsRoute,
  // calendarRoute,
  // settingsRoute,
])      
