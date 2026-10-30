// @vitest-environment node
// F-ABDECKUNG (FT-A-01): Prüfregeln P1, P8, P16, P17 in den Grenz- und Fehlerfällen (Beschrieb 7, 14.7; Vertrag
// E1-06; UI-Richtlinie 12): Meldungstexte je Rückfallart mit Ursache und nächstem Schritt, Spaltenwahl je
// Eintragstyp, Quittierung mit Datum und Grund, Reihenfolge, Zwischenspeicher, Wochen ausserhalb des Plans.
// Das Layout kommt als Parameter (CheckInput.layoutFor); für die Meldungen genügen seine Rückfallereignisse.
// Fiktive Daten.
import { describe, expect, it } from 'vitest';
import {
  acknowledgeFinding,
  acknowledgementText,
  countBySeverity,
  createCheckRunner,
  type Finding,
  runChecks,
  unacknowledgeFinding,
  weekIdOfDate,
} from '../../../../src/model/wap/checks';
import { setDayColumnSet, setDayDisplay } from '../../../../src/model/wap/commands/days';
import type { DroppedLine } from '../../../../src/model/wap/layout/grid/types';
import type {
  PageFallbackEvent,
  WeekPageLayout,
} from '../../../../src/model/wap/layout/page/types';
import type { Entry, Id, Plan } from '../../../../src/model/wap/types';
import { add, besos, block, CTX, column, kpPlan, MO } from '../../support/i5/plan';

const DI = '2026-09-29';
const MI = '2026-09-30';

const wk = (plan: Plan, i = 0): Id => plan.weeks[i]?.id ?? '';

/** Layout mit genau diesen Rückfallereignissen (P8 wertet nur die Ereignisse aus, Vertrag E1-06 Abschnitt 2). */
const layoutWith =
  (events: readonly PageFallbackEvent[]) =>
  (_: Id): WeekPageLayout =>
    ({ fallbacks: events }) as unknown as WeekPageLayout;
const keinP8 = layoutWith([]);

function ereignis(plan: Plan, over: Partial<PageFallbackEvent>): PageFallbackEvent {
  return {
    kind: 'ellipsis',
    region: 'block',
    weekId: wk(plan),
    date: MO,
    entryId: null,
    piece: null,
    dropped: [],
    field: null,
    columnId: null,
    ...over,
  };
}

const p8 = (plan: Plan, events: readonly PageFallbackEvent[]): readonly Finding[] =>
  runChecks({ plan, layoutFor: layoutWith(events) }).filter((f) => f.rule === 'P8');
const only = (fs: readonly Finding[]): Finding => {
  expect(fs).toHaveLength(1);
  const f = fs[0];
  if (f === undefined) throw new Error('Befund fehlt');
  return f;
};
const rules = (plan: Plan, rule: string) =>
  runChecks({ plan, layoutFor: keinP8 }).filter((f) => f.rule === rule);

/** Spaltensatz «KVK Mi–Fr» am Montag (Spalten der ersten Woche fehlen dann). */
function otherSetOnMonday(plan: Plan): Plan {
  const set = plan.columnSets[1];
  if (set === undefined) throw new Error('Spaltensatz fehlt');
  return setDayColumnSet(plan, wk(plan), ['Mo'], set.id, CTX).plan;
}

/** Eintrag direkt ersetzen (Zustand, wie er aus einer Plan-Datei kommen kann). */
function replaced(plan: Plan, e: Entry): Plan {
  return { ...plan, entries: { ...plan.entries, [e.id]: e } };
}
function entryOf(plan: Plan, id: Id): Entry {
  const e = plan.entries[id];
  if (e === undefined) throw new Error('Eintrag fehlt');
  return e;
}

