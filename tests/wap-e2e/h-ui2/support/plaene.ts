// H-UI2: fiktive Pläne als Plan-Dateien (Leisten, Beso, Notiz, Stand, Terminbereich). Nur fiktive Daten.
import { updateEntry } from '../../../../src/model/wap/commands/entries';
import { applyStand } from '../../../../src/model/wap/stand/stand';
import type { Id, Plan } from '../../../../src/model/wap/types';
import { add, besos, block, CTX, kpPlan, MO } from '../../../wap/support/i5/plan';

function named(plan: Plan, id: string, name: string): Plan {
  return { ...plan, id, exerciseName: name, service: 'FDT 2099' };
}

/** Vier Wochen, ein Block Mo 0800-1000 und ein Beso Mo 1000; langer Planname. */
export function planLeisten(): Plan {
  let plan = block(kpPlan(4), 'Wache Nord').plan;
  plan = add(plan, {
    type: 'beso',
    date: MO,
    title: [{ text: 'Arztvisite', bold: false }],
    windows: [{ time: { form: 'range', from: 600, to: 630 } }],
  }).plan;
  return named(plan, 'hui2-leisten', 'Leisten Übungsplan mit einem langen Namen');
}

/** Beso «Arztvisite» Mo 1000-1030 und Block «Wache Nord» Mo 0800-1000. */
export function planBeso(): Plan {
  return named(planLeisten(), 'hui2-beso', 'Beso Übungsplan');
}

/** Ein Block mit interner Notiz (R-6-39). */
export function planNotiz(): Plan {
  const b = block(kpPlan(1), 'Wache Süd');
  const plan = updateEntry(b.plan, b.id, 'block', { internalNote: 'Fiktive Notiz' }, CTX).plan;
  return named(plan, 'hui2-notiz', 'Notiz Übungsplan');
}

/** Ein Block ohne Notiz. */
export function planOhneNotiz(): Plan {
  return named(block(kpPlan(1), 'Wache West').plan, 'hui2-ohne-notiz', 'Ohne Notiz Übungsplan');
}

/** Nach dem ersten Stand: Beso «Visite 1» und «Visite 2» am Mo, Block «Wache Ost». */
export function planStand(): { plan: Plan; besoIds: readonly Id[] } {
  const b = besos(kpPlan(1), 2);
  let plan = block(b.plan, 'Wache Ost').plan;
  plan = applyStand(plan, { date: '2026-09-20' }, CTX).plan;
  return { plan: named(plan, 'hui2-stand', 'Stand Übungsplan'), besoIds: b.ids };
}

/** Mo mit wenigen, sehr langen Terminzeilen (mehrzeilig umbrochen): rollt, obwohl es nur drei Einträge sind. */
export function planTermineLang(): Plan {
  let plan = kpPlan(1);
  const lang =
    'Sanitätsdienst: Kontrolle der persönlichen Ausrüstung, der Unterkunft, der Fahrzeuge, der Waffen, des Materials und der Verpflegung';
  for (let i = 0; i < 3; i++)
    plan = add(plan, {
      type: 'beso',
      date: MO,
      title: [{ text: `Visite ${String(i + 1)} ${lang} ${lang} ${lang}`, bold: false }],
      windows: [{ time: { form: 'point', at: 420 + i * 60 } }],
    }).plan;
  return named(plan, 'hui2-termine-lang', 'Lange Termine Übungsplan');
}

/** Mo mit 10 Beso mit langen Titeln und n ganztägigen Bemerkungen (Terminbereich mit vielen Zeilen). */
export function planTermine(n: number): Plan {
  let plan = kpPlan(1);
  for (let i = 0; i < 10; i++)
    plan = add(plan, {
      type: 'beso',
      date: MO,
      title: [
        {
          text: `Visite ${String(i + 1)} Sanitätsdienst Kontrolle der Ausrüstung, der Unterkunft und der Fahrzeuge`,
          bold: false,
        },
      ],
      windows: [{ time: { form: 'point', at: 420 + i * 30 } }],
    }).plan;
  for (let i = 0; i < n; i++)
    plan = add(plan, {
      type: 'dayRemark',
      date: MO,
      text: `Bemerkung ${String(i + 1)}: Ausgang ab Abtreten bis Zapfenstreich, Rückmeldung beim Wachtmeister`,
    }).plan;
  return named(plan, `hui2-termine-${String(n)}`, 'Termine Übungsplan');
}
