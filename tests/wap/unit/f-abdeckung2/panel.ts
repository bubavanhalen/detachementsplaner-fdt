// F-ABDECKUNG2: Seitenfeld in jsdom wie in der Route: Befehle laufen auf den aktuellen Plan (Fehler erscheinen als
// Meldung des Seitenfelds), Auswahl und Fokusauftrag lassen sich wechseln. Nur fiktive Daten.
import { act, fireEvent, render } from '@testing-library/react';
import { createElement, useState } from 'react';
import { DetailPanel } from '../../../../src/components/wap/panel/DetailPanel';
import type { PanelActions, PanelTarget } from '../../../../src/components/wap/panel/types';
import { WapError } from '../../../../src/model/wap/errors';
import type { Id, IsoDate, Plan } from '../../../../src/model/wap/types';
import { apply, type Live, type Run } from './ui';

export interface PanelSpy extends Live {
  readonly removed: (readonly Id[])[];
  readonly renumbered: IsoDate[];
  readonly notices: string[];
  toGrid: number;
  closed: number;
}

interface HarnessProps {
  readonly target: PanelTarget;
  readonly focus: { readonly seq: number; readonly field: string | null };
}

export function renderPanel(
  initial: Plan,
  target: PanelTarget,
  opts: { readonly disabled?: boolean; readonly week?: number; readonly withNotice?: boolean } = {},
) {
  const spy: PanelSpy = {
    plan: initial,
    runs: 0,
    removed: [],
    renumbered: [],
    notices: [],
    toGrid: 0,
    closed: 0,
  };
  function Harness({ target: t, focus }: HarnessProps) {
    const [plan, setPlan] = useState(initial);
    const [error, setError] = useState('');
    spy.plan = plan;
    const actions: PanelActions = {
      run: (cmd: Run) => {
        try {
          setPlan(apply(spy, cmd));
          setError('');
        } catch (e) {
          setError(
            e instanceof WapError
              ? `${e.userMessage.cause} ${e.userMessage.nextStep}`
              : 'Die Änderung wurde nicht übernommen.',
          );
        }
      },
      toGrid: () => {
        spy.toGrid += 1;
      },
      remove: (ids) => spy.removed.push(ids),
      renumber: (d) => spy.renumbered.push(d),
      ...(opts.withNotice === false ? {} : { notice: (m: string) => spy.notices.push(m) }),
      disabled: opts.disabled ?? false,
    };
    return createElement(DetailPanel, {
      plan,
      weekId: plan.weeks[opts.week ?? 0]?.id ?? '',
      target: t,
      actions,
      error,
      onClose: () => {
        spy.closed += 1;
      },
      focus,
    });
  }
  let focus = { seq: 0, field: null as string | null };
  let current = target;
  const r = render(createElement(Harness, { target, focus }));
  const select = (t: PanelTarget) => {
    current = t;
    r.rerender(createElement(Harness, { target: t, focus }));
  };
  const focusField = (field: string | null) => {
    focus = { seq: focus.seq + 1, field };
    r.rerender(createElement(Harness, { target: current, focus }));
  };
  /** Textfeld ändern und verlassen (Übernahme beim Verlassen). */
  const type = (label: string | RegExp, value: string) => {
    const el = r.getByLabelText(label);
    act(() => {
      fireEvent.focus(el);
      fireEvent.change(el, { target: { value } });
      fireEvent.blur(el);
    });
    return el;
  };
  /** Auswahlfeld mit der Maus wählen (sofort übernommen). */
  const choose = (label: string | RegExp, value: string) => {
    const el = r.getByLabelText(label);
    act(() => {
      fireEvent.pointerDown(el);
      fireEvent.change(el, { target: { value } });
    });
    return el;
  };
  const alert = (): string => r.queryByRole('alert')?.textContent ?? '';
  const errorOf = (el: HTMLElement): string => {
    const id = el.getAttribute('aria-describedby') ?? '';
    return (
      id
        .split(' ')
        .map((x) => document.getElementById(x))
        .find((x) => x?.classList.contains('wap-panel-error'))?.textContent ?? ''
    );
  };
  return { ...r, spy, select, focusField, type, choose, alert, errorOf };
}

export const entries = (...ids: Id[]): PanelTarget => ({ kind: 'entries', ids, windowId: null });