describe('F-ABDECKUNG P8: Meldung je Rückfallart (UI-Richtlinie 12 «P8»)', () => {
  it('[R-7-11][R-10-43] Zeilen entfallen: Meldung nennt die entfallenen Zeilen des Blocks und die Mindestgrösse', () => {
    const { plan, id } = block(kpPlan(1), 'Ausb Mö');
    const f = only(
      p8(plan, [ereignis(plan, { kind: 'lineDropped', entryId: id, dropped: ['tn', 'ort'] })]),
    );
    expect(f).toMatchObject({ severity: 'error', entryId: id, region: 'block', title: 'Ausb Mö' });
    expect(f.message.cause).toBe(
      'Text von «Ausb Mö» passt auch mit 4,5 pt nicht. Im PDF entfallen Tn, Ort.',
    );
    expect(f.message.nextStep).toBe('Titel kürzen, Block vergrössern oder Zusatzzeilen entfernen.');
    expect(f.place).toBe('Mo 28.09.2026 0800');
  });

  it('[R-7-11][R-10-48] Teilaufgaben gekürzt: Leerzeilen, Ort und Ltg mit Anzahl (Einzahl und Mehrzahl)', () => {
    const { plan, id } = block(kpPlan(1), 'Ausb');
    const dropped: DroppedLine[] = ['subtaskGap', 'subtaskOrt', 'subtaskLtg', 'subtaskLtg'];
    const f = only(p8(plan, [ereignis(plan, { kind: 'lineDropped', entryId: id, dropped })]));
    expect(f.message.cause).toBe(
      'Text von «Ausb» passt auch mit 4,5 pt nicht. Teilaufgabe gekürzt. Im PDF entfallen Leerzeilen vor Teilaufgaben, Ort von 1 Teilaufgabe, Ltg von 2 Teilaufgaben.',
    );
  });

  it('[R-7-11][R-10-48] Teilaufgabe ganz entfallen: Hinweis «Teilaufgabe entfallen» und Anzahl ganz', () => {
    const { plan, id } = block(kpPlan(1), 'Ausb');
    const f = only(
      p8(plan, [
        ereignis(plan, {
          kind: 'lineDropped',
          entryId: id,
          dropped: ['subtaskTitle', 'subtaskTitle'],
        }),
      ]),
    );
    expect(f.message.cause).toBe(
      'Text von «Ausb» passt auch mit 4,5 pt nicht. Teilaufgabe entfallen. Im PDF entfallen 2 Teilaufgaben ganz.',
    );
  });

  it('[R-7-11] Grenzfall: Zeilen entfallen ohne Angabe welche → «Zusatzzeilen»', () => {
    const { plan, id } = block(kpPlan(1), 'Ausb');
    const f = only(p8(plan, [ereignis(plan, { kind: 'lineDropped', entryId: id })]));
    expect(f.message.cause).toBe(
      'Text von «Ausb» passt auch mit 4,5 pt nicht. Im PDF entfallen Zusatzzeilen.',
    );
  });

  it('[R-7-11] Text entfällt ganz: Ursache «keinen Platz» und nächster Schritt', () => {
    const { plan, id } = block(kpPlan(1), 'Ausb');
    const f = only(p8(plan, [ereignis(plan, { kind: 'textOmitted', entryId: id })]));
    expect(f.message).toEqual({
      cause: 'Text von «Ausb» hat auch mit 4,5 pt keinen Platz und entfällt im PDF.',
      nextStep: 'Titel kürzen oder den Eintrag vergrössern.',
    });
  });

  it('[R-7-11] Mit «…» gekürzt, mit und ohne entfallene Teilaufgaben', () => {
    const { plan, id } = block(kpPlan(1), 'Ausb');
    const [a, b] = p8(plan, [
      ereignis(plan, { kind: 'ellipsis', entryId: id, piece: 0 }),
      ereignis(plan, { kind: 'ellipsis', entryId: id, piece: 1, dropped: ['subtaskTitle'] }),
    ]);
    expect(a?.message.cause).toBe(
      'Text von «Ausb» passt auch mit 4,5 pt nicht. Im PDF mit «…» gekürzt.',
    );
    expect(b?.message.cause).toBe(
      'Text von «Ausb» passt auch mit 4,5 pt nicht. Im PDF mit «…» gekürzt. Teilaufgaben entfallen.',
    );
  });

  it('[R-7-11][R-10-55] Nummer bzw. Kürzel neben dem Kästchen: Eintrag und Kürzelliste mit je eigenem Text', () => {
    const { plan, id } = block(kpPlan(1), 'Ausb');
    const neben = only(p8(plan, [ereignis(plan, { kind: 'labelOutside', entryId: id })]));
    expect(neben.message.cause).toBe(
      'Nummer bzw. Kürzel von «Ausb» passt auch mit 4,5 pt nicht ins Kästchen und steht im PDF daneben.',
    );
    const liste = only(
      p8(plan, [
        ereignis(plan, { kind: 'labelOutside', region: 'sidebar', date: null, text: 'KpKdtStv' }),
      ]),
    );
    expect(liste).toMatchObject({ title: 'Seitenleiste Kürzelliste', entryId: null, place: 'KVK' });
    expect(liste.message.cause).toBe(
      'Das Kürzel «KpKdtStv» der Kürzelliste von KVK passt auch mit 4,5 pt nicht in die Kürzelspalte; es steht im PDF vollständig und ragt in die Spalte der Bedeutung.',
    );
    const ohneText = only(
      p8(plan, [ereignis(plan, { kind: 'labelOutside', region: 'sidebar', date: null })]),
    );
    expect(ohneText.message.cause).toContain('Das Kürzel «» der Kürzelliste');
  });

  it('[R-7-11][R-4.6-62] Querbalken ohne gemeinsame Lage im Band: eigene Ursache, gleicher nächster Schritt', () => {
    const { plan, id } = add(kpPlan(1), {
      type: 'querbalken',
      fromDate: MO,
      toDate: DI,
      title: [{ text: 'Messe', bold: true }],
    });
    const f = only(
      p8(plan, [ereignis(plan, { kind: 'bandNoCommonLane', region: 'band', entryId: id })]),
    );
    expect(f.message).toEqual({
      cause:
        '«Messe» hat an seinen Tagen keine gemeinsame Lage im Band und wird auf dieser Seite nicht gezeichnet.',
      nextStep: 'Einen Querbalken auf andere Tage kürzen oder als Bemerkung erfassen.',
    });
    // Querbalken ohne Zeit: Ort nur mit Tag.
    expect(f.place).toBe('Mo 28.09.2026');
  });

  it('[R-7-11] Fortsetzungsseite der Termine: Einzahl/Mehrzahl «passen», Titel «Termine», Zusatzseite benannt', () => {
    const plan = kpPlan(1);
    const f = only(
      p8(plan, [ereignis(plan, { kind: 'continuationPage', region: 'agenda', date: null })]),
    );
    expect(f.title).toBe('Termine');
    expect(f.message.cause).toBe(
      'Die Termine von KVK passen auch mit 4,5 pt nicht auf die Seite. Das PDF erhält die Zusatzseite «Fortsetzung – KVK».',
    );
    expect(f.place).toBe('KVK');
  });

  it('[R-7-11] Text ohne Eintrag: Feld genannt; Spaltenkopf mit Name und Tag; ohne Feld «Ein Text»', () => {
    const plan = kpPlan(1);
    const c0 = column(plan, 0);
    const [kopf, ziel, ohne, kopfOhneTag] = p8(plan, [
      ereignis(plan, { field: 'columnHead', columnId: c0.id, region: 'gridHead' }),
      ereignis(plan, { field: 'goal', region: 'sidebar', date: null }),
      ereignis(plan, { field: null, region: 'header', date: null, piece: 3 }),
      ereignis(plan, { field: 'columnHead', columnId: 'c-weg', region: 'gridHead', date: null }),
    ]);
    const titel = [kopf, ziel, ohne, kopfOhneTag].map((f) => f?.title).sort();
    expect(titel).toEqual([
      'Ein Text',
      `Spaltenkopf «${c0.name}» am Mo 28.09.2026`,
      'Spaltenkopf «»',
      'Wochenziel in der Seitenleiste',
    ]);
    const z = p8(plan, [ereignis(plan, { field: 'goal', region: 'sidebar', date: null })])[0];
    expect(z?.message).toEqual({
      cause: 'Wochenziel in der Seitenleiste passt auch mit 4,5 pt nicht. Im PDF gekürzt.',
      nextStep: 'Text kürzen.',
    });
  });

  it('[R-7-11] Doppelte Ereignisse ergeben einen Befund; Mindestgrösse aus der Vorlage, Rückfall 4,5 pt ohne Vorlage', () => {
    const { plan, id } = block(kpPlan(1), 'Ausb');
    const e = ereignis(plan, { kind: 'textOmitted', entryId: id });
    expect(p8(plan, [e, e])).toHaveLength(1);
    const fremd: Plan = { ...plan, templateId: 'unbekannt' };
    expect(only(p8(fremd, [e])).message.cause).toContain('4,5 pt');
  });

  it('[R-7-11] Ereignis zu einem gelöschten Eintrag: kein Eintragsbezug, Feldtext statt Titel', () => {
    const plan = kpPlan(1);
    const f = only(
      p8(plan, [
        ereignis(plan, { kind: 'ellipsis', entryId: 'e-weg', field: 'remark', region: 'sidebar' }),
      ]),
    );
    expect(f).toMatchObject({
      entryId: null,
      title: 'Bemerkung in der Seitenleiste',
      sortMinute: null,
    });
  });

  it('[R-7-11] Eine Woche, deren Layout scheitert, liefert kein P8; die übrigen Regeln laufen weiter', () => {
    let { plan } = block(kpPlan(1), 'Ausb');
    plan = otherSetOnMonday(plan);
    const fs = runChecks({
      plan,
      layoutFor: () => {
        throw new Error('Anzeigebereich zu klein (fiktiv)');
      },
    });
    expect(fs.map((f) => f.rule)).toEqual(['P1']);
  });
});

