// H-UI: die Suite-Shell (Seitenleiste, Topbar, Palette, Kürzel) mit dem WAP-Planer unter #/wap, für die Einbindung
// nach UI-Richtlinie 2.1 und 18 S-1 bis S-3. Die Route /wap ist wie in App.tsx verdrahtet (Delegat der Kürzel,
// Darstellung in der Kopfleiste), ohne Excel-Import (Einzeldatei ohne Worker). Die übrigen Suite-Routen sind
// Platzhalter. Die Suite-Historie erhält vorab einen Schritt zurück und einen vor (fiktive Namen), damit Suite-Undo und
// -Redo etwas ändern würden; `__suiteProject` liefert den Suite-Stand für den Vergleich. Nur fiktive Daten.
import {
  createHashHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import type { CSSProperties } from 'react';
import { createRoot } from 'react-dom/client';
import { Shell, setRouteKeyDelegate, ThemeMenu } from '../../../src/components/Shell';
import { I2Application } from '../../../src/components/wap/i2/I2Application';
import { changeProject, initializeProject, projectStore, undoProject } from '../../../src/store';
import '../../../src/theme.css';

declare global {
  interface Window {
    __suiteProject?: () => string;
  }
}

function Wap() {
  return (
    <div style={{ '--wap-i2-height': '100dvh' } as CSSProperties}>
      <I2Application routeKeys={setRouteKeyDelegate} headerTools={<ThemeMenu />} />
    </div>
  );
}

function Platzhalter() {
  return (
    <main className="page">
      <p>Suite-Seite (Platzhalter der Testumgebung)</p>
    </main>
  );
}

const rootRoute = createRootRoute({ component: Shell });
const paths = [
  '/',
  '/sources',
  '/pisa',
  '/finish',
  '/persons',
  '/contacts',
  '/tagesbefehle',
  '/vor-ort',
];
const router = createRouter({
  routeTree: rootRoute.addChildren([
    createRoute({ getParentRoute: () => rootRoute, path: '/wap', component: Wap }),
    ...paths.map((path) =>
      createRoute({ getParentRoute: () => rootRoute, path, component: Platzhalter }),
    ),
  ]),
  history: createHashHistory(),
});

initializeProject();
for (const name of ['Übung Alpha', 'Übung Bravo', 'Übung Charlie'])
  changeProject((p) => {
    p.name = name;
  });
undoProject();
window.__suiteProject = () => JSON.stringify(projectStore.get());

const root = document.getElementById('root');
if (root !== null) createRoot(root).render(<RouterProvider router={router} />);
