import {
  createHashHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import ContactsPage from './pages/ContactsPage';
import FilesPage from './pages/FilesPage';
import PeoplePage from './pages/PeoplePage';
import PisaPage from './pages/PisaPage';
import PlanningPage from './pages/PlanningPage';
import { notify, useFeedback, useProject } from './store';

function Shell() {
  const project = useProject(),
    feedback = useFeedback();
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link to="/" className="brand">
          <span className="brand-mark">D.</span>
          <span>
            Detachementsplaner<small>VORBEREITEN. ABGLEICHEN. NACHSCHLAGEN.</small>
          </span>
        </Link>
        <div className="sidebar-project">
          <span className="eyebrow">DIENSTLEISTUNG</span>
          <strong>{project.name}</strong>
          <small>{project.settings.eigeneEinheit || 'Einheit noch offen'}</small>
        </div>
        <nav aria-label="Hauptnavigation">
          {(
            [
              { to: '/', label: 'Planung', count: project.dets.length },
              { to: '/pisa', label: 'In PISA übernehmen' },
              { to: '/persons', label: 'Personen', count: project.persons.length },
              { to: '/contacts', label: 'Kontakt-CSV' },
              { to: '/files', label: 'Dateien & Archiv' },
            ] as const
          ).map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="nav-link"
              activeProps={{ className: 'nav-link active' }}
              activeOptions={{ exact: true }}
            >
              <span>{item.label}</span>
              {'count' in item && <span className="nav-count">{item.count}</span>}
            </Link>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span className="offline-badge">● Ausschliesslich lokal</span>
          <p>Deine Daten bleiben auf diesem Gerät.</p>
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <span>{project.archive ? 'ARCHIV · SCHREIBGESCHÜTZT' : 'IN VORBEREITUNG'}</span>
          <span>
            {feedback.saveError
              ? 'Sicherung erforderlich'
              : feedback.savedAt
                ? `Lokal gespeichert · ${feedback.savedAt}`
                : 'Offline verwendbar'}
          </span>
        </header>
        {feedback.saveError && (
          <div className="notice warning app-notice" role="alert">
            {feedback.saveError} <Link to="/files">Dateien & Sicherung</Link>
          </div>
        )}
        {project.archive && (
          <div className="notice app-notice">
            Archivstand vom {new Date(project.archive.at).toLocaleDateString('de-CH')}.{' '}
            <Link to="/files">Arbeitskopie öffnen</Link>
          </div>
        )}
        <Outlet />
        {feedback.message && (
          <div className="toast" role="status">
            <span>{feedback.message}</span>
            <button type="button" aria-label="Hinweis schliessen" onClick={() => notify('')}>
              ×
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
const rootRoute = createRootRoute({
  component: Shell,
  errorComponent: () => (
    <div className="notice warning" role="alert">
      Die Ansicht konnte nicht geöffnet werden. Der lokale Stand bleibt erhalten. Bitte die
      Anwendung neu öffnen.
    </div>
  ),
  notFoundComponent: () => (
    <div className="page">
      <h1>Ansicht nicht gefunden.</h1>
      <Link to="/">Zur Planung</Link>
    </div>
  ),
});
const routes = [
  createRoute({ getParentRoute: () => rootRoute, path: '/', component: PlanningPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/pisa', component: PisaPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/persons', component: PeoplePage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/contacts', component: ContactsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/files', component: FilesPage }),
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
        <h1>Ansicht konnte nicht geladen werden.</h1>
        <p>Dein gespeicherter Stand bleibt lokal erhalten. Bitte öffne die Anwendung erneut.</p>
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
