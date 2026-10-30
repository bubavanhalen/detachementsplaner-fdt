// F-UX2: fiktive Pläne für Bildschirm = PDF, Treffen/Ziehen, Auffüllen und Spaltenkopf (Beschrieb 4.4, 4.6, 5.1, 5.2).
// «Dichte Woche»: lückenlose Ketten in jeder Planungsspalte, ein Block über alle Spalten mit Ausnahme, Beso-Kästchen
// in Planungs- und Beso-Spalte, Marker, Rapporte und Blöcke in einer schmalen Nebenspalte «Det». Nur fiktive Daten.

import { addDays } from '../../../../src/model/wap/calendar';
import { updateColumnSet } from '../../../../src/model/wap/commands/columns';
import type { EntryDraft } from '../../../../src/model/wap/commands/entries';
import type { Column, Id, IsoDate, Plan } from '../../../../src/model/wap/types';
import { add, CTX, kpPlan, MO } from '../../../wap/support/i5/plan';

function named(plan: Plan, id: string, name: string): Plan {
  return { ...plan, id, exerciseName: name, service: 'FDT 2099' };
}

/** Spalten des Spaltensatzes mit `name`. */
export function columnsOf(plan: Plan, set: string): readonly Column[] {
  return plan.columnSets.find((s) => s.name === set)?.columns ?? [];
}

const TITEL = [
  'Zugschule',
  'Waffendrill',
  'Theorie Karte',
  'Fahrschule',
  'Sanität',
  'Wachtdienst',
  'Unterhalt Mat',
  'Funk SE-235',
  'Schutzmaske',
  'Marsch 15 km',
  'Gefechtsdrill',
  'Postenlauf',
];

function block(
  date: IsoDate,
  from: number,
  to: number,
  ids: readonly Id[],
  title: string,
): EntryDraft {
  return {
    type: 'block',
    date,
    time: { form: 'range', from, to },
    columns: { kind: 'ids', ids },
    title: [{ text: title, bold: true }],
  };
}

/**
 * Dichte Woche (Wo «KVK» ab Mo 28.09.2026): Mo–Fr in jeder Planungsspalte eine lückenlose Kette 0600–1130 und
 * 1300–1800 (Dauer 30–90 Min), «MiE» 1130–1300 über alle Spalten mit einer Ausnahme in der zweiten Spalte, je Tag
 * zwei Beso-Kästchen (eines in einer Planungsspalte über einem Block), ein Marker, zwei Rapporte. Mi–Fr zusätzlich
 * die Nebenspalte «Det» (schmal) mit zwei Blöcken.
 */
export function planDicht(): Plan {
  let plan = kpPlan(1);
  const mid = plan.columnSets.find((s) => s.name === 'KVK Mi–Fr');
  if (mid !== undefined) {
    const rap = mid.columns.findIndex((c) => c.kind === 'rap');
    plan = updateColumnSet(
      plan,
      mid.id,
      {
        op: 'add',
        index: rap < 0 ? mid.columns.length : rap,
        column: { name: 'Det', kind: 'secondary', weight: 'narrow' },
      },
      CTX,
    ).plan;
  }
  const lengths = [60, 45, 90, 30, 75, 60, 45];
  let n = 0;
  for (let d = 0; d < 5; d++) {
    const date = addDays(MO, d);
    const set = d < 2 ? 'KVK Stufen' : 'KVK Mi–Fr';
    const cols = columnsOf(plan, set);
    const planning = cols.filter((c) => c.kind === 'planning');
    planning.forEach((c, ci) => {
      for (const [start, end] of [
        [360, 690],
        [780, 1080],
      ] as const) {
        let t = start;
        let k = ci + d;
        while (t < end) {
          const len = Math.min(lengths[k % lengths.length] ?? 60, end - t);
          plan = add(
            plan,
            block(date, t, t + len, [c.id], TITEL[n % TITEL.length] ?? 'Block'),
          ).plan;
          n++;
          k++;
          t += len;
        }
      }
    });
    const ids = planning.map((c) => c.id);
    plan = add(plan, block(date, 690, 780, ids, 'MiE')).plan;
    const second = planning[1];
    if (second !== undefined)
      plan = add(plan, block(date, 720, 750, [second.id], 'Rapport Zfhr')).plan;
    const det = cols.find((c) => c.kind === 'secondary');
    if (det !== undefined) {
      plan = add(plan, block(date, 480, 600, [det.id], 'Mun Fsg Det')).plan;
      plan = add(plan, block(date, 840, 960, [det.id], 'Ausb Mun Det')).plan;
    }
    const first = planning[0];
    plan = add(plan, {
      type: 'beso',
      date,
      title: [{ text: `Visite ${String(d + 1)}`, bold: false }],
      windows: [
        { time: { form: 'range', from: 600, to: 630 } },
        { time: { form: 'range', from: 900, to: 930 }, columnId: first?.id ?? null },
      ],
    }).plan;
    plan = add(plan, {
      type: 'marker',
      date,
      at: 1020,
      kind: 'ABV',
      customKind: '',
      columns: { kind: 'all' },
    }).plan;
    for (const at of [420, 1080])
      plan = add(plan, {
        type: 'rapport',
        date,
        code: at === 420 ? 'KR' : 'DR',
        time: { form: 'range', from: at, to: at + 30 },
      }).plan;
  }
  return named(plan, 'fux2-dicht', 'Dichte Übungswoche');
}

