// @vitest-environment node
// F-IMPORT2 (Q-043, Auftraggeber 19.10.2026): Zeilen vom Typ «Bericht» in einer Soll-Liste sind erwartete
// Berichtseinträge (ganz verdeckte Formen) und keine Soll-Einheiten; sie senken weder die Quote noch zählen sie
// als Einheit (normalisierung.md Abschnitt 3 und Änderungsnotiz 19.10.2026; R-14.1-01, R-8.2-43). Fiktive Daten.
import { describe, expect, it } from 'vitest';
import { compareWithAnhang, matchUnits } from '../../support/anhang-compare/compare';

const HEAD = 'Woche;Tag;Typ;Titel;Zeitform;von;bis;Spalten;Kategorie;Ltg;Ort;Nr;Status;Bemerkung';
const IST = [
  HEAD,
  'Wo1;Mo;Block;Ausbildung;von-bis;0800;1000;alle;Leitung Kp;;;;bestätigt;',
  'Wo1;Mo;Block;Schiessen;von-bis;1300;1500;Alpha;Leitung Zfhr;;;;bestätigt;',
].join('\n');
const SOLL = [
  HEAD,
  'Wo1;Mo;Block;Ausbildung;von-bis;0800;1000;alle;Leitung Kp;;;;bestätigt;',
  'Wo1;Mo;Block;Schiessen;von-bis;1300;1500;Alpha;Leitung Zfhr;;;;bestätigt;',
  'Wo1;Mo;Bericht;Verdeckter Block;von-bis;1300;1400;Alpha;Leitung Zfhr;;;;bestätigt;Bericht: verdeckt / Form: Block',
].join('\n');

describe('Vergleich mit Anhang A: Zeilen vom Typ «Bericht»', () => {
  it('[R-14.1-01] eine Zeile «Bericht» ist keine Soll-Einheit: Quote 2/2, keine Abweichung', () => {
    const r = compareWithAnhang(IST, SOLL);
    expect(r.total).toBe(2);
    expect(r.correct).toBe(2);
    expect(r.quote).toBe(1);
    expect(r.diffs).toEqual([]);
    expect(r.byWeekType['Wo1|Bericht']).toBeUndefined();
  });

  it('[R-8.2-43] die Zuordnung Soll ↔ Ist führt keine Zeile «Bericht»', () => {
    const pairs = matchUnits(IST, SOLL);
    expect(pairs).toHaveLength(2);
    expect(pairs.every((p) => p.soll.every((s) => s.Typ === 'Block'))).toBe(true);
  });

  it('[R-8.2-43] eine Ist-Zeile vom Typ «Bericht» ist auch keine überzählige Einheit', () => {
    const r = compareWithAnhang(SOLL, SOLL);
    expect(r.extra).toBe(0);
    expect(r.exact).toBe(2);
  });
});
