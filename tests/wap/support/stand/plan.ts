// Prüf-Plan P und Einträge für Paket E1-05 (Vertrag docs/wap-planer/plan/vertraege/E1-05.md, Notiz
// «Ausarbeitung Schritt 2» Abschnitt G und H3). P entsteht mit createPlanFromTemplate (E1-02a): 4 Wochen ab
// Montag 2026-09-14, Kurznamen «KVK», «Wo1», «Wo2», «Wo3»; danach beilage und service gesetzt. Einträge über
// die Fabriken von E1-02a. Alle Inhalte sind fiktiv; nichts stammt aus reference/.

import type { CommandContext } from '../../../../src/model/wap/commands/command';
import {
  createPlanFromTemplate,
  newBeso,
  newBlock,
  newDayRemark,
  newMarker,
  newMultiDayRemark,
  newQuerbalken,
  newRapport,
} from '../../../../src/model/wap/factories';
import { builtInTemplates, kpTemplate } from '../../../../src/model/wap/template';
import type {
  Beso,
  Block,
  DayRemark,
  Entry,
  EntryStatus,
  Id,
  IsoDate,
  Marker,
  MultiDayRemark,
  Plan,
  Querbalken,
  Rapport,
  RichText,
} from '../../../../src/model/wap/types';

/** Plan-ID von P (H3). */
export const PLAN_ID = 'p-test';
/** Datum der Beispiele: Donnerstag der ersten Woche (Abschnitt G). */
export const DATUM: IsoDate = '2026-09-17';
/** Beilage und Dienst von P (Abschnitt G, fiktiv). */
export const BEILAGE = 'Beilage 01-02 zum Allgemeinen Befehl (fiktiv)';
export const DIENST = 'FDT 2026';

/** Beginn der ersten Woche von P (Montag). */
export const KVK_MO: IsoDate = '2026-09-14';

/** Kontext für applyStand (Vorlagen als Parameter, AR0-18). */
export const ctx: CommandContext = { templates: builtInTemplates() };

/** Fester Zeitpunkt der Uhr (src/io bekommt die Uhr als Parameter). */
export const JETZT = new Date('2026-09-17T08:30:00.000Z');
export const clock = { now: (): Date => new Date(JETZT.getTime()) };

/** Prüf-Plan P ohne Einträge (H3). */
export function pruefPlan(): Plan {
  const p = createPlanFromTemplate(kpTemplate(), {
    planId: PLAN_ID,
    startDate: KVK_MO,
    weekCount: 4,
  });
  return { ...p, beilage: BEILAGE, service: DIENST };
}

/** ID der Woche mit dem Kurznamen (scheitert laut, wenn es sie nicht gibt). */
export function wocheId(plan: Plan, kurzname: string): Id {
  const w = plan.weeks.find((x) => x.shortName === kurzname);
  if (w === undefined) throw new Error(`Testaufbau: Woche ${kurzname} fehlt in P`);
  return w.id;
}

/** Kategorie-ID nach Name aus der Legende von P (z.B. «Ltg Kp»). */
export function kategorie(plan: Plan, name: string): Id {
  const c = plan.legend.find((x) => x.name === name);
  if (c === undefined) throw new Error(`Testaufbau: Kategorie ${name} fehlt in P`);
  return c.id;
}

/** P mit den Einträgen; `nextId` liegt danach über allen Test-IDs (e101 …). */
export function mitEintraegen(
  plan: Plan,
  eintraege: readonly Entry[],
  over: Partial<Plan> = {},
): Plan {
  const entries: Record<Id, Entry> = { ...plan.entries };
  for (const e of eintraege) entries[e.id] = e;
  return {
    ...plan,
    entries,
    nextId: Math.max(plan.nextId, 500),
    nextSeq: Math.max(plan.nextSeq, 500),
    ...over,
  };
}

function titel(text: string): RichText {
  return [{ text, bold: false }];
}

export interface Zusatz {
  readonly status?: EntryStatus;
  readonly changed?: boolean;
}