/** Wenige Blöcke für Parität und Auffüllen: Mo «Wache Nord» 0800-1000 in der ersten, «Wache Süd» 1100-1200. */
export function planEinfach(): Plan {
  let plan = kpPlan(1);
  const planning = columnsOf(plan, 'KVK Stufen').filter((c) => c.kind === 'planning');
  const [a, b] = planning;
  if (a === undefined || b === undefined) throw new Error('Spalten fehlen');
  plan = add(plan, block(MO, 480, 600, [a.id], 'Wache Nord')).plan;
  const breit = planning.slice(0, 5).map((c) => c.id);
  plan = add(plan, block(MO, 660, 750, breit, 'Wache Süd')).plan;
  plan = add(plan, block(MO, 540, 570, [b.id], 'Nachbar')).plan;
  plan = add(plan, block(MO, 780, 840, [a.id, b.id], 'Gemeinsam')).plan;
  plan = add(plan, {
    ...block(MO, 900, 1020, [b.id], 'Sanitätsdienst Grundausbildung'),
    supplement: 'Zusatz Kurs',
    ort: 'Halle Nord',
  } as EntryDraft).plan;
  return named(plan, 'fux2-einfach', 'Einfacher Übungsplan');
}

/**
 * Köpfe und Termine wie auf der Wochenseite (VQA-2-01/-02): «KVK Stufen» mit langen Spaltennamen (Silbentrennung,
 * Rückfallgrösse), Beso mit langer Terminzeile und eine ganztägige Bemerkung am Mo. Fiktive Daten.
 */
export function planKoepfe(): Plan {
  let plan = kpPlan(1);
  const set = plan.columnSets.find((s) => s.name === 'KVK Stufen');
  if (set === undefined) throw new Error('Spaltensatz fehlt');
  const names = ['SERVIZIO', 'Stellvertreter', 'COBRA 10'];
  set.columns.slice(0, names.length).forEach((c, i) => {
    plan = updateColumnSet(
      plan,
      set.id,
      { op: 'update', columnId: c.id, changes: { name: names[i] ?? c.name } },
      CTX,
    ).plan;
  });
  plan = add(plan, {
    type: 'beso',
    date: MO,
    title: [
      {
        text: 'Arztvisite Sanitätsdienst Kontrolle der persönlichen Ausrüstung und der Unterkunft',
        bold: false,
      },
    ],
    windows: [{ time: { form: 'range', from: 600, to: 630 } }],
  }).plan;
  plan = add(plan, {
    type: 'dayRemark',
    date: MO,
    text: 'Tenue Ausgang ab Mittag, Fahrzeuge vollgetankt abgeben',
  }).plan;
  return named(plan, 'fux2-koepfe', 'Köpfe Übungsplan');
}

/**
 * Det am Tagesrand (UX-2-02/-03/-07): «KVK Stufen» mit Nebenspalte «Det» vor Rap/Beso; Mo «Zweispalter» 0800-1000
 * über Kp Kdt und Stv, «Schmal» 1100-1200 in Kp Kdt, «Verwaist» 1300-1400 in Zfhr. Fiktive Daten.
 */
export function planDetRand(): Plan {
  let plan = kpPlan(1);
  const set = plan.columnSets.find((s) => s.name === 'KVK Stufen');
  if (set === undefined) throw new Error('Spaltensatz fehlt');
  const rap = set.columns.findIndex((c) => c.kind === 'rap');
  plan = updateColumnSet(
    plan,
    set.id,
    { op: 'add', index: rap, column: { name: 'Det', kind: 'secondary', weight: 'narrow' } },
    CTX,
  ).plan;
  const p = columnsOf(plan, 'KVK Stufen').filter((c) => c.kind === 'planning');
  const [a, b, c] = p;
  if (a === undefined || b === undefined || c === undefined) throw new Error('Spalten fehlen');
  plan = add(plan, block(MO, 480, 600, [a.id, b.id], 'Zweispalter')).plan;
  plan = add(plan, block(MO, 660, 720, [a.id], 'Schmal')).plan;
  plan = add(plan, block(MO, 780, 840, [c.id], 'Verwaist')).plan;
  return named(plan, 'fux2-detrand', 'Det-Rand Übungsplan');
}
