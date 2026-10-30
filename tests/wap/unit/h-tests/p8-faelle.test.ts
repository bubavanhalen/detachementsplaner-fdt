// @vitest-environment node
// H-TESTS (Härtung, TR-H-05): Prüfregel P8 je Fall der Rückfallregel (Beschrieb 7 P8, 10 «Rückfallregel»; Vertrag
// E1-06 Abschnitt 2; E1-02l R1/R2; UI-Richtlinie 12 «P8»). Je Fall ein positiver und ein negativer Fall: jedes
// Rückfallereignis der Layout-Schicht dieser Art ergibt genau einen Befund P8 mit Ort, Ursache und nächstem Schritt.
// Fiktive Daten.
import { describe, expect, it } from 'vitest';
import { type Finding, runChecks } from '../../../../src/model/wap/checks';
import { layoutWeekPage } from '../../../../src/model/wap/layout/page/compose';
import type { PageFallbackEvent } from '../../../../src/model/wap/layout/page/types';
import type { Id, IsoDate, Plan, WeekGoal } from '../../../../src/model/wap/types';
import { kpPlan as stufenPlan } from '../../support/i3/plan';
import { pageOptions } from '../../support/i3/seite';
import { add, block, kpPlan, MO } from '../../support/i5/plan';

const DI: IsoDate = '2026-09-29';
const MI: IsoDate = '2026-09-30';

const wk = (plan: Plan): Id => plan.weeks[0]?.id ?? '';
const events = (plan: Plan): readonly PageFallbackEvent[] =>
  layoutWeekPage(plan, wk(plan), pageOptions()).fallbacks;
const p8 = (plan: Plan): readonly Finding[] =>
  runChecks({ plan, layoutFor: (w) => layoutWeekPage(plan, w, pageOptions()) }).filter(
    (f) => f.rule === 'P8',
  );
const ofKind = (plan: Plan, kind: PageFallbackEvent['kind']) =>
  events(plan).filter((e) => e.kind === kind);

/** Wochenziele der ersten Woche ersetzen (fiktive Texte). */
function withGoals(plan: Plan, goals: readonly WeekGoal[]): Plan {
  const [first, ...rest] = plan.weeks;
  if (first === undefined) throw new Error('Woche fehlt');
  return { ...plan, weeks: [{ ...first, weekGoals: goals }, ...rest] };
}

function longGoals(n: number): WeekGoal[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `g${String(i)}`,
    text: `Wochenziel ${String(i + 1)}: Ausbildung, Material und Wache im Raum Nord mit langem Beschrieb`,
    group: null,
  }));
}

/** Querbalken am Tag `from` bis `to` (fiktive Titel). */
function querbalken(plan: Plan, title: string, from: IsoDate, to: IsoDate) {
  return add(plan, {
    type: 'querbalken',
    fromDate: from,
    toDate: to,
    title: [{ text: title, bold: true }],
  });
}

