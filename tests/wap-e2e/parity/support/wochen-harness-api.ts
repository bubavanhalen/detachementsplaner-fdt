// Schnittstelle der Harness-Seite tests/wap-e2e/harness/week.{html,tsx} (Paket E1-02f; Vertrag E1-02f, Notiz
// «Ausarbeitung Schritt 2» Abschnitt E; T-6: eigener Name wapWochenHarness, die Deklaration von E1-02c bleibt
// unverändert). Nur Typen; die Harness hängt sich selbst in #root ein und stellt window.wapWochenHarness bereit.
// Pläne kommen als JSON aus dem Node-Test (nur fiktive oder pseudonymisierte Daten).
import type { Ergebnis } from '../../render/support/harness-api';

export type { Ergebnis };

export interface WochenOptionen {
  readonly paper?: 'A4' | 'A3';
  readonly showStatus?: boolean;
  readonly standOverride?: { readonly date: string; readonly version: number };
}

export interface PdfErgebnis {
  readonly base64: string;
  readonly pageCount: number;
  readonly fallbacks: number;
}

export interface EbenenMessung {
  readonly name: string;
  readonly svg: number;
  readonly zeilen: number;
  readonly knoten: number;
}

export interface WochenHarnessApi {
  /** Plan als JSON (im Node-Test gebaut, nur fiktive oder pseudonymisierte Daten); ersetzt den vorherigen. */
  setzePlan(plan: unknown): void;
  /** Rendert WeekPageView in #root hinter einer Fehlergrenze; Fehler beim Rendern → ok false mit code. */
  zeigeWoche(
    o: WochenOptionen & {
      readonly weekId: string;
      readonly scale: number;
      readonly overlay?: boolean;
      readonly semanticsProvidedByOverlay?: boolean;
    },
  ): Promise<Ergebnis<object>>;
  pdfWoche(
    o: WochenOptionen & { readonly weekId: string; readonly title: string },
  ): Promise<Ergebnis<PdfErgebnis>>;
  pdfPlan(o: WochenOptionen & { readonly title: string }): Promise<Ergebnis<PdfErgebnis>>;
  /** Messung CR-E102c-03 (H4): je Seite Name, Zahl der svg, der Zeilen und aller Elemente des Containers. */
  ebenen(): readonly EbenenMessung[];
}

declare global {
  interface Window {
    wapWochenHarness?: WochenHarnessApi;
  }
}
