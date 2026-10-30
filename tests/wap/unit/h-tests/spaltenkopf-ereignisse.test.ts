// @vitest-environment jsdom
// H-TESTS (Härtung, TR-H-17): Ereignisse der Spaltenköpfe ausdrücklich als ganze Menge, mit Spalte (columnId) und
// Spaltensatz (Vertrag E1-02e E6 «Ereignisfelder», V13; E1-02l R1 «tooManyColumns je Tag mit columnSetId»; nach
// TE-E102l-01 war die Prüfung von columnId und der Ereignismenge weggefallen). Pseudonymisierte KVK-Fixture, fiktive
// Spaltennamen.
import { describe, expect, it } from 'vitest';
import type { PageFallbackEvent } from '../../../../src/model/wap/layout/page/types';
import type { Id, IsoDate, Plan } from '../../../../src/model/wap/types';
import { seite } from '../../support/page/seite';
import { KVK_TAGE, KVK_WOCHE, kvk } from '../../support/page/varianten';

function mitKopf(setId: string, colId: string, name: string, senkrecht: boolean): Plan {
  const p = kvk();
  return {
    ...p,
    columnSets: p.columnSets.map((s) =>
      s.id === setId
        ? {
            ...s,
            columns: s.columns.map((c) =>
              c.id === colId
                ? { ...c, name, ...(senkrecht ? { labelOrientation: 'vertical' as const } : {}) }
                : c,
            ),
          }
        : s,
    ),
  };
}

const kopf = (plan: Plan): readonly PageFallbackEvent[] =>
  seite(plan, KVK_WOCHE).fallbacks.filter((e) => e.region === 'gridHead');

function erwartet(date: IsoDate, columnId: Id, columnSetId: Id): PageFallbackEvent {
  return {
    kind: 'tooManyColumns',
    region: 'gridHead',
    weekId: KVK_WOCHE,
    date,
    entryId: null,
    piece: null,
    dropped: [],
    field: 'columnHead',
    columnId,
    columnSetId,
  };
}

describe('H-TESTS Ereignismenge der Spaltenköpfe', () => {
  it('[R-10-39][R-10-54] waagrechter Kopf «Ausbildungsverantwortlichkeitsbereich» in c9 (Satz s7, Mo–Di): genau zwei Ereignisse tooManyColumns mit columnId c9 und columnSetId s7, sonst keine', () => {
    expect(kopf(mitKopf('s7', 'c9', 'Ausbildungsverantwortlichkeitsbereich', false))).toEqual([
      erwartet(KVK_TAGE[0] as IsoDate, 'c9', 's7'),
      erwartet(KVK_TAGE[1] as IsoDate, 'c9', 's7'),
    ]);
  });

  it('[R-10-39][R-10-54] senkrechter Kopf mit Wortgrenzen in c17 (Satz s16): umbrochen vollständig, Ereignismenge leer', () => {
    expect(kopf(mitKopf('s16', 'c17', 'Kommandoposten und Übermittlung im Gebirge', true))).toEqual(
      [],
    );
  });

  it('[R-10-39][R-10-54] senkrechter Kopf ohne Wortgrenze in c17 (Satz s16, Mi–Fr): genau drei Ereignisse mit columnId c17 und columnSetId s16', () => {
    expect(
      kopf(
        mitKopf(
          's16',
          'c17',
          // F-LAYOUT2 Punkt 11 (Entscheid 19.10.2026 «11: ja»): die Kopfzeile wächst, bis ein Kopf in seine Spalte
          // passt; das Wort ist so lang, dass es auch in der grössten Kopfhöhe nicht passt.
          'Kommandopostenundübermittlungsgebirgsabteilungsverantwortlicherstellvertreterinnenausbildung',
          true,
        ),
      ),
    ).toEqual([
      erwartet(KVK_TAGE[2] as IsoDate, 'c17', 's16'),
      erwartet(KVK_TAGE[3] as IsoDate, 'c17', 's16'),
      erwartet(KVK_TAGE[4] as IsoDate, 'c17', 's16'),
    ]);
  });

  it('[R-10-39][R-10-54] unveränderte KVK-Fixture: keine Ereignisse der Spaltenköpfe', () => {
    expect(kopf(kvk())).toEqual([]);
  });
});