describe('F-ABDECKUNG P1: Spalten je Eintragstyp (R-7-10)', () => {
  it('[R-7-10] P1 (positiv) Rapport, der auch in einer Spalte erscheint, die es am Tag nicht gibt', () => {
    const base = kpPlan(1);
    let { plan, id } = add(base, {
      type: 'rapport',
      date: MO,
      code: 'KR',
      time: { form: 'point', at: 1080 },
      display: 'alsoInColumns',
      displayColumns: { kind: 'ids', ids: [column(base, 0).id] },
    });
    plan = otherSetOnMonday(plan);
    const f = rules(plan, 'P1');
    expect(f.map((x) => [x.entryId, x.title])).toEqual([[id, 'KR']]);
    expect(f[0]?.place).toBe('Mo 28.09.2026 1800');
  });

  it('[R-7-10] P1 (negativ) Rapport nur in der Rap-Spalte nach dem Wechsel des Spaltensatzes', () => {
    let { plan } = add(kpPlan(1), {
      type: 'rapport',
      date: MO,
      code: 'KR',
      time: { form: 'point', at: 1080 },
    });
    plan = otherSetOnMonday(plan);
    expect(rules(plan, 'P1')).toEqual([]);
  });

  it('[R-7-10] P1 mehrere fehlende Spalten in der Mehrzahl (Querbalken); Marker mit gespeicherten gelöschten Spalten → kein P1', () => {
    // Entscheid Auftraggeber 21.10.2026: Marker gelten immer über alle Planungsspalten; gespeicherte Einzelspalten
    // eines alten Plans wirken nicht und lösen deshalb kein P1 aus. Die Mehrzahl prüft ein Querbalken.
    const base = kpPlan(1);
    const ids = [column(base, 0).id, column(base, 1).id];
    const mk = add(base, {
      type: 'marker',
      date: MO,
      at: 1350,
      kind: 'ABV',
      columns: { kind: 'ids', ids },
    });
    let { plan, id } = add(mk.plan, {
      type: 'querbalken',
      fromDate: MO,
      toDate: MO,
      columns: { kind: 'ids', ids },
      title: [{ text: 'Messe', bold: true }],
    });
    plan = otherSetOnMonday(plan);
    const f = only(rules(plan, 'P1'));
    expect(f.entryId).toBe(id);
    expect(f.entryId).not.toBe(mk.id);
    expect(f.message.cause).toContain(
      `Spalten ${column(base, 0).name}, ${column(base, 1).name} fehlen im Spaltensatz vom Mo 28.09.2026`,
    );
  });

  it('[R-7-10] P1 Spalte, die es in keinem Spaltensatz mehr gibt: eigene Ursache', () => {
    const { plan, id } = block(kpPlan(1), 'Ausb');
    const e = entryOf(plan, id);
    if (e.type !== 'block') throw new Error('Block erwartet');
    const p = replaced(plan, { ...e, columns: { kind: 'ids', ids: ['c-geloescht'] } });
    expect(only(rules(p, 'P1')).message.cause).toBe(
      '«Ausb» liegt in einer Spalte, die es an diesem Tag nicht mehr gibt. Die Spalte gibt es in keinem Spaltensatz mehr.',
    );
  });

  it('[R-7-10] P1 Querbalken: ein Befund am ersten betroffenen Tag, auch wenn mehrere Tage die Spalte nicht haben', () => {
    const base = kpPlan(1);
    let { plan, id } = add(base, {
      type: 'querbalken',
      fromDate: MO,
      toDate: MI,
      columns: { kind: 'ids', ids: [column(base, 0).id] },
      title: [{ text: 'Messe', bold: true }],
    });
    plan = otherSetOnMonday(plan);
    plan = setDayColumnSet(plan, wk(plan), ['Di'], plan.columnSets[1]?.id ?? '', CTX).plan;
    const f = only(rules(plan, 'P1'));
    expect(f).toMatchObject({ entryId: id, date: MO });
  });

  it('[R-7-10] P1 (negativ) Grenzfall: Eintrag ausserhalb aller Wochen bzw. Tag ohne Spaltensatz → kein P1 ohne Woche', () => {
    const { plan, id } = block(kpPlan(1), 'Ausb');
    const e = entryOf(plan, id);
    if (e.type !== 'block') throw new Error('Block erwartet');
    expect(rules(replaced(plan, { ...e, date: '2027-01-04' }), 'P1')).toEqual([]);
    // Tag ohne Spaltensatz: jede Spalte fehlt → P1.
    const week = plan.weeks[0];
    if (week === undefined) throw new Error('Woche fehlt');
    const days = week.days.map((d, i) => (i === 0 ? { ...d, columnSetId: null } : d));
    const ohneSatz: Plan = {
      ...plan,
      weeks: [{ ...week, days: days as unknown as typeof week.days }],
    };
    expect(rules(ohneSatz, 'P1').map((f) => f.entryId)).toEqual([id]);
  });
});

