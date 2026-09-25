import {
  createHashHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  RouterProvider,
  redirect,
} from '@tanstack/react-router';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Shell } from './components/Shell';
import ContactsPage from './pages/ContactsPage';
import FinishPage from './pages/FinishPage';
import PeoplePage from './pages/PeoplePage';
import PisaPage from './pages/PisaPage';
import PlanningPage from './pages/PlanningPage';
import SourcesPage from './pages/SourcesPage';

const rootRoute = createRootRoute({
  component: Shell,
  errorComponent: () => (
    <div className="page">
      <div className="callout callout-danger" role="alert">
        <div className="callout-body">
          <strong>Die Ansicht konnte nicht geöffnet werden.</strong>
          Der lokale Stand bleibt erhalten. Bitte die Anwendung neu öffnen.
        </div>
      </div>
    </div>
  ),
  notFoundComponent: () => (
    <div className="page">
      <div className="empty">
        <h2>Ansicht nicht gefunden.</h2>
        <Link to="/" className="btn">
          Zur Planung
        </Link>
      </div>
    </div>
  ),
});
const routes = [
  createRoute({ getParentRoute: () => rootRoute, path: '/', component: PlanningPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/sources', component: SourcesPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/pisa', component: PisaPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/finish', component: FinishPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/persons', component: PeoplePage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/contacts', component: ContactsPage }),
  // Earlier versions kept imports and archives under one page.
  createRoute({
    getParentRoute: () => rootRoute,
    path: '/files',
    beforeLoad: () => {
      throw redirect({ to: '/sources' });
    },
  }),
];
export const router = createRouter({
  routeTree: rootRoute.addChildren(routes),
  history: createHashHistory(),
  defaultPreload: false,
});
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

class LocalBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(_error: Error, _info: ErrorInfo) {
    /* Never forward application errors or data to a logger. */
  }
  render() {
    return this.state.failed ? (
      <main className="page">
        <div className="empty">
          <h2>Ansicht konnte nicht geladen werden.</h2>
          <p>Dein gespeicherter Stand bleibt lokal erhalten. Bitte öffne die Anwendung erneut.</p>
        </div>
      </main>
    ) : (
      this.props.children
    );
  }
}
export default function App() {
  return (
    <LocalBoundary>
      <RouterProvider router={router} />
    </LocalBoundary>
  );
}
