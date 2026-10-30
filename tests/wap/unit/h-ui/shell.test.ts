// @vitest-environment jsdom
// H-UI, Befunde CR-H-U-07 und CR-H-U-08 (R-11-07; UI-Richtlinie 2.1, 13.2, 18 S-1 bis S-3; ADR-001 «Tastatur»): Die
// Suite-Shell führt den WAP-Planer unter «Nachschlagen» mit Alt+9, in der Befehlspalette (Gruppe «WAP-Planer») und in
// der Kürzelübersicht; auf /wap ist die Seitenleiste standardmässig eingeklappt (ohne die gespeicherte Einstellung zu
// ändern), die Route zeichnet ihre eigene Kopfleiste, und die globalen Kürzel gehen über `setRouteKeyDelegate` an die
// Route. Ctrl+B in einem WAP-Textfeld klappt die Seitenleiste nie. Fiktive Daten.
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const nav = vi.fn((_to: { to: string }) => Promise.resolve());
let pathname = '/wap';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, className }: { children: ReactNode; to: string; className?: string }) =>
    createElement('a', { href: to, className }, children),
  Outlet: () => createElement('div', null, createElement('input', { 'aria-label': 'WAP Ort' })),
  useNavigate: () => nav,
  useRouterState: ({ select }: { select: (s: { location: { pathname: string } }) => unknown }) =>
    select({ location: { pathname } }),
}));

const { Shell, setRouteKeyDelegate } = await import('../../../../src/components/Shell');
const { ownsRouteKey } = await import('../../../../src/components/wap/i2/keyboard');
const { openOverlay, preferencesStore, setPreference } = await import('../../../../src/ui');
const { changeProject, projectStore } = await import('../../../../src/store');

beforeAll(() => {
  const proto = HTMLDialogElement.prototype as unknown as {
    showModal?: () => void;
    close?: () => void;
  };
  if (typeof proto.showModal !== 'function')
    proto.showModal = function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    };
  if (typeof proto.close !== 'function')
    proto.close = function (this: HTMLDialogElement) {
      this.removeAttribute('open');
    };
});

let downloads = 0;
beforeEach(() => {
  pathname = '/wap';
  nav.mockClear();
  downloads = 0;
  vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
    downloads++;
    return 'blob:lokal';
  });
  setPreference('sidebar', 'expanded');
  openOverlay({ palette: false, shortcuts: false });
});
afterEach(() => {
  setRouteKeyDelegate(null);
  openOverlay({ palette: false, shortcuts: false });
});

function sidebarOf(container: HTMLElement): string | null {
  return container.querySelector('.app')?.getAttribute('data-sidebar') ?? null;
}

/** Delegat wie die WAP-Route: übernimmt die Tasten, die `ownsRouteKey` der Route zuordnet. */
function wapDelegate() {
  const handle = vi.fn();
  setRouteKeyDelegate({ handles: ownsRouteKey, handle });
  return handle;
}

describe('H-UI CR-H-U-08: Einbindung des WAP-Planers in die Suite (S-1, S-2, S-3)', () => {
  it('[R-11-07] Alt+9 öffnet den WAP-Planer (S-1)', () => {
    pathname = '/';
    render(createElement(Shell));
    fireEvent.keyDown(window, { key: '9', altKey: true });
    expect(nav).toHaveBeenCalledWith({ to: '/wap' });
  });

  it('[R-11-07] Eintrag «WAP-Planer» unter «Nachschlagen» mit Hinweis «WAP erfassen, prüfen, PDF» (S-1)', () => {
    pathname = '/';
    render(createElement(Shell));
    const nav = screen.getByRole('navigation', { name: 'Werkzeuge' });
    const link = [...nav.querySelectorAll('a')].find((a) => a.getAttribute('href') === '/wap');
    expect(link?.textContent).toContain('WAP-Planer');
    expect(link?.textContent).toContain('WAP erfassen, prüfen, PDF');
    // Reihenfolge wie Alt 5–9: der WAP-Planer ist das letzte Werkzeug.
    expect([...nav.querySelectorAll('a')].at(-1)).toBe(link);
  });

  it('[R-11-07] Befehlspalette: Gruppe «WAP-Planer» mit «WAP-Planer öffnen» (Alt 9) (S-1)', async () => {
    pathname = '/';
    render(createElement(Shell));
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    const option = screen.getByRole('option', { name: /WAP-Planer öffnen/ });
    expect(option.textContent).toContain('Alt 9');
    expect(screen.getByText('WAP-Planer', { selector: '.palette-group' })).toBeTruthy();
    fireEvent.click(option);
    await waitFor(() => expect(nav).toHaveBeenCalledWith({ to: '/wap' }));
  });

  it('[R-11-07] Kürzelübersicht der Suite nennt «Personen / Kontakte / Tagesbefehle / Vor Ort / WAP-Planer» mit Alt 5–9 (S-1)', () => {
    pathname = '/';
    render(createElement(Shell));
    fireEvent.keyDown(window, { key: '?' });
    const dialog = screen.getByRole('dialog', { name: 'Tastenkürzel' });
    const row = [...dialog.querySelectorAll('.shortcut-row')].find((r) =>
      r.textContent?.startsWith('Personen / Kontakte / Tagesbefehle / Vor Ort / WAP-Planer'),
    );
    expect(row?.textContent).toContain('5–9');
  });

  it('[R-11-07] auf /wap ist die Seitenleiste eingeklappt, die gespeicherte Einstellung bleibt; Ctrl+B klappt aus (S-2)', () => {
    const r = render(createElement(Shell));
    expect(sidebarOf(r.container)).toBe('collapsed');
    expect(preferencesStore.get().sidebar).toBe('expanded');
    fireEvent.keyDown(window, { key: 'b', ctrlKey: true });
    expect(sidebarOf(r.container)).toBe('expanded');
    fireEvent.keyDown(window, { key: 'b', ctrlKey: true });
    expect(sidebarOf(r.container)).toBe('collapsed');
    expect(preferencesStore.get().sidebar).toBe('expanded');
    // Andere Routen zeigen die gespeicherte Einstellung.
    pathname = '/persons';
    r.rerender(createElement(Shell));
    expect(sidebarOf(r.container)).toBe('expanded');
  });

  it('[R-11-07] auf /wap keine Suite-Kopfleiste: die Route zeichnet ihre eigene (S-2)', () => {
    const r = render(createElement(Shell));
    expect(r.container.querySelector('.topbar')).toBeNull();
    pathname = '/persons';
    r.rerender(createElement(Shell));
    expect(r.container.querySelector('.topbar')).not.toBeNull();
  });
});

