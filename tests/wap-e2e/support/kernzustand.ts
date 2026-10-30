// Typ der Registry-Einträge für die Bildschirm-Regression der Kernzustände (Paket E1-01c, R-H-21).
// Vertrag: docs/wap-planer/plan/vertraege/E1-01c.md §2 «Kernzustände» (Grundlage E1-17 §1, E1-01 §9 Nr 12).
// Jedes Oberflächenpaket legt tests/wap-e2e/support/kernzustaende/<paket>.ts an und exportiert
// `kernzustaende: readonly Kernzustand[]`. Nur Typen, kein Verhalten.
import type { Page } from '@playwright/test';

export interface Kernzustand {
  /** Dateiname-tauglich, beginnt mit dem Dateinamen der Registry plus «-», z.B. «e1-11-erststart». */
  readonly id: string;
  /** Paket in der Schreibweise des Plans, z.B. «E1-11»; gleich dem Dateinamen ohne Beachtung von Gross/Klein. */
  readonly paket: string;
  /** Kurzbeschreibung des Zustands (nicht leer). */
  readonly beschreibung: string;
  /** Feste Uhrzeit mit Zone (ISO 8601, z.B. «2026-09-28T08:00:00+02:00»); ohne Angabe gilt die Vorgabe der Spezifikation. */
  readonly uhr?: string;
  /** Stellt den Zustand auf der übergebenen Seite her (Navigation, Eingaben); endet erst im fertigen Zustand. */
  herstellen(page: Page): Promise<void>;
}
