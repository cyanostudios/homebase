import { Router, RootRoute, Route } from '@tanstack/react-router';
import Layout from '../app/layout';
import Dashboard from '../app/routes/dashboard';
import Invoice from '../app/routes/invoice';

const rootRoute = new RootRoute({ component: Layout });

const dashboardRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/dashboard',
  component: Dashboard,
});

const invoiceRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/invoice',
  component: Invoice,
});

const routeTree = rootRoute.addChildren([dashboardRoute, invoiceRoute]);

export const router = new Router({
  routeTree,
  defaultPreload: 'intent',
});

export type AppRouter = typeof router;