describe('H-TESTS P8 je Fall der Rückfallregel', () => {
  it('[R-7-11][R-10-43] P8 (positiv) Seitenleiste: überlange Wochenziele → Fortsetzungsseite der Seitenleiste und genau ein Befund mit Ursache und nächstem Schritt', () => {
    const plan = withGoals(kpPlan(1), longGoals(30));
    const ev = events(plan).filter((e) => e.region === 'sidebar');
    expect(ev.map((e) => [e.kind, e.field])).toEqual([['continuationPage', 'goal']]);
    const f = p8(plan).filter((x) => x.region === 'sidebar');
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({
      rule: 'P8',
      severity: 'error',
      weekId: wk(plan),
      entryId: null,
      date: null,
      title: 'Seitenleiste',
      place: 'KVK',
    });
    expect(f[0]?.message.cause).toBe(
      'Die Seitenleiste von KVK passt auch mit 4,5 pt nicht auf die Seite. Das PDF erhält die Zusatzseite «Fortsetzung – KVK».',
    );
    expect(f[0]?.message.nextStep).toBe(
      'Texte kürzen oder Einträge auf andere Tage bzw. Wochen verteilen.',
    );
  });

  it('[R-7-11][R-10-43] P8 (positiv) Termine: übervoller Terminbereich → Befund «Termine» mit Ursache und nächstem Schritt', () => {
    let plan = kpPlan(1);
    for (let i = 0; i < 70; i++)
      plan = add(plan, {
        type: 'dayRemark',
        date: MO,
        text: `Bemerkung ${String(i)} mit etwas längerem Text für den Terminbereich`,
      }).plan;
    const f = p8(plan).filter((x) => x.region === 'agenda');
    expect(f.map((x) => [x.title, x.weekId])).toEqual([['Termine', wk(plan)]]);
    expect(f[0]?.message.cause).toBe(
      'Die Termine von KVK passen auch mit 4,5 pt nicht auf die Seite. Das PDF erhält die Zusatzseite «Fortsetzung – KVK».',
    );
  });

  it('[R-7-11] P8 (negativ) Seitenleiste: drei kurze Wochenziele → kein Ereignis, kein Befund', () => {
    const plan = withGoals(kpPlan(1), longGoals(30).slice(0, 3));
    expect(events(plan).filter((e) => e.region === 'sidebar')).toEqual([]);
    expect(p8(plan)).toEqual([]);
  });

  it('[R-7-11][R-10-54] P8 (positiv) zu viele Spalten: je Tag mit Ereignis tooManyColumns (mit Spaltensatz) genau ein Befund am Spaltensatz des Tages', () => {
    // «KVK Stufen» an allen Tagen: die Köpfe passen an keinem Tag (vgl. Testhilfe I5).
    const plan = stufenPlan(1);
    const set = plan.columnSets[0]?.id;
    const ev = ofKind(plan, 'tooManyColumns');
    expect(ev.length).toBe(7);
    for (const e of ev) expect(e).toMatchObject({ columnSetId: set, region: 'gridHead' });
    const f = p8(plan).filter((x) => x.region === 'gridHead');
    expect(f.map((x) => x.date)).toEqual(ev.map((e) => e.date));
    for (const x of f) {
      const day = x.place;
      expect(x).toMatchObject({ entryId: null, severity: 'error', title: `Spaltensatz ${day}` });
      expect(x.message.cause).toBe(
        `Zu viele Spalten für den ${day}: Nicht alle Spaltenköpfe passen auch mit 4,5 pt in ihre Spalte.`,
      );
      expect(x.message.nextStep).toBe(
        'Spalten schmaler stellen, zusammenfassen oder auf einen anderen Spaltensatz wechseln.',
      );
    }
    expect(f[0]?.place).toBe('Mo 28.09.2026');
  });

  it('[R-7-11][R-10-54] P8 (negativ) zu viele Spalten: Spaltensätze wie im KVK (Mo–Di Stufen, Mi–Fr, Wochenende kompakt) → kein Befund am Spaltensatz', () => {
    const plan = kpPlan(1);
    expect(ofKind(plan, 'tooManyColumns')).toEqual([]);
    expect(p8(plan).filter((x) => x.region === 'gridHead')).toEqual([]);
  });

  it('[R-7-11][R-10-55] P8 (positiv) Kürzel neben dem Kästchen: Rapport mit überlangem Kürzel → Befund am Eintrag (entryId) und Befund der Kürzelliste', () => {
    const { plan, id } = add(kpPlan(1), {
      type: 'rapport',
      date: MO,
      code: 'UOFRAPPORTLANG',
      time: { form: 'point', at: 600 },
    });
    const ev = ofKind(plan, 'labelOutside');
    expect(ev.map((e) => [e.region, e.entryId])).toEqual([
      ['block', id],
      ['sidebar', null],
    ]);
    const f = p8(plan);
    const atEntry = f.filter((x) => x.entryId === id);
    expect(atEntry).toHaveLength(1);
    expect(atEntry[0]).toMatchObject({
      region: 'block',
      date: MO,
      title: 'UOFRAPPORTLANG',
      place: 'Mo 28.09.2026 1000',
    });
    expect(atEntry[0]?.message.cause).toBe(
      'Nummer bzw. Kürzel von «UOFRAPPORTLANG» passt auch mit 4,5 pt nicht ins Kästchen und steht im PDF daneben.',
    );
    expect(atEntry[0]?.message.nextStep).toBe(
      'Das Kästchen verlängern oder Platz neben dem Kästchen freimachen.',
    );
    const list = f.filter((x) => x.region === 'sidebar');
    expect(list.map((x) => [x.entryId, x.title])).toEqual([[null, 'Seitenleiste Kürzelliste']]);
    expect(list[0]?.message.cause).toContain('Das Kürzel «UOFRAPPORTLANG» der Kürzelliste von KVK');
    expect(f).toHaveLength(2);
  });

  it('[R-7-11][R-10-55] P8 (negativ) Kürzel neben dem Kästchen: Rapport «DR» → kein Ereignis labelOutside, kein Befund', () => {
    const { plan } = add(kpPlan(1), {
      type: 'rapport',
      date: MO,
      code: 'DR',
      time: { form: 'point', at: 600 },
    });
    expect(ofKind(plan, 'labelOutside')).toEqual([]);
    expect(p8(plan)).toEqual([]);
  });

  it('[R-7-11][R-10-43] P8 (positiv) Zeile entfällt: Block 0800-0830 mit Ltg, Ort und Zusatz → Befund nennt die entfallenen Zeilen', () => {
    const { plan, id } = block(kpPlan(1), 'Ausb', {
      time: { form: 'range', from: 480, to: 510 },
      ltg: 'Zfhr Beispiel',
      ort: 'Halle Nord',
      supplement: 'Zusatz eins',
    });
    expect(ofKind(plan, 'lineDropped').map((e) => [e.entryId, e.dropped])).toEqual([
      [id, ['ltg', 'ort', 'supplement']],
    ]);
    const f = p8(plan);
    expect(f.map((x) => [x.entryId, x.region, x.title])).toEqual([[id, 'block', 'Ausb']]);
    expect(f[0]?.message.cause).toBe(
      'Text von «Ausb» passt auch mit 4,5 pt nicht. Im PDF entfallen Ltg, Ort, Zusatz.',
    );
    expect(f[0]?.message.nextStep).toBe(
      'Titel kürzen, Block vergrössern oder Zusatzzeilen entfernen.',
    );
  });

  it('[R-7-11] P8 (negativ) Zeile entfällt: derselbe Block 0800-1200 → alle Zeilen haben Platz, kein Befund', () => {
    const { plan } = block(kpPlan(1), 'Ausb', {
      time: { form: 'range', from: 480, to: 720 },
      ltg: 'Zfhr Beispiel',
      ort: 'Halle Nord',
      supplement: 'Zusatz eins',
    });
    expect(events(plan)).toEqual([]);
    expect(p8(plan)).toEqual([]);
  });

  it('[R-7-11][R-10-43] P8 (positiv) «…»: Titel in einem Block 0800-0830 passt auch gekürzt nur mit «…» → Befund «mit «…» gekürzt»', () => {
    const { plan, id } = block(kpPlan(1), 'Abcdefghij klmnop qrstuv', {
      time: { form: 'range', from: 480, to: 510 },
    });
    expect(ofKind(plan, 'ellipsis').map((e) => e.entryId)).toEqual([id]);
    const f = p8(plan);
    expect(f.map((x) => [x.entryId, x.region])).toEqual([[id, 'block']]);
    expect(f[0]?.message.cause).toMatch(
      /^Text von «.+» passt auch mit 4,5 pt nicht\. Im PDF mit «…» gekürzt\.$/,
    );
  });

  it('[R-7-11][R-10-43] P8 (positiv) Text entfällt: derselbe Titel in einer Viertelstunde → Befund «entfällt im PDF»', () => {
    const { plan, id } = block(kpPlan(1), 'Abcdefghij klmnop qrstuv', {
      time: { form: 'range', from: 480, to: 495 },
    });
    expect(ofKind(plan, 'textOmitted').map((e) => e.entryId)).toEqual([id]);
    const f = p8(plan);
    expect(f.map((x) => x.entryId)).toEqual([id]);
    expect(f[0]?.message.cause).toMatch(/hat auch mit 4,5 pt keinen Platz und entfällt im PDF\.$/);
    expect(f[0]?.message.nextStep).toBe('Titel kürzen oder den Eintrag vergrössern.');
  });

  it('[R-7-11] P8 (negativ) «…»: kurzer Titel im selben Block 0800-0830 über alle Spalten → kein Befund', () => {
    const { plan } = block(kpPlan(1), 'Abcdefghij klmnop qrstuv', {
      time: { form: 'range', from: 480, to: 510 },
      columns: { kind: 'all' },
    });
    expect(events(plan)).toEqual([]);
    expect(p8(plan)).toEqual([]);
  });

  it('[R-7-11][R-4.6-62] P8 (positiv) keine gemeinsame Lage im Band: Querbalken Di–Mi zwischen Lage 1 am Di und Lage 0 am Mi → ein Befund am ersten Tag', () => {
    let plan = kpPlan(1);
    plan = querbalken(plan, 'Alpha', MO, MO).plan; // Mo Lage 0
    plan = querbalken(plan, 'Bravo', MO, DI).plan; // Mo, Di Lage 1
    plan = querbalken(plan, 'Charlie', MI, MI).plan; // Mi Lage 0
    const r = querbalken(plan, 'Delta', DI, MI); // Di nur Lage 0 frei, Mi nur Lage 1 frei
    plan = r.plan;
    const ev = events(plan).filter((e) => e.region === 'band');
    expect(ev.map((e) => [e.kind, e.entryId, e.date])).toEqual([['bandNoCommonLane', r.id, DI]]);
    const f = p8(plan);
    expect(f.map((x) => [x.entryId, x.region, x.date, x.title])).toEqual([
      [r.id, 'band', DI, 'Delta'],
    ]);
    expect(f[0]?.message.cause).toBe(
      '«Delta» hat an seinen Tagen keine gemeinsame Lage im Band und wird auf dieser Seite nicht gezeichnet.',
    );
    expect(f[0]?.message.nextStep).toBe(
      'Einen Querbalken auf andere Tage kürzen oder als Bemerkung erfassen.',
    );
  });

  it('[R-7-11][R-4.6-62] P8 (negativ) keine gemeinsame Lage im Band: ohne «Charlie» am Mi ist Lage 0 an Di und Mi frei → kein Befund', () => {
    let plan = kpPlan(1);
    plan = querbalken(plan, 'Alpha', MO, MO).plan;
    plan = querbalken(plan, 'Bravo', MO, DI).plan;
    plan = querbalken(plan, 'Delta', DI, MI).plan;
    expect(events(plan).filter((e) => e.region === 'band')).toEqual([]);
    expect(p8(plan)).toEqual([]);
  });

  it('[R-7-11] P8 je Ereignis: gemischte Woche (Seitenleiste, Zeile entfällt, Kürzel, Band) → so viele Befunde wie Ereignisse, je mit Ursache und nächstem Schritt', () => {
    let plan = withGoals(kpPlan(1), longGoals(30));
    plan = block(plan, 'Ausb', {
      time: { form: 'range', from: 480, to: 510 },
      ltg: 'Zfhr Beispiel',
      ort: 'Halle Nord',
    }).plan;
    plan = add(plan, {
      type: 'rapport',
      date: DI,
      code: 'UOFRAPPORTLANG',
      time: { form: 'point', at: 600 },
    }).plan;
    plan = querbalken(plan, 'Alpha', MO, MO).plan;
    plan = querbalken(plan, 'Bravo', MO, DI).plan;
    plan = querbalken(plan, 'Charlie', MI, MI).plan;
    plan = querbalken(plan, 'Delta', DI, MI).plan;
    const ev = events(plan);
    expect(new Set(ev.map((e) => e.kind))).toEqual(
      new Set(['continuationPage', 'lineDropped', 'labelOutside', 'bandNoCommonLane']),
    );
    const f = p8(plan);
    expect(f).toHaveLength(ev.length);
    for (const x of f) {
      expect(x.message.cause.length).toBeGreaterThan(20);
      expect(x.message.nextStep.length).toBeGreaterThan(5);
    }
  });
});
