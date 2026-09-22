import assert from 'node:assert/strict';
import { JSDOM, VirtualConsole } from 'jsdom';

// Executes the production IIFE with empty device storage. It never opens a
// browser profile or reads a user's local state. Browser workflow checks remain
// necessary: jsdom does not itself enforce Content Security Policy.
export async function smokeOffline(html) {
  let networkAttempts = 0;
  let loggedMessages = 0;
  let runtimeErrors = 0;
  const virtualConsole = new VirtualConsole();
  for (const name of ['log', 'info', 'warn', 'error', 'debug']) {
    virtualConsole.on(name, () => loggedMessages++);
  }
  virtualConsole.on('jsdomError', () => runtimeErrors++);
  const dom = new JSDOM(html, {
    url: 'https://offline.invalid/',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole,
    beforeParse(window) {
      const denied = () => {
        networkAttempts++;
        throw new Error('Networking is unavailable in the offline smoke test.');
      };
      window.fetch = denied;
      window.XMLHttpRequest = denied;
      window.WebSocket = denied;
      window.EventSource = denied;
      window.Worker = denied;
      window.navigator.sendBeacon = denied;
      // TanStack Router restores scroll; jsdom has no layout or scrolling.
      window.scrollTo = () => {};
      // React Flow observes the empty planning canvas. Layout itself is covered
      // by browser checks; jsdom does not implement ResizeObserver.
      window.ResizeObserver = class {
        observe() {}
        unobserve() {}
        disconnect() {}
      };
      window.addEventListener('error', () => runtimeErrors++);
      window.addEventListener('unhandledrejection', () => runtimeErrors++);
      window.matchMedia = () => ({
        matches: false,
        addEventListener() {},
        removeEventListener() {},
        addListener() {},
        removeListener() {},
      });
    },
  });
  try {
    await new Promise((resolve) => setTimeout(resolve, 150));
    assert.ok(
      dom.window.document.querySelector('#root')?.textContent?.trim(),
      'Offline app did not render',
    );
    assert.equal(networkAttempts, 0, 'Production app attempted a network request');
    assert.equal(loggedMessages, 0, 'Production app wrote console output');
    assert.equal(runtimeErrors, 0, 'Production app raised a runtime error');
  } finally {
    dom.window.close();
  }
}