describe('F-ABDECKUNG P16 und P17: Grenzfälle', () => {
  it('[R-7-12] P16 (negativ) Querbalken und mehrtägige Bemerkung an ausgeblendeten Tagen sind ausgenommen', () => {
    let p = kpPlan(1);
    p = add(p, {
      type: 'querbalken',
      fromDate: '2026-10-03',
      toDate: '2026-10-04',
      title: [{ text: 'Q', bold: false }],
    }).plan;
    p = add(p, { type: 'multiDayRemark', text: 'Gilt', scope: { kind: 'plan' } }).plan;
    p = setDayDisplay(p, wk(p), ['Sa', 'So'], 'hidden', CTX).plan;
    expect(rules(p, 'P16')).toEqual([]);
  });

  it('[R-7-12] P16 (positiv) Ganztägige Bemerkung am ausgeblendeten Sonntag: Ort ohne Zeit, Titel = Text', () => {
    let { plan, id } = add(kpPlan(1), { type: 'dayRemark', date: '2026-10-04', text: 'Urlaub' });
    plan = setDayDisplay(plan, wk(plan), ['So'], 'hidden', CTX).plan;
    const f = only(rules(plan, 'P16'));
    expect(f).toMatchObject({
      entryId: id,
      title: 'Urlaub',
      place: 'So 04.10.2026',
      sortMinute: null,
    });
    expect(f.message.cause).toBe(
      '«Urlaub» liegt am So 04.10.2026, der ausgeblendet ist. Im PDF erscheint der Eintrag nicht.',
    );
    expect(f.message.nextStep).toBe('Tag wieder einblenden oder den Eintrag verschieben.');
  });

  it('[R-7-13][F-64] P17 Beso ohne Nummer bei genau einer freien Nummer: Einzahl «1 Nummer frei ist»', () => {
    const { plan, ids } = besos(kpPlan(1), 10);
    const last = ids[9] ?? '';
    const e = entryOf(plan, last);
    if (e.type !== 'beso') throw new Error('Beso erwartet');
    const f = only(rules(replaced(plan, { ...e, besoNumber: null }), 'P17'));
    expect(f.message.cause).toBe(
      '«Visite 10» hat keine Nummer («–»), obwohl im Nummernkreis 10–19 am Mo 28.09.2026 noch 1 Nummer frei ist.',
    );
    expect(f.message.nextStep).toContain('Den Mo 28.09.2026 neu nummerieren');
  });

  it('[R-7-13][F-64] P17 Beso ohne Nummer bei mehreren freien Nummern: Mehrzahl', () => {
    const { plan, ids } = besos(kpPlan(1), 2);
    const e = entryOf(plan, ids[1] ?? '');
    if (e.type !== 'beso') throw new Error('Beso erwartet');
    const f = only(rules(replaced(plan, { ...e, besoNumber: null }), 'P17'));
    expect(f.message.cause).toContain('noch 9 Nummern frei sind.');
  });

  it('[R-7-13] P17 (negativ) Beso ohne Nummer ausserhalb aller Wochen ergibt keinen Befund', () => {
    const { plan, ids } = besos(kpPlan(1), 1);
    const e = entryOf(plan, ids[0] ?? '');
    if (e.type !== 'beso') throw new Error('Beso erwartet');
    expect(rules(replaced(plan, { ...e, besoNumber: null, date: '2027-01-04' }), 'P17')).toEqual(
      [],
    );
  });
});

