// @vitest-environment jsdom
// H-UI, Befund CR-H-U-08 (R-11-07; UI-Richtlinie 18 S-3; ADR-001 «Tastatur»): In der Suite setzt der WAP-Planer beim
// Öffnen seinen Delegaten über die übergebene Funktion (`setRouteKeyDelegate`) und entfernt ihn beim Verlassen (null);
// er hört dann nicht zusätzlich selbst auf `window`. Fiktive Daten.
import { act, fireEvent, render, screen } from '@testing-library/react';
import { IDBFactory } from 'fake-indexeddb';
import { createElement } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { I2Application } from '../../../../src/components/wap/i2/I2Application';
import { ownsRouteKey, type RouteKeys } from '../../../../src/components/wap/i2/keyboard';

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

/** WAP-Planer mit Delegationsfunktion wie in der Suite (WapPage). */
function Route({ routeKeys }: { readonly routeKeys: (d: RouteKeys | null) => void }) {
  return I2Application({ routeKeys });
}

describe('H-UI CR-H-U-08: Delegat der WAP-Route', () => {
  it('[R-11-07] setzt beim Öffnen den Delegaten (Tasten nach ownsRouteKey) und beim Verlassen null', async () => {
    const calls: (RouteKeys | null)[] = [];
    const r = render(
      createElement(Route, {
        routeKeys: (d: RouteKeys | null) => {
          calls.push(d);
        },
      }),
    );
    await screen.findByRole('button', { name: 'Neuer Plan aus Vorlage' });
    const last = calls.at(-1);
    expect(last).not.toBeNull();
    expect(last?.handles).toBe(ownsRouteKey);
    // «?» über den Delegaten öffnet die Übersicht des WAP-Planers.
    act(() => last?.handle(new KeyboardEvent('keydown', { key: '?' })));
    expect(screen.getByRole('dialog', { name: 'Tastenkürzel – WAP-Planer' })).toBeTruthy();
    r.unmount();
    expect(calls.at(-1)).toBeNull();
  });

  it('[R-11-07] mit Delegat hört die Route nicht selbst auf window (kein doppeltes Auslösen)', async () => {
    render(createElement(Route, { routeKeys: () => undefined }));
    await screen.findByRole('button', { name: 'Neuer Plan aus Vorlage' });
    fireEvent.keyDown(window, { key: '?' });
    expect(screen.queryByRole('dialog', { name: 'Tastenkürzel – WAP-Planer' })).toBeNull();
  });
});
