import { createRoot } from 'react-dom/client';
import App from './App';
import { seedTbAssets } from './io/tagesbefehl/assets';
import { setOfflineTemplate } from './pages/FilesPage';
import { initializeProject, notify } from './store';
import './theme.css';

function start() {
  setOfflineTemplate(`<!DOCTYPE html>\n${document.documentElement.outerHTML}`);
  // Assets from a self-contained export only fill an empty device store.
  seedTbAssets(window.__TBASSETS);
  initializeProject(window.__BOOTDATA);
  const root = document.getElementById('root');
  if (!root) return;
  createRoot(root, {
    onCaughtError: () => {},
    onUncaughtError: () =>
      notify('Die Ansicht konnte nicht aktualisiert werden. Bitte den lokalen Stand sichern.'),
    onRecoverableError: () => {},
  }).render(<App />);
}
if (document.readyState === 'loading')
  document.addEventListener('DOMContentLoaded', start, { once: true });
else start();