describe('F-ABDECKUNG Befundliste: Titel, Ort, Reihenfolge', () => {
  it('[R-7-03] Kurztitel: über 40 Zeichen mit «…» gekürzt; leerer Titel «ohne Titel»', () => {
    let p = kpPlan(1);
    const lang = block(p, 'A'.repeat(41));
    p = lang.plan;
    const leer = block(p, '   ', { date: DI });
    p = setDayDisplay(leer.plan, wk(p), ['Mo', 'Di'], 'hidden', CTX).plan;
    const titles = new Map(rules(p, 'P16').map((f) => [f.entryId, f.title]));
    expect(titles.get(lang.id)).toBe(`${'A'.repeat(40)}…`);
    expect(titles.get(leer.id)).toBe('ohne Titel');
  });

  it('[R-7-03] Kurztitel Marker: Art bzw. freie Art; ungültige Zeit (beschädigter Plan) → nur die Art, ohne Uhrzeit im Ort', () => {
    let p = kpPlan(1);
    const m = add(p, {
      type: 'marker',
      date: MO,
      at: 1350,
      kind: 'custom',
      customKind: 'Appell',
      columns: { kind: 'all' },
    });
    p = setDayDisplay(m.plan, wk(p), ['Mo'], 'hidden', CTX).plan;
    expect(only(rules(p, 'P16')).title).toBe('Appell');
    const e = entryOf(p, m.id);
    if (e.type !== 'marker') throw new Error('Marker erwartet');
    const kaputt = only(rules(replaced(p, { ...e, at: 7 }), 'P16'));
    expect(kaputt.title).toBe('Appell');
    expect(kaputt.place).toBe('Mo 28.09.2026');
    const hv = only(rules(replaced(p, { ...e, kind: 'HV', at: 7 }), 'P16'));
    expect(hv.title).toBe('HV');
  });

  it('[R-7-03] Ort eines Beso: früheste Zeit seiner Zeitfenster; Rapport-Kürzel als Titel', () => {
    let p = kpPlan(1);
    const b = add(p, {
      type: 'beso',
      date: MO,
      title: [{ text: 'Visite', bold: false }],
      windows: [{ time: { form: 'point', at: 900 } }, { time: { form: 'point', at: 540 } }],
    });
    p = b.plan;
    const r = add(p, { type: 'rapport', date: MO, code: 'DR', time: { form: 'point', at: 1200 } });
    p = setDayDisplay(r.plan, wk(p), ['Mo'], 'hidden', CTX).plan;
    const fs = new Map(rules(p, 'P16').map((f) => [f.entryId, f]));
    expect(fs.get(b.id)?.place).toBe('Mo 28.09.2026 0900');
    expect(fs.get(r.id)).toMatchObject({ title: 'DR', place: 'Mo 28.09.2026 2000' });
    // Ohne Zeitfenster (beschädigter Plan): Ort ohne Zeit.
    const e = entryOf(p, b.id);
    if (e.type !== 'beso') throw new Error('Beso erwartet');
    const ohne = rules(replaced(p, { ...e, windows: [] }), 'P16').find((f) => f.entryId === b.id);
    expect(ohne?.place).toBe('Mo 28.09.2026');
  });

  it('[R-7-02] Reihenfolge: Woche, dann Stufe (Fehler zuerst), dann Datum und Zeit; P8 ohne Datum zuerst', () => {
    let p = kpPlan(2);
    const spaet = block(p, 'Spät', { time: { form: 'range', from: 900, to: 960 } });
    p = spaet.plan;
    const frueh = block(p, 'Früh', { time: { form: 'range', from: 420, to: 480 } });
    p = frueh.plan;
    const wo1 = block(p, 'Wo1', { date: '2026-10-05' });
    p = wo1.plan;
    p = setDayDisplay(p, wk(p, 0), ['Mo'], 'hidden', CTX).plan;
    p = setDayDisplay(p, wk(p, 1), ['Mo'], 'hidden', CTX).plan;
    const events = (w: Id) =>
      w === wk(p, 0)
        ? [ereignis(p, { kind: 'continuationPage', region: 'sidebar', date: null })]
        : [];
    const fs = runChecks({ plan: p, layoutFor: (w) => layoutWith(events(w))(w) });
    expect(fs.map((f) => `${f.rule}:${f.title}`)).toEqual([
      'P8:Seitenleiste',
      'P16:Früh',
      'P16:Spät',
      'P16:Wo1',
    ]);
    expect(countBySeverity(fs)).toEqual({ error: 4, warning: 0, hint: 0 });
  });

  it('[R-7-03] Sprung zur Stelle: Woche eines Datums; ausserhalb und ungültig → null', () => {
    const p = kpPlan(2);
    expect(weekIdOfDate(p, '2026-10-04')).toBe(wk(p, 0));
    expect(weekIdOfDate(p, '2026-10-05')).toBe(wk(p, 1));
    expect(weekIdOfDate(p, '2026-09-27')).toBeNull();
    expect(weekIdOfDate(p, '2026-10-19')).toBeNull();
    expect(weekIdOfDate(p, '28.09.2026')).toBeNull();
  });
});

