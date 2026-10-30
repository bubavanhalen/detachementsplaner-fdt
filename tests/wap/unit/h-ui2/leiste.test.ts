// @vitest-environment jsdom
// H-UI2, Befunde UX-H-03, SA-H-06 und SA-H-19 (UI-Richtlinie 2.2, 10, 11.2; R-11-07, R-L-07): Auswahl der Elemente,
// die bei Platzmangel ins Menü ausweichen (feste bleiben, tiefste Priorität zuerst, Reihenfolge stabil), und Schutz der
// Sperrdialoge: Schliesst der Browser einen gesperrten Dialog, öffnet er sofort wieder; ein gewöhnlicher meldet das
// Schliessen. Nur fiktive Daten.
import { act, render } from '@testing-library/react';
import { createElement, useRef } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { useDialogGuard } from '../../../../src/components/wap/i2/dialogGuard';
import { overflowing } from '../../../../src/components/wap/i2/OverflowBar';

beforeAll(() => {
  const proto = HTMLDialogElement.prototype as unknown as {
    showModal?: () => void;
    close?: () => void;
  };
  proto.showModal = function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  proto.close = function (this: HTMLDialogElement) {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
});

const items = [
  { id: 'fest' },
  { id: 'a', priority: 10 },
  { id: 'b', priority: 90 },
  { id: 'c', priority: 50 },
];
const widths = new Map([
  ['fest', 100],
  ['a', 100],
  ['b', 100],
  ['c', 100],
]);

describe('H-UI2 UX-H-03: Überlauf der Leisten', () => {
  it('[R-11-07] passt alles, weicht nichts aus; sonst zuerst die tiefste Priorität, feste nie', () => {
    expect([...overflowing(items, widths, 430, 10, 0)]).toEqual([]);
    expect([...overflowing(items, widths, 400, 10, 80)].sort()).toEqual(['a', 'c']);
    expect([...overflowing(items, widths, 330, 10, 80)].sort()).toEqual(['a', 'c']);
    expect([...overflowing(items, widths, 200, 10, 80)].sort()).toEqual(['a', 'b', 'c']);
    expect([...overflowing(items, widths, 120, 10, 80)].sort()).toEqual(['a', 'b', 'c']);
  });

  it('[R-11-07] ohne Layout (Breite 0) weicht nichts aus; die erste Priorität, die nicht passt, beendet die Reihe', () => {
    expect([...overflowing(items, widths, 0, 10, 80)]).toEqual([]);
    const schmal = new Map(widths).set('a', 20);
    // b passt, c nicht → a (schmal, aber tiefer) weicht trotzdem aus: stabile Reihenfolge nach Priorität.
    expect([...overflowing(items, schmal, 330, 10, 80)].sort()).toEqual(['a', 'c']);
  });
});

function Dialog({ locked, onNative }: { readonly locked: boolean; readonly onNative: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useDialogGuard(ref, { locked, onNativeClose: onNative });
  return createElement('dialog', { ref, 'aria-label': 'Probe' });
}

describe('H-UI2 SA-H-06, SA-H-19: Schutz der Sperrdialoge', () => {
  it('[R-L-07] ein gesperrter Dialog, den der Browser schliesst, ist sofort wieder offen; Esc wird abgefangen', () => {
    const onNative = vi.fn();
    const r = render(createElement(Dialog, { locked: true, onNative }));
    const d = r.container.querySelector('dialog') as HTMLDialogElement;
    d.showModal();
    act(() => d.close());
    expect(d.hasAttribute('open')).toBe(true);
    expect(onNative).not.toHaveBeenCalled();
    const esc = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    d.dispatchEvent(esc);
    expect(esc.defaultPrevented).toBe(true);
    const cancel = new Event('cancel', { cancelable: true });
    d.dispatchEvent(cancel);
    expect(cancel.defaultPrevented).toBe(true);
    r.unmount();
  });

  it('[R-L-07] ein gewöhnlicher Dialog, den der Browser schliesst, meldet das der Anwendung', () => {
    const onNative = vi.fn();
    const r = render(createElement(Dialog, { locked: false, onNative }));
    const d = r.container.querySelector('dialog') as HTMLDialogElement;
    d.showModal();
    act(() => d.close());
    expect(d.hasAttribute('open')).toBe(false);
    expect(onNative).toHaveBeenCalledTimes(1);
    r.unmount();
  });
});
