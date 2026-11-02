// H-UI2: die Suite-Shell mit dem WAP-Planer unter #/wap wie in App.tsx (Delegat der Kürzel, Befehle der Route für die
// Suite-Palette, Darstellung in der Kopfleiste), ohne Excel-Import (Einzeldatei ohne Worker). Die übrigen Suite-Routen
// sind Platzhalter. Nur fiktive Daten.
import {
  createHashHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import type { CSSProperties } from 'react';
import { createRoot } from 'react-dom/client';
import { setRouteCommands } from '../../../src/components/CommandPalette';
import { Shell, setRouteKeyDelegate, ThemeMenu } from '../../../src/components/Shell';
import { I2Application } from '../../../src/components/wap/i2/I2Application';
import { initializeProject } from '../../../src/store';
import '../../../src/theme.css';

function Wap() {
  return (
    <div style={{ '--wap-i2-height': '100dvh' } as CSSProperties}>
      <I2Application
        routeKeys={setRouteKeyDelegate}
        routeCommands={setRouteCommands}
        headerTools={<ThemeMenu />}
      />
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
const root = document.getElementById('root');
if (root !== null) createRoot(root).render(<RouterProvider router={router} />);
