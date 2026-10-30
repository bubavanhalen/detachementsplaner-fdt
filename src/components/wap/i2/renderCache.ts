// Zwischenspeicher für Rasterelemente (Paket PERF, R-5.1-14, R-11-11; Beschrieb 11 «Ziehen folgt der Maus ohne
// sichtbare Verzögerung»): Beim Ziehen zeichnet das Raster bei jeder Lageänderung neu. Elemente, deren Daten sich
// nicht geändert haben, gibt der Zwischenspeicher als dasselbe Objekt zurück; React überspringt sie dann ganz (kein
// Vergleich, keine DOM-Änderung). Ereignisse solcher Elemente rufen die Handler über `useLatest` auf, damit sie nie
// mit dem Zustand eines älteren Neuzeichnens arbeiten.

import { type JSX, useLayoutEffect, useRef } from 'react';

interface Slot {
  readonly deps: readonly unknown[];
  readonly element: JSX.Element;
}

/** Liefert ein Element aus dem Zwischenspeicher, solange `deps` (je Stelle `Object.is`) gleich bleiben. */
export type CachedElement = (
  key: string,
  deps: readonly unknown[],
  make: () => JSX.Element,
) => JSX.Element;

function same(a: readonly unknown[], b: readonly unknown[]): boolean {
  return a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
}

/**
 * Zwischenspeicher je Neuzeichnen: gelesen wird aus dem letzten Neuzeichnen, geschrieben ins aktuelle. Schlüssel, die
 * ein Neuzeichnen nicht mehr verlangt, entfallen danach (kein Wachsen über die Woche hinaus). `deps` müssen alle
 * Daten enthalten, die das Element zeichnet; Handler laufen über `useLatest`.
 */
export function useElementCache(): CachedElement {
  const store = useRef<{ prev: Map<string, Slot>; cur: Map<string, Slot> }>({
    prev: new Map(),
    cur: new Map(),
  });
  const s = store.current;
  if (s.cur.size > 0) s.prev = s.cur;
  s.cur = new Map();
  return (key, deps, make) => {
    const known = s.cur.get(key) ?? s.prev.get(key);
    if (known !== undefined && same(known.deps, deps)) {
      s.cur.set(key, known);
      return known.element;
    }
    const element = make();
    s.cur.set(key, { deps, element });
    return element;
  };
}

/** Neuester Wert nach jedem Übernehmen ins DOM (für Handler zwischengespeicherter Elemente). */
export function useLatest<T>(value: T): { readonly current: T } {
  const ref = useRef(value);
  useLayoutEffect(() => {
    ref.current = value;
  });
  return ref;
}