describe('H-UI CR-H-U-07: Suite-Kürzel auf /wap über den Delegaten (S-3)', () => {
  it('[R-11-07] Ctrl+B in einem WAP-Textfeld klappt die Seitenleiste nicht (mit und ohne Delegat)', () => {
    const r = render(createElement(Shell));
    const input = screen.getByLabelText('WAP Ort');
    input.focus();
    fireEvent.keyDown(input, { key: 'b', ctrlKey: true });
    expect(sidebarOf(r.container)).toBe('collapsed');
    const handle = wapDelegate();
    fireEvent.keyDown(input, { key: 'b', ctrlKey: true });
    expect(sidebarOf(r.container)).toBe('collapsed');
    expect(preferencesStore.get().sidebar).toBe('expanded');
    expect(handle).toHaveBeenCalledTimes(1);
  });

  it('[R-11-07] Delegat gesetzt: Ctrl+S, Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z und «?» gehen nur an die Route', () => {
    changeProject((p) => {
      p.name = 'Übung Alpha';
    });
    const before = JSON.stringify(projectStore.get());
    render(createElement(Shell));
    const handle = wapDelegate();
    for (const key of [
      { key: 's', ctrlKey: true },
      { key: 'z', ctrlKey: true },
      { key: 'y', ctrlKey: true },
      { key: 'Z', ctrlKey: true, shiftKey: true },
      { key: '?' },
    ])
      fireEvent.keyDown(document.body, key);
    expect(handle).toHaveBeenCalledTimes(5);
    expect(downloads).toBe(0);
    expect(JSON.stringify(projectStore.get())).toBe(before);
    expect(screen.queryByRole('dialog', { name: 'Tastenkürzel' })).toBeNull();
  });

  it('[R-11-07] Ctrl+K und Alt+1–9 bleiben Suite-Kürzel, auch mit Delegat', () => {
    render(createElement(Shell));
    const handle = wapDelegate();
    fireEvent.keyDown(window, { key: '5', altKey: true });
    expect(nav).toHaveBeenCalledWith({ to: '/persons' });
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(screen.getByRole('dialog', { name: 'Befehle und Suche' })).toBeTruthy();
    expect(handle).not.toHaveBeenCalled();
  });

  it('[R-11-07] ohne Delegat (Route noch nicht bereit) lösen Suite-Undo, -Redo und -JSON-Sicherung auf /wap nicht aus', () => {
    changeProject((p) => {
      p.name = 'Übung Bravo';
    });
    const before = JSON.stringify(projectStore.get());
    render(createElement(Shell));
    for (const key of [
      { key: 's', ctrlKey: true },
      { key: 'z', ctrlKey: true },
      { key: 'y', ctrlKey: true },
      { key: 'Z', ctrlKey: true, shiftKey: true },
    ])
      fireEvent.keyDown(document.body, key);
    expect(downloads).toBe(0);
    expect(JSON.stringify(projectStore.get())).toBe(before);
  });

  it('[R-11-07] Delegat entfernt (null): auf anderen Routen gelten die Suite-Kürzel unverändert', () => {
    pathname = '/persons';
    wapDelegate();
    setRouteKeyDelegate(null);
    render(createElement(Shell));
    fireEvent.keyDown(document.body, { key: 's', ctrlKey: true });
    expect(downloads).toBe(1);
  });

  it('[R-11-07] Tasten der WAP-Route: Ctrl+S/Z/Y/O/P/G/L/F, «?», Alt+Bild↑/↓, Ctrl+B nur im Textfeld; nie Ctrl+K oder Alt+Ziffer', () => {
    const key = (init: KeyboardEventInit, target: EventTarget = document.body) => {
      const e = new KeyboardEvent('keydown', init);
      Object.defineProperty(e, 'target', { value: target });
      return ownsRouteKey(e);
    };
    for (const k of ['s', 'z', 'y', 'o', 'p', 'g', 'l', 'f'])
      expect(key({ key: k, ctrlKey: true })).toBe(true);
    expect(key({ key: 'Z', ctrlKey: true, shiftKey: true })).toBe(true);
    expect(key({ key: '?' })).toBe(true);
    expect(key({ key: 'PageDown', altKey: true })).toBe(true);
    expect(key({ key: 'PageUp', altKey: true })).toBe(true);
    const input = document.createElement('input');
    expect(key({ key: 'b', ctrlKey: true }, input)).toBe(true);
    expect(key({ key: 'b', ctrlKey: true })).toBe(false);
    expect(key({ key: 'k', ctrlKey: true })).toBe(false);
    for (const d of ['1', '5', '9']) expect(key({ key: d, altKey: true })).toBe(false);
  });
});
