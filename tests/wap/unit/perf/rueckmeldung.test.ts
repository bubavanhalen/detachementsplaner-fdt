// @vitest-environment jsdom
// PERF (R-5.1-14): Rückmeldung beim Ziehen (Ziel, Zeiten) in einem eigenen Speicher. Eine Lageänderung zeichnet nur
// die Komponenten neu, die ihn abonnieren; das übrige Raster bleibt unberührt.
import { act, render, screen } from '@testing-library/react';
import { createElement, type JSX } from 'react';
import { describe, expect, it } from 'vitest';
import { createFeedbackStore, useFeedback } from '../../../../src/components/wap/i2/feedbackStore';

describe('PERF: Rückmeldung beim Ziehen', () => {
  it('[R-5.1-14] meldet nur geänderte Werte, Abmelden beendet die Meldungen', () => {
    const store = createFeedbackStore<string | null>(null);
    const seen: (string | null)[] = [];
    const stop = store.subscribe(() => seen.push(store.get()));
    store.set('0800-0900');
    store.set('0800-0900');
    store.set('0815-0915');
    stop();
    store.set(null);
    expect(seen).toEqual(['0800-0900', '0815-0915']);
    expect(store.get()).toBeNull();
  });

  it('[R-5.1-14] eine Lageänderung zeichnet nur das Zeitschild neu, nicht das Raster', () => {
    const store = createFeedbackStore('0800-0900');
    let grid = 0;
    let label = 0;
    function Label(): JSX.Element {
      label++;
      return createElement('output', null, useFeedback(store));
    }
    function Grid(): JSX.Element {
      grid++;
      return createElement('div', null, createElement(Label));
    }
    render(createElement(Grid));
    for (const t of ['0815-0915', '0830-0930', '0845-0945']) act(() => store.set(t));
    expect(screen.getByText('0845-0945')).toBeTruthy();
    expect(grid).toBe(1);
    expect(label).toBe(4);
  });
});
