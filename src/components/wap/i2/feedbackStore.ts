// Rückmeldung beim Ziehen (Paket PERF, R-5.1-14, R-11-11): Ziel und Zeiten ändern sich bei fast jeder Mausbewegung.
// Sie liegen in einem kleinen Speicher, den nur die Elemente der Rückmeldung (Vorschaurahmen, Zeitschild) abonnieren;
// das Raster zeichnet nur neu, wenn sich die Vorschau der Nachbarn ändert.

import { useSyncExternalStore } from 'react';

export interface FeedbackStore<T> {
  readonly get: () => T;
  readonly set: (value: T) => void;
  readonly subscribe: (listener: () => void) => () => void;
}

export function createFeedbackStore<T>(initial: T): FeedbackStore<T> {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set: (next) => {
      if (Object.is(next, value)) return;
      value = next;
      for (const l of [...listeners]) l();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** Aktueller Wert des Speichers; zeichnet nur die aufrufende Komponente neu. */
export function useFeedback<T>(store: FeedbackStore<T>): T {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}
