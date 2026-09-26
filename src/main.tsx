import { createRoot } from 'react-dom/client';
import App from './App';
import { setOfflineTemplate } from './io/offline';
import { initializeProject, notify } from './store';
import './theme.css';
import { preferencesStore } from './ui';

function start() {
  setOfflineTemplate(`<!DOCTYPE html>\n${document.documentElement.outerHTML}`);
  // Apply the saved theme before the first paint to avoid a light flash in dark mode.
  const { theme } = preferencesStore.get();
  if (theme !== 'system') document.documentElement.dataset.theme = theme;
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
