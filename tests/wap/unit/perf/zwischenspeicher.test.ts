// @vitest-environment jsdom
// PERF (R-5.1-14, R-11-11): Zwischenspeicher der Rasterelemente. Unveränderte Elemente gibt er als dasselbe Objekt
// zurück, React zeichnet sie dann nicht neu (beim Ziehen nur Vorschau und betroffene Nachbarn); Handler aus dem
// Zwischenspeicher arbeiten über `useLatest` immer mit dem neuesten Zustand.
import { act, fireEvent, render, screen } from '@testing-library/react';
import { createElement, type JSX, memo, useState } from 'react';
import { describe, expect, it } from 'vitest';
import { useElementCache, useLatest } from '../../../../src/components/wap/i2/renderCache';

/** Zählt, wie oft eine Zeile gezeichnet wird. */
const drawn = new Map<string, number>();
const Row = memo(function Row({ name, onPick }: { name: string; onPick: () => void }) {
  drawn.set(name, (drawn.get(name) ?? 0) + 1);
  return createElement('button', { type: 'button', onClick: onPick }, name);
});

interface Probe {
  bump: () => void;
  rename: (i: number, name: string) => void;
  picked: string[];
}

/** Raster-Attrappe: drei Zeilen aus dem Zwischenspeicher, ein Zähler, der bei jedem Neuzeichnen wechselt. */
function Grid({ probe }: { probe: Probe }): JSX.Element {
  const [tick, setTick] = useState(0);
  const [names, setNames] = useState(['eins', 'zwei', 'drei']);
  probe.bump = () => setTick((t) => t + 1);
  probe.rename = (i, name) => setNames((n) => n.map((x, k) => (k === i ? name : x)));
  const cached = useElementCache();
  const on = useLatest({ tick });
  return createElement(
    'div',
    null,
    createElement('output', null, String(tick)),
    ...names.map((name, i) =>
      cached(`row:${String(i)}`, [name], () =>
        createElement(Row, {
          key: String(i),
          name,
          // Neue Funktion je Erzeugung: ohne Zwischenspeicher zeichnete memo die Zeile jedes Mal neu.
          onPick: () => probe.picked.push(`${name}@${String(on.current.tick)}`),
        }),
      ),
    ),
  );
}

describe('PERF: Zwischenspeicher der Rasterelemente', () => {
  it('[R-5.1-14] Neuzeichnen ohne geänderte Daten zeichnet keine Zeile neu, eine geänderte nur sich', () => {
    drawn.clear();
    const probe: Probe = { bump: () => {}, rename: () => {}, picked: [] };
    render(createElement(Grid, { probe }));
    expect([...drawn.values()]).toEqual([1, 1, 1]);
    const node = screen.getByRole('button', { name: 'zwei' });
    for (let i = 0; i < 5; i++) act(() => probe.bump());
    expect(screen.getByText('5')).toBeTruthy();
    expect([...drawn.values()]).toEqual([1, 1, 1]);
    act(() => probe.rename(1, 'zwo'));
    expect(drawn.get('zwo')).toBe(1);
    expect(drawn.get('eins')).toBe(1);
    expect(drawn.get('drei')).toBe(1);
    // Dasselbe DOM-Element (nur Inhalt geändert), kein Neuaufbau.
    expect(screen.getByRole('button', { name: 'zwo' })).toBe(node);
  });

  it('[R-5.1-14] Handler eines wiederverwendeten Elements sehen den neuesten Zustand', () => {
    const probe: Probe = { bump: () => {}, rename: () => {}, picked: [] };
    render(createElement(Grid, { probe }));
    act(() => probe.bump());
    act(() => probe.bump());
    fireEvent.click(screen.getByRole('button', { name: 'eins' }));
    expect(probe.picked).toEqual(['eins@2']);
  });
});