describe('F-ABDECKUNG Quittieren (R-7-34; UI-Richtlinie 8.2)', () => {
  it('[R-7-34] Grund wird auf eine Zeile gekürzt (Leerraum zusammengefasst, höchstens 200 Zeichen); zweimal quittieren bleibt einmal', () => {
    let { plan } = block(kpPlan(1), 'Ausb');
    plan = otherSetOnMonday(plan);
    const f = only(rules(plan, 'P1'));
    const r1 = acknowledgeFinding(plan, f, `  bewusst\n so ${'x'.repeat(300)}`, '2026-10-06', CTX);
    expect(r1.label).toBe('Befund P1 «Ausb» quittiert');
    const ack = r1.plan.acknowledgedFindings;
    expect(ack).toHaveLength(1);
    expect(ack[0]?.reason).toHaveLength(200);
    expect(ack[0]?.reason.startsWith('bewusst so x')).toBe(true);
    const r2 = acknowledgeFinding(r1.plan, f, 'nochmals', '2026-10-07', CTX);
    expect(r2.plan.acknowledgedFindings).toEqual(ack);
    expect(r2.patches).toEqual([]);
  });

  it('[R-7-34] Fehlerpfad: ungültiges Datum der Quittierung → RangeError, Plan unverändert', () => {
    const { plan } = block(kpPlan(1), 'Ausb');
    const f = { key: 'P1|x', rule: 'P1' as const, title: 'Ausb' };
    expect(() => acknowledgeFinding(plan, f, '', '06.10.2026', CTX)).toThrow(RangeError);
    expect(plan.acknowledgedFindings).toEqual([]);
  });

  it('[R-7-34] Aufheben: nicht quittiert → unverändert; quittiert → Befund wieder offen', () => {
    let { plan } = block(kpPlan(1), 'Ausb');
    plan = otherSetOnMonday(plan);
    const f = only(rules(plan, 'P1'));
    const leer = unacknowledgeFinding(plan, f, CTX);
    expect(leer.plan).toBe(plan);
    const q = acknowledgeFinding(plan, f, '', '2026-10-06', CTX).plan;
    expect(only(rules(q, 'P1')).acknowledgement).toEqual({ at: '2026-10-06', reason: '' });
    const r = unacknowledgeFinding(q, f, CTX);
    expect(r.label).toBe('Quittierung von P1 «Ausb» aufgehoben');
    expect(only(rules(r.plan, 'P1')).acknowledged).toBe(false);
  });

  it('[R-7-34] Text der Liste «Quittiert»: mit und ohne Grund; ungültiges Datum erscheint unverändert', () => {
    expect(acknowledgementText({ at: '2026-10-06', reason: '' })).toBe('quittiert am 06.10.2026');
    expect(acknowledgementText({ at: '2026-10-06', reason: 'bewusst' })).toBe(
      'quittiert am 06.10.2026: bewusst',
    );
    expect(acknowledgementText({ at: 'gestern', reason: 'x' })).toBe('quittiert am gestern: x');
  });
});

