// I5: fiktive Pläne als Plan-Dateien für die Abläufe (Prüfregeln, Export, Stand, Erststart). Ohne Layout-Schicht
// (Node-Lader von Playwright). Nur fiktive Daten.
import { serializePlanFile } from '../../../../src/io/wap-plan/planFile';
import { setDayDisplay } from '../../../../src/model/wap/commands/days';
import { updateEntry } from '../../../../src/model/wap/commands/entries';
import { updatePlanFields } from '../../../../src/model/wap/commands/settings';
import { createPlanFromTemplate } from '../../../../src/model/wap/factories';
import { applyStand } from '../../../../src/model/wap/stand/stand';
import { kpTemplate } from '../../../../src/model/wap/template';
import type { Id, Plan } from '../../../../src/model/wap/types';
import { add, besos, block, CTX, kpPlan } from '../../../wap/support/i5/plan';

const CLOCK = { now: () => new Date('2026-10-12T07:00:00Z') };

export function planFile(plan: Plan): Buffer {
  return Buffer.from(
    serializePlanFile(
      { plan, revision: 1, modifiedAt: '2026-10-12T07:00:00.000Z', stands: [] },
      CLOCK,
    ),
  );
}

function named(plan: Plan, id: string, name: string): Plan {
  return { ...plan, id, exerciseName: name, service: 'FDT 2099' };
}

/** Zwei Wochen; Mo Wo 1 mit 10 Beso (Nummernkreis voll belegt), Wo 2 mit einem Block. Ohne Befunde. */
export function planZehnBeso(): Plan {
  let plan = besos(kpPlan(2), 10).plan;
  plan = block(plan, 'Wache Nord', { date: '2026-10-06' }).plan;
  return named(plan, 'i5-e2e-zehn-beso', 'Befund Übungsplan');
}

/** Wo 1 mit P8 (zu langer Titel), P16 (So ausgeblendet mit Eintrag) und P17 (11. Beso); Wo 2 ohne Befund. */
export function planExport(): Plan {
  let plan = besos(kpPlan(2), 11).plan;
  plan = block(plan, 'Einrichten Ukft Magazin Fahrzeughalle Werkstatt Lager Nord Süd', {
    time: { form: 'range', from: 480, to: 495 },
  }).plan;
  plan = block(plan, 'Sonntagswache', { date: '2026-10-04' }).plan;
  plan = setDayDisplay(plan, plan.weeks[0]?.id ?? '', ['So'], 'hidden', CTX).plan;
  plan = block(plan, 'Ausb Woche zwei', { date: '2026-10-06' }).plan;
  return named(plan, 'i5-e2e-export', 'Export Übungsplan');
}

/**
 * Ausgangszustand von R-5.3-09 (d) (F-64): nach dem ersten Stand Mo 10–19 belegt, Beso 12 gestrichen, ein Beso
 * ohne Nummer. Der nächste Stand vergibt ihm die Nummer 12.
 */
export function planNummernStand(): { plan: Plan; ohneNummer: Id } {
  let { plan, ids } = besos(kpPlan(1), 10);
  plan = applyStand(plan, { date: '2026-09-20' }, CTX).plan;
  const elf = add(plan, {
    type: 'beso',
    date: '2026-09-28',
    title: [{ text: 'Nachzügler', bold: false }],
    windows: [{ time: { form: 'point', at: 1140 } }],
  });
  plan = elf.plan;
  plan = updateEntry(plan, ids[2] as Id, 'beso', { status: 'cancelled' }, CTX).plan;
  return { plan: named(plan, 'i5-e2e-stand', 'Stand Übungsplan'), ohneNummer: elf.id };
}

/** Eine Woche ohne Spaltensatz (Erststart einer Vorlage ohne Zuweisung). */
export function planOhneSpaltensatz(): Plan {
  const plan = createPlanFromTemplate(kpTemplate(), {
    planId: 'i5-e2e-leer',
    startDate: '2026-09-28',
    weekCount: 1,
  });
  return named(plan, 'i5-e2e-leer', 'Leere Woche');
}

/** Fiktive Einheit, eigene Legende, Wappen und Motto (R-3-02): nichts aus dem Code fest hinterlegt. */
export function planFiktiv(): Plan {
  let plan = block(kpPlan(1), 'Fiktivübung').plan;
  plan = updatePlanFields(
    plan,
    {
      unit: 'Fikt Kp 77/9',
      motto: 'IMMER WEITER',
      beilage: 'Beilage 7',
      parentUnit: 'Fikt Bat 77',
    },
    CTX,
  ).plan;
  return named(plan, 'i5-e2e-fiktiv', 'Fiktiv Übungsplan');
}

/** Gemeinsame Leitung, offenes Ende und flacher Marker (I5 D3, Parität Bildschirm/PDF). */
export function planErgaenzungen(): Plan {
  const base = kpPlan(1);
  const cat = (name: string) => base.legend.find((c) => c.name === name)?.id ?? '';
  let plan = block(base, 'Gemeinsam', {
    categoryId: cat('Ltg Kp'),
    secondCategoryId: cat('Ltg Zfhr'),
  }).plan;
  plan = block(plan, 'Offen bis', {
    date: '2026-09-29',
    time: { form: 'range', from: 600, to: 780 },
    openEnd: true,
  }).plan;
  plan = add(plan, {
    type: 'marker',
    date: '2026-09-28',
    at: 900,
    kind: 'HV',
    columns: { kind: 'all' },
    asFlatBlock: true,
  }).plan;
  return named(plan, 'i5-e2e-ergaenzungen', 'Ergänzungen Übungsplan');
}
