// @vitest-environment jsdom
// Paket E1-02e: keine Überlappung und kein abgeschnittener oder verdeckter Text an zufälligen Wochen mit
// Farbkennung (R-14.3-01, R-14.3-02; Vertrag E1-02e Notiz «Ausarbeitung Schritt 2» H4, H7, H8, J «Farbkennung
// (fc.assert in P)»). Fester Startwert 20261006, 20 Läufe; alle Seiten (Fortsetzungsseiten ohne Rasterteil).
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { farbWoche, PAGE_RUNS, PAGE_SEED } from '../../support/arbitraries/page';
import { textVerstoesse, ueberlappungen } from '../../support/page/analyse';
import { farbSeite } from '../../support/page/farbseite';

// includeErrorInReport auch im Suite-Lauf (ohne vitest-setup.ts der WAP-Konfiguration): Ursache im Bericht.
const OPT = { seed: PAGE_SEED, numRuns: PAGE_RUNS, includeErrorInReport: true } as const;

describe('Zufällige Wochen mit Farbkennung im PDF (R-14.3-01, R-14.3-02)', () => {
  // F-FLAKY (FL-01): keine Zeitanforderung; 20 Läufe mit PDF erzeugen und auslesen, ruhig rund 1 s, in der eigenen
  // Suite (4 Worker, ohne Fremdlast) bis 5,1 s gemessen – Zeitlimit als Schutz vor Hängern statt der Vitest-Vorgabe 5 s.
  it('[R-14.3-01] keine zwei Kästchen, keine zwei Blockflächen und keine zwei Textumrisse überlappen, auf allen Seiten', async () => {
    await fc.assert(
      fc.asyncProperty(farbWoche(), async (w) => {
        const { info, an } = await farbSeite('ueberlappung', w.plan);
        const v: string[] = [];
        for (let p = 1; p <= info.pages.length; p++)
          v.push(...ueberlappungen(info, p === 1 ? an : null, p));
        expect(v).toEqual([]);
      }),
      OPT,
    );
  }, 120_000);

  // F-FLAKY (FL-01): keine Zeitanforderung; 20 Läufe mit PDF erzeugen und auslesen, ruhig rund 1 s, in der eigenen
  // Suite (4 Worker, ohne Fremdlast) bis 5,1 s gemessen – Zeitlimit als Schutz vor Hängern statt der Vitest-Vorgabe 5 s.
  it('[R-14.3-02] (a) Eintragstexte in ihrer Fläche, (b) jeder Text in genau einem Bereich, (c) nichts später Gezeichnetes überdeckt einen Text, auf allen Seiten', async () => {
    await fc.assert(
      fc.asyncProperty(farbWoche(), async (w) => {
        const { info, an } = await farbSeite('text', w.plan);
        const v: string[] = [];
        for (let p = 1; p <= info.pages.length; p++)
          v.push(...textVerstoesse(info, p === 1 ? an : null, p));
        expect(v).toEqual([]);
      }),
      OPT,
    );
  }, 120_000);
});
