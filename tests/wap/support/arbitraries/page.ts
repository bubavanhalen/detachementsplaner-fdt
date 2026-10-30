// Arbitraries der Seitentests mit Farbkennung (Paket E1-02e, Vertrag E1-02e Notiz «Ausarbeitung Schritt 2» H4).
// Grundlage ist `zufallsWoche` (E1-02d). Jeder Rastereintrag (Block, Rapport, Beso, Querbalken) erhält eine eigene
// Legendenkategorie mit eigener Farbe: paarweise verschieden, nicht Weiss und nicht die Farbe von B-Kp-93
// (#FFFF99, Ltg Kp). Die Kategorie «Ltg Kp» verwenden nur die Markerfelder. So bestimmt die Füllfarbe im PDF den
// Eintrag. Dazu zufällige fiktive Wochenziele, Bemerkungen und Bereitschaftstexte. Fester Startwert.
import fc from 'fast-check';
import type {
  Entry,
  Id,
  LtgCategory,
  MultiDayRemark,
  Plan,
  Rgb,
  WeekGoal,
} from '../../../../src/model/wap/types';
import { kpLegend, multiDayRemark } from '../model/builders';
import { type ZufallsRaster, zufallsWoche } from './grid';

/** Fester Startwert aller Eigenschaftstests der Seite (Vertrag H4). */
export const PAGE_SEED = 20261006;
/** Läufe je Eigenschaft (Vertrag H4: mindestens 20). */
export const PAGE_RUNS = 20;
/** Höchstens so viele Rastereinträge je Woche. */
export const PAGE_MAX_EINTRAEGE = 24;

/** Unterscheidbare Farbe Nr. i (fiktiv): nicht Weiss, nicht #FFFF99, paarweise verschieden für i < 200. */
export function kennfarbe(i: number): Rgb {
  return { r: 20 + i, g: 90 + ((i * 37) % 120), b: 60 + ((i * 53) % 150) };
}

const ZIELE = [
  'Ausbildungsziele des Zuges erreichen',
  'Fahrzeuge vollständig übernehmen',
  'Sicherheit im Umgang mit der Waffe',
  'Kader auf die Verschiebung vorbereiten',
  'Material am Freitag zurückgeben und quittieren lassen',
];

const BEMERKUNGEN = [
  'Sport 4h pro Woche.',
  'Urlaubsgesuche bis Mittwoch einreichen.',
  'Mittagessen im Ukft.',
  'Ruhezeiten einhalten; Nachtruhe ab 2200.',
  'Fahrzeugkontrolle täglich vor dem Einsatz durchführen und im Fahrtenbuch eintragen.',
  'Ausgang nach Dienstschluss.',
];

const BEREITSCHAFT = ['', '', 'Zug 2 in Bereitschaft', 'Pikett Fahrer 1 und 2'];

export interface FarbWoche {
  readonly plan: Plan;
  readonly raster: ZufallsRaster;
  /** Farbe je Rastereintrag (Block, Rapport, Beso, Querbalken). */
  readonly farbe: ReadonlyMap<Id, Rgb>;
}

function mitKategorie(e: Entry, k: Id): Entry {
  switch (e.type) {
    case 'block':
    case 'rapport':
    case 'beso':
    case 'querbalken':
      return { ...e, categoryId: k };
    default:
      return e;
  }
}

/** Zufällige Woche w26 mit Farbkennung, Zielen, Bemerkungen und Bereitschaft. */
export function farbWoche(maxEintraege = PAGE_MAX_EINTRAEGE): fc.Arbitrary<FarbWoche> {
  return fc
    .record({
      woche: zufallsWoche(maxEintraege),
      ziele: fc.subarray(ZIELE),
      bemerkungen: fc.array(
        fc.record({
          text: fc.constantFrom(...BEMERKUNGEN),
          nummer: fc.option(fc.integer({ min: 1, max: 9 })),
        }),
        { maxLength: 5 },
      ),
      bereitschaft: fc.constantFrom(...BEREITSCHAFT),
    })
    .map(({ woche, ziele, bemerkungen, bereitschaft }) => {
      const basis = kpLegend();
      const farbe = new Map<Id, Rgb>();
      const legende: LtgCategory[] = [...basis];
      const entries: Record<Id, Entry> = {};
      let i = 0;
      for (const e of Object.values(woche.plan.entries)) {
        if (e.type === 'marker') {
          entries[e.id] = e;
          continue;
        }
        const k = `kf${i}`;
        const c = kennfarbe(i);
        legende.push({
          id: k,
          name: `Kennung ${i}`,
          legendLabel: `Kennung ${i}`,
          color: c,
          neutral: false,
          inLegend: i % 3 === 0,
        });
        farbe.set(e.id, c);
        entries[e.id] = mitKategorie(e, k);
        i++;
      }
      const remarks: MultiDayRemark[] = bemerkungen.map((b, j) =>
        multiDayRemark(`e${800 + j}`, 800 + j, {
          text: b.text,
          number: b.nummer,
          scope: { kind: 'week', weekId: 'w26' },
        }),
      );
      for (const r of remarks) entries[r.id] = r;
      const goals: WeekGoal[] = ziele.map((t, j) => ({ id: `g${700 + j}`, text: t, group: null }));
      const plan: Plan = {
        ...woche.plan,
        legend: legende,
        entries,
        weeks: woche.plan.weeks.map((w) =>
          w.id === 'w26' ? { ...w, weekGoals: goals, heightenedReadiness: bereitschaft } : w,
        ),
      };
      return { plan, raster: woche.raster, farbe };
    });
}