function mit<T extends Entry>(e: T, z: Zusatz): T {
  return {
    ...e,
    ...(z.status === undefined ? {} : { status: z.status }),
    changed: z.changed ?? false,
  };
}

/** Block 0800-1200 in allen Spalten, Kategorie «Ltg Kp» (oder `categoryId`). */
export function block(
  plan: Plan,
  id: Id,
  date: IsoDate,
  text: string,
  z: Zusatz & { readonly categoryId?: Id; readonly title?: RichText } = {},
): Block {
  return mit(
    newBlock(
      {
        date,
        time: { form: 'range', from: 480, to: 720 },
        columns: { kind: 'all' },
        title: z.title ?? titel(text),
        supplement: '',
        ltg: '',
        tn: '',
        tpt: '',
        ort: '',
        tenue: '',
        printTn: false,
        printTenue: false,
        categoryId: z.categoryId ?? kategorie(plan, 'Ltg Kp'),
        secondCategoryId: null,
        textDirection: 'auto',
        openEnd: false,
      },
      id,
      Number(id.slice(1)),
    ),
    z,
  );
}

/** Beso mit einem Zeitfenster 1400 und der Nummer `nr`. */
export function beso(
  plan: Plan,
  id: Id,
  date: IsoDate,
  text: string,
  nr: number | null,
  z: Zusatz & { readonly numberFixed?: boolean } = {},
): Beso {
  const b = newBeso(
    {
      date,
      title: titel(text),
      windows: [
        { id: `t${id.slice(1)}`, time: { form: 'point', at: 840 }, columnId: null, supplement: '' },
      ],
      ltg: '',
      tn: '',
      tpt: '',
      ort: '',
      categoryId: kategorie(plan, 'Ltg Kp'),
      besoNumber: nr,
      numberFixed: z.numberFixed ?? false,
      agendaOverride: null,
    },
    id,
    Number(id.slice(1)),
  );
  return mit(b, z);
}

/** Querbalken über alle Spalten von `von` bis `bis`. */
export function querbalken(
  id: Id,
  von: IsoDate,
  bis: IsoDate,
  text: string,
  z: Zusatz = {},
): Querbalken {
  return mit(
    newQuerbalken(
      {
        title: titel(text),
        fromDate: von,
        toDate: bis,
        columns: { kind: 'all' },
        categoryId: null,
      },
      id,
      Number(id.slice(1)),
    ),
    z,
  );
}

/** Marker 1000; `art` «custom» mit freier Bezeichnung `frei`. */
export function marker(
  id: Id,
  date: IsoDate,
  art: Marker['kind'],
  frei = '',
  z: Zusatz = {},
): Marker {
  return mit(
    newMarker(
      { date, at: 600, kind: art, customKind: frei, columns: { kind: 'all' }, asFlatBlock: false },
      id,
      Number(id.slice(1)),
    ),
    z,
  );
}

/** Rapport 0700 mit dem Kürzel `code` (Kategorie «Ltg Kp»). */
export function rapport(plan: Plan, id: Id, date: IsoDate, code: string, z: Zusatz = {}): Rapport {
  return mit(
    newRapport(
      {
        date,
        code,
        time: { form: 'point', at: 420 },
        ort: '',
        tn: '',
        categoryId: kategorie(plan, 'Ltg Kp'),
        display: 'rapColumn',
        displayColumns: { kind: 'all' },
      },
      id,
      Number(id.slice(1)),
    ),
    z,
  );
}

/** Ganztägige Bemerkung. */
export function tagesBemerkung(id: Id, date: IsoDate, text: string, z: Zusatz = {}): DayRemark {
  return mit(newDayRemark({ date, text }, id, Number(id.slice(1))), z);
}

/** Bemerkung mit Geltungsbereich (Plan, Woche oder Zeitraum). */
export function bemerkung(
  id: Id,
  scope: MultiDayRemark['scope'],
  text: string,
  z: Zusatz = {},
): MultiDayRemark {
  return mit(
    newMultiDayRemark({ text, scope, number: null, refBoxColumnId: null }, id, Number(id.slice(1))),
    z,
  );
}