describe('F-ABDECKUNG Prüflauf mit Zwischenspeicher (R-11-14, R-7-01)', () => {
  it('[R-7-01][R-11-14] Unveränderte Woche: Layout nicht neu berechnet; Änderung eines Eintrags der Woche → neu', () => {
    let { plan, id } = block(kpPlan(2), 'Ausb');
    const calls: Id[] = [];
    const layoutFor = (w: Id): WeekPageLayout => {
      calls.push(w);
      return layoutWith(
        w === wk(plan, 0) ? [ereignis(plan, { kind: 'textOmitted', entryId: id })] : [],
      )(w);
    };
    const run = createCheckRunner();
    expect(run({ plan, layoutFor }).map((f) => f.rule)).toEqual(['P8']);
    expect(calls).toEqual([wk(plan, 0), wk(plan, 1)]);
    calls.length = 0;
    expect(run({ plan, layoutFor }).map((f) => f.rule)).toEqual(['P8']);
    expect(calls).toEqual([]);
    // Querbalken über beide Wochen: beide Wochen neu.
    plan = add(plan, {
      type: 'querbalken',
      fromDate: '2026-10-03',
      toDate: '2026-10-06',
      title: [{ text: 'Q', bold: false }],
    }).plan;
    run({ plan, layoutFor });
    expect(calls).toEqual([wk(plan, 0), wk(plan, 1)]);
    calls.length = 0;
    // Eintrag am Sonntag der ersten Woche: auch die Folgewoche neu (Vortag wegen Mitternacht).
    plan = add(plan, { type: 'dayRemark', date: '2026-10-04', text: 'So' }).plan;
    run({ plan, layoutFor });
    expect(calls).toEqual([wk(plan, 0), wk(plan, 1)]);
    calls.length = 0;
    // Eintrag am Mittwoch der zweiten Woche: nur die zweite Woche neu.
    plan = add(plan, { type: 'dayRemark', date: '2026-10-07', text: 'Mi' }).plan;
    run({ plan, layoutFor });
    expect(calls).toEqual([wk(plan, 1)]);
  });

  it('[R-11-14] Gelöschte Woche fällt aus dem Zwischenspeicher; Woche mit ungültigem Start prüft alle Einträge', () => {
    const { plan } = block(kpPlan(2), 'Ausb');
    const calls: Id[] = [];
    const layoutFor = (w: Id): WeekPageLayout => {
      calls.push(w);
      return layoutWith([])(w);
    };
    const run = createCheckRunner();
    run({ plan, layoutFor });
    const ohneZweite: Plan = { ...plan, weeks: plan.weeks.slice(0, 1) };
    calls.length = 0;
    run({ plan: ohneZweite, layoutFor });
    // Erste Woche unverändert: aus dem Zwischenspeicher.
    expect(calls).toEqual([]);
    // Zweite Woche wieder da: neu berechnet, nicht aus dem gelöschten Speichereintrag.
    calls.length = 0;
    run({ plan, layoutFor });
    expect(calls).toEqual([wk(plan, 1)]);
    const w0 = plan.weeks[0];
    if (w0 === undefined) throw new Error('Woche fehlt');
    const kaputt: Plan = {
      ...plan,
      weeks: [{ ...w0, startDate: 'ungültig' }, ...plan.weeks.slice(1)],
    };
    calls.length = 0;
    expect(run({ plan: kaputt, layoutFor })).toEqual([]);
    expect(calls).toEqual([wk(plan, 0)]);
  });

  it('[R-11-14] Zwischenspeicher und voller Prüflauf liefern dieselben Befunde', () => {
    let { plan } = block(kpPlan(1), 'Ausb');
    plan = besos(plan, 11).plan;
    plan = otherSetOnMonday(plan);
    const voll = runChecks({ plan, layoutFor: keinP8 });
    const zw = createCheckRunner()({ plan, layoutFor: keinP8 });
    expect(zw).toEqual(voll);
    expect(voll.map((f) => f.rule).sort()).toEqual(['P1', 'P17']);
  });
});
