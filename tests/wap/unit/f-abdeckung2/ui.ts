// F-ABDECKUNG2: Testhilfen für Listenansicht, Seitenfeld und Plan-Einstellungen in jsdom: fiktiver Kp-Plan mit allen
// Eintragstypen und Zeitformen, Ersatz für <dialog> (jsdom kennt showModal nicht) und Befehlsausführung wie in der
// Route (Befehl auf den aktuellen Plan, Ergebnis wird der neue Plan). Nur erfundene Inhalte.

import type { CommandContext, CommandResult } from '../../../../src/model/wap/commands/command';
import { setDayDisplay } from '../../../../src/model/wap/commands/days';
import { updateEntry } from '../../../../src/model/wap/commands/entries';
import type { Entry, Id, Plan } from '../../../../src/model/wap/types';
import { add, CTX, column, kpPlan, MO } from '../../support/i5/plan';

export { CTX, column, MO };

export const DI = '2026-09-29';
export const MI = '2026-09-30';
export const MO2 = '2026-10-05';

/** jsdom: <dialog> ohne showModal/close; Ersatz setzt bzw. entfernt «open» und meldet «close». */
export function installDialog(): void {
  const proto = HTMLDialogElement.prototype as unknown as {
    showModal?: () => void;
    close?: () => void;
  };
  proto.showModal = function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  proto.close = function (this: HTMLDialogElement) {
    if (!this.hasAttribute('open')) return;
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
}

export interface Fixture {
  readonly plan: Plan;
  readonly ids: {
    readonly querbalken: Id;
    readonly marker: Id;
    readonly funk: Id;
    readonly kr: Id;
    readonly visite: Id;
    readonly tagBemerkung: Id;
    readonly vorbereitung: Id;
    readonly schiessen: Id;
    readonly frist: Id;
    readonly planBemerkung: Id;
    readonly wocheZwei: Id;
  };
}

/**
 * Zwei Wochen ab Mo 28.09.2026 (Mo–Di «KVK Stufen», Mi–Fr «KVK Mi–Fr», Sa–So kompakt). Woche 1: Querbalken Mo–Di,
 * Marker AV 2200, Block 0800-1000 mit zwei Teilaufgaben, Rapport KR 0700, Beso mit zwei Zeitfenstern (1400, 1500-1600),
 * ganztägige Bemerkung, Di Block «bis 1200» und «ab 1900», Mi Beso mit Frist, Plan-Bemerkung; Woche 2 ein Block.
 */
export function fixture(): Fixture {
  let plan = kpPlan(2);
  const kp = plan.legend[1]?.id as Id;
  const c0 = column(plan, 0).id;
  const c1 = column(plan, 1).id;
  const step = (draft: Parameters<typeof add>[1]): Id => {
    const r = add(plan, draft);
    plan = r.plan;
    return r.id;
  };
  const querbalken = step({
    type: 'querbalken',
    fromDate: MO,
    toDate: DI,
    title: [{ text: 'Übungsphase', bold: true }],
    columns: { kind: 'all' },
  });
  const marker = step({ type: 'marker', date: MO, at: 1320, kind: 'AV' });
  const funk = step({
    type: 'block',
    date: MO,
    time: { form: 'range', from: 480, to: 600 },
    columns: { kind: 'ids', ids: [c0, c1] },
    title: [{ text: 'Funk Ausbildung', bold: true }],
    ltg: 'Zfhr',
    ort: 'Halle',
    categoryId: kp,
    subtasks: [
      { title: [{ text: 'Funkgerät', bold: false }], ltg: 'Wm Probe', ort: 'Halle' },
      { title: [{ text: 'Lagebild', bold: false }], ltg: '', ort: '' },
    ],
  });
  const kr = step({ type: 'rapport', date: MO, code: 'KR', time: { form: 'point', at: 420 } });
  const visite = step({
    type: 'beso',
    date: MO,
    title: [{ text: 'Visite', bold: false }],
    ltg: 'Hptm Muster',
    windows: [
      { time: { form: 'point', at: 840 } },
      { time: { form: 'range', from: 900, to: 960 }, supplement: 'Teil zwei' },
    ],
  });
  const tagBemerkung = step({ type: 'dayRemark', date: MO, text: 'Materialfassung' });
  const vorbereitung = step({
    type: 'block',
    date: DI,
    time: { form: 'until', to: 720 },
    columns: { kind: 'ids', ids: [c0] },
    title: [{ text: 'Vorbereitung', bold: true }],
  });
  const schiessen = step({
    type: 'block',
    date: DI,
    time: { form: 'from', from: 1140 },
    columns: { kind: 'ids', ids: [c1] },
    title: [{ text: 'Schiessen', bold: true }],
  });
  const frist = step({
    type: 'beso',
    date: MI,
    title: [{ text: 'Meldung abgeben', bold: false }],
    windows: [{ time: { form: 'deadline' } }],
  });
  const planBemerkung = step({
    type: 'multiDayRemark',
    text: 'Gilt durchgehend',
    scope: { kind: 'plan' },
  });
  const wocheZwei = step({
    type: 'block',
    date: MO2,
    time: { form: 'range', from: 600, to: 660 },
    columns: { kind: 'ids', ids: [c0] },
    title: [{ text: 'Woche zwei', bold: true }],
  });
  return {
    plan,
    ids: {
      querbalken,
      marker,
      funk,
      kr,
      visite,
      tagBemerkung,
      vorbereitung,
      schiessen,
      frist,
      planBemerkung,
      wocheZwei,
    },
  };
}

/** Eintrag oder Fehler. */
export function entryOf(plan: Plan, id: Id): Entry {
  const e = plan.entries[id];
  if (e === undefined) throw new Error(`Eintrag ${id} fehlt`);
  return e;
}

/** Eintrag als «geändert» markiert (wie nach einem Import). */
export function markChanged(plan: Plan, id: Id): Plan {
  const e = entryOf(plan, id);
  return updateEntry(plan, id, e.type, { changed: true }, CTX).plan;
}

/** Tag der ersten Woche ausblenden. */
export function hideDay(plan: Plan, weekday: 'Sa' | 'So' | 'Mi'): Plan {
  const w = plan.weeks[0];
  if (w === undefined) throw new Error('Woche fehlt');
  return setDayDisplay(plan, w.id, [weekday], 'hidden', CTX).plan;
}

export type Run = (plan: Plan, ctx: CommandContext) => CommandResult;

/** Zustand eines Prüflaufs: aktueller Plan und ausgeführte Befehle. */
export interface Live {
  plan: Plan;
  runs: number;
}

/** Befehl wie in der Route auf den aktuellen Plan anwenden. */
export function apply(live: Live, cmd: Run): Plan {
  const r = cmd(live.plan, CTX);
  live.plan = r.plan;
  live.runs += 1;
  return r.plan;
}
