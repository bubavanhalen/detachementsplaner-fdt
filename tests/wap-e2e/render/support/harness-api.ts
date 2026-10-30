// Schnittstelle der Harness-Seite tests/wap-e2e/harness/page-view.{html,tsx} (Paket E1-02c; Vertrag E1-02c
// P-14, Änderungsnotiz Vertragsprüfung V14): zeigt ein Seitenmodell mit PageView, erzeugt ein PDF mit writePdf
// im Browser und ruft ensureScreenFont auf. Nur Typen; die Harness hängt sich selbst in #root ein und stellt
// window.wapHarness bereit.
import type { SeiteJson } from '../../../wap/pdf/writer/support/seite-json';

export interface ZeigeOptionen {
  readonly scale: number;
  readonly label: string;
  /** Zeigt als Overlay eine Schaltfläche «Prüfmarke» (nur Bildschirm, R-5-03). */
  readonly overlay?: boolean;
  readonly semanticsProvidedByOverlay?: boolean;
}

/** Ergebnis eines Aufrufs, der ablehnen kann (Fehler ohne Inhalte des Plans). */
export type Ergebnis<T> =
  | ({ readonly ok: true } & T)
  | {
      readonly ok: false;
      readonly name: string;
      readonly code: string | null;
      readonly message: string;
      readonly istFontLoadError: boolean;
      readonly istPdfWriteError: boolean;
    };

export interface HarnessApi {
  /** Rendert (bzw. ersetzt) die Seite in #root. */
  zeige(seite: SeiteJson, opts: ZeigeOptionen): void;
  /** writePdf im Browser; Bytes als Base64. */
  pdf(seiten: readonly SeiteJson[], title: string): Promise<Ergebnis<{ readonly base64: string }>>;
  /** ensureScreenFont zweimal nacheinander. */
  schrift(): Promise<readonly [Ergebnis<object>, Ergebnis<object>]>;
}

declare global {
  interface Window {
    wapHarness?: HarnessApi;
  }
}
