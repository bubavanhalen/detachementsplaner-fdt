// Setup-Datei von vitest.wap.config.ts (Paket E1-01, ADR-010 §4.1, §4.5).
// Die Suite-Hilfen aus tests/setup.ts (jest-dom, cleanup, Layout-Attrappen) setzen jsdom voraus. WAP-Tests
// nennen ihre Umgebung in der Kopfzeile (`// @vitest-environment node|jsdom`); in jsdom-Dateien gelten
// dieselben Hilfen wie im Suite-Lauf, in node-Dateien entfallen sie.
// Eigenschaftstests (Prompt §7, Nachtrag E1-01-25): fast-check bettet den ursprünglichen Fehler als «Got …»-Zeile
// in seinen Bericht ein, damit die Rot-Phase (F8, ADR-010 §3.3) Vertrags-Stub- und Assertion-Fehler erkennt.
// configureGlobal ersetzt die globale Einstellung vollständig; bestehende Werte bleiben deshalb erhalten.
// Tests rufen configureGlobal nur mit `{ ...fc.readConfigureGlobal(), … }` auf und überschreiben
// includeErrorInReport nie; sonst fehlt die «Got …»-Zeile und F8 meldet den Test als nicht fachlich rot
// (CR-E101-303).
import { configureGlobal, readConfigureGlobal } from 'fast-check';

configureGlobal({ ...readConfigureGlobal(), includeErrorInReport: true });

if (typeof HTMLElement !== 'undefined') {
  await import('../../../setup');
}
