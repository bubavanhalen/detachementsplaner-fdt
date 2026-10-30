// Seitenleiste mit Fortsetzung (Vertrag E1-02e, Notiz «Ausarbeitung Schritt 2» Abschnitt E4, D, F;
// R-10-21 bis -26, R-4.2-06, R-4.6-31, R-4.7-05, -15, R-4.9-09, R-15-04, R-15-08, R-4.1-07;
// B-Kp-72 bis -84). Rein (R-L-02).

import { sidebarFlow } from './sidebarParts';
import type { FlowLayout, PageContext } from './types';

/** parts[0] = Seitenleiste der Wochenseite, weitere Teile je Fortsetzungsseite; Ereignisse im ersten Teil. */
export function layoutSidebar(ctx: PageContext): FlowLayout {
  return { parts: sidebarFlow(ctx).parts };
}
