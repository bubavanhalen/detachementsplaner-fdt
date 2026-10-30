// Terminbereich mit Fortsetzung (Vertrag E1-02e, Notiz «Ausarbeitung Schritt 2» Abschnitt E3, D, F;
// R-4.8-01 bis -07, R-4.4-14, R-4.9-11, R-10-42; B-Kp-85 bis -91). Rein (R-L-02).

import type { GridLayout } from '../grid';
import { agendaFlow, agendaPart } from './agendaParts';
import type { FlowLayout, PageContext } from './types';

/** parts[0] = Termine der Wochenseite, weitere Teile je Fortsetzungsseite; Ereignisse im ersten Teil. */
export function layoutAgenda(ctx: PageContext, grid: GridLayout): FlowLayout {
  const flow = agendaFlow(ctx, grid);
  return {
    parts: flow.pages.map((_, i) => agendaPart(ctx, flow, i, i === 0)),
  };
}
