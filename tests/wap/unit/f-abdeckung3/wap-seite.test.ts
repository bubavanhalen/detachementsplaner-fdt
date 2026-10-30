// @vitest-environment jsdom
// F-ABDECKUNG3: Einstieg der Suite-Route `WapPage` (Beschrieb 5.7; UI-Richtlinie 2.1, 18 S-2/S-3; ADR-001; R-5.7-01,
// R-11-07). Ohne Eigenschaften (auch ohne Eigenschaftsobjekt, Vorgabe `= {}`) zeigt die Seite den Erststart und hört
// selbst auf die Tastatur; mit teilweisen Eigenschaften gelten genau die übergebenen (Delegat, Palettenbefehle,
// Kopfwerkzeuge), die übrigen bleiben bei ihren Vorgaben. Leere lokale Datenbank, keine Daten.
import { act, fireEvent, render, screen } from '@testing-library/react';
import { IDBFactory } from 'fake-indexeddb';
import { createElement } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RouteKeys } from '../../../../src/components/wap/i2/keyboard';
import type { WapCommand } from '../../../../src/components/wap/i2/WapPalette';
import WapPage from '../../../../src/pages/WapPage';

function localLocks(): LockManager {
  return {
    request: async (_name: string, _options: unknown, run: (lock: unknown) => Promise<unknown>) =>
      run({ mode: 'exclusive' }),
  } as unknown as LockManager;
}

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
beforeEach(() => {
  vi.stubGlobal('indexedDB', new IDBFactory());
  vi.stubGlobal('navigator', { locks: localLocks() });
});
afterEach(() => {
  vi.unstubAllGlobals();
});

/** Eigenschaften der Route (alle optional). */
type WapPageProps = NonNullable<Parameters<typeof WapPage>[0]>;

const ERSTSTART = 'Neuer Plan aus Vorlage';
const UEBERSICHT = 'Tastenkürzel – WAP-Planer';

describe('F-ABDECKUNG3 WapPage: Einstieg ohne und mit teilweisen Eigenschaften', () => {
  it('[R-5.7-01] ohne Eigenschaftsobjekt (Vorgabe): Erststart mit Excel-Import, ganze Fensterhöhe, die Route hört selbst auf «?»', async () => {
    const r = render(WapPage());
    await screen.findByRole('button', { name: ERSTSTART });
    expect(screen.getAllByRole('button', { name: /Excel-WAP importieren/ }).length).toBeGreaterThan(
      0,
    );
    const huelle = r.container.firstElementChild as HTMLElement;
    expect(huelle.style.getPropertyValue('--wap-i2-height')).toBe('100dvh');
    // Ohne Delegat behandelt die Route Tasten selbst: «?» öffnet die Übersicht des WAP-Planers.
    act(() => {
      fireEvent.keyDown(window, { key: '?' });
    });
    expect(screen.getByRole('dialog', { name: UEBERSICHT })).toBeTruthy();
  });

  it('[R-5.7-01] mit leerem Eigenschaftsobjekt: derselbe Erststart, kein Fehler, keine Kopfwerkzeuge der Suite', async () => {
    const fehler = vi.spyOn(console, 'error');
    render(createElement(WapPage, {}));
    await screen.findByRole('button', { name: ERSTSTART });
    expect(screen.queryByRole('button', { name: 'Suite-Werkzeug' })).toBeNull();
    expect(fehler).not.toHaveBeenCalled();
  });

  it('[R-11-07] nur Delegat und Kopfwerkzeuge: die Suite erhält den Delegaten (beim Verlassen null), die Route hört nicht selbst; Palettenbefehle bleiben aus', async () => {
    const delegaten: (RouteKeys | null)[] = [];
    const r = render(
      createElement<WapPageProps>(WapPage, {
        routeKeys: (d: RouteKeys | null) => {
          delegaten.push(d);
        },
        headerTools: createElement('button', { type: 'button' }, 'Suite-Werkzeug'),
      }),
    );
    await screen.findByRole('button', { name: ERSTSTART });
    expect(screen.getByRole('button', { name: 'Suite-Werkzeug' })).toBeTruthy();
    expect(delegaten.at(-1)).not.toBeNull();
    fireEvent.keyDown(window, { key: '?' });
    expect(screen.queryByRole('dialog', { name: UEBERSICHT })).toBeNull();
    act(() => delegaten.at(-1)?.handle(new KeyboardEvent('keydown', { key: '?' })));
    expect(screen.getByRole('dialog', { name: UEBERSICHT })).toBeTruthy();
    r.unmount();
    expect(delegaten.at(-1)).toBeNull();
  });

  it('[R-11-07] nur Palettenbefehle: die Suite-Palette erhält die Befehle des WAP-Planers (beim Verlassen null); die Route hört selbst auf «?»', async () => {
    const quellen: ((() => readonly WapCommand[]) | null)[] = [];
    const r = render(
      createElement<WapPageProps>(WapPage, {
        routeCommands: (s: (() => readonly WapCommand[]) | null) => {
          quellen.push(s);
        },
      }),
    );
    await screen.findByRole('button', { name: ERSTSTART });
    const quelle = quellen.at(-1);
    expect(quelle).toBeTypeOf('function');
    const befehle = quelle?.() ?? [];
    expect(befehle.length).toBeGreaterThan(0);
    act(() => {
      fireEvent.keyDown(window, { key: '?' });
    });
    expect(screen.getByRole('dialog', { name: UEBERSICHT })).toBeTruthy();
    r.unmount();
    expect(quellen.at(-1)).toBeNull();
  });
});
