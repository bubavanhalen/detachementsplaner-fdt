// @vitest-environment jsdom
// I3 C3: Plan- und Wocheneinstellungen als Befehle (Beschrieb 4.1, 4.2, 4.7, 4.8). Speichern = Befehl mit Undo-
// Schritt, Laden = Plan-Datei (serialize/parse), Anzeige = Layout-Schicht der Wochenseite (wie im PDF). Fiktive Daten.
import { describe, expect, it } from 'vitest';
import { parsePlanFile, serializePlanFile } from '../../../../src/io/wap-plan/planFile';
import { createEntry, updateEntry } from '../../../../src/model/wap/commands/entries';
import {
  categoryUsage,
  deleteCategory,
  setRemarkHidden,
  setWeekGoals,
  updatePlanFields,
  updateWeekFields,
  upsertCategory,
} from '../../../../src/model/wap/commands/settings';
import { remarksForWeek } from '../../../../src/model/wap/derive/remarks';
import type { Plan } from '../../../../src/model/wap/types';
import { CTX, kpPlan, undo, weekId } from '../../support/i3/plan';
import { pageTexts } from '../../support/i3/seite';

const clock = { now: () => new Date('2026-10-14T08:00:00Z') };

/** Speichern und Laden über die Plan-Datei (E1-04). */
function roundTrip(plan: Plan): Plan {
  const bytes = serializePlanFile(
    { plan, revision: 1, modifiedAt: '2026-10-14T08:00:00.000Z', stands: [] },
    clock,
  );
  return parsePlanFile(bytes).plan;
}

describe('I3 C3 Plan-Einstellungen', () => {
  it('[R-4.1-02] Einheit und übergeordnete Einheit: änderbar (ein Undo-Schritt), speicher- und ladbar, Einheit im Kopf', () => {
    const p = kpPlan();
    const r = updatePlanFields(p, { unit: ' Inf Ustü Kp 99/4 ', parentUnit: 'Inf Bat 99' }, CTX);
    expect(r.plan.unit).toBe('Inf Ustü Kp 99/4');
    expect(r.plan.parentUnit).toBe('Inf Bat 99');
    expect(undo(r).unit).toBe('');
    const loaded = roundTrip(r.plan);
    expect(loaded.unit).toBe('Inf Ustü Kp 99/4');
    expect(loaded.parentUnit).toBe('Inf Bat 99');
    expect(pageTexts(r.plan, weekId(r.plan, 0)).some((t) => t.includes('Inf Ustü Kp 99/4'))).toBe(
      true,
    );
  });

  it('[R-4.1-03] Dienst, Übungsname und Beilage: änderbar, speicher- und ladbar, Beilage im Kopf', () => {
    const p = kpPlan();
    const r = updatePlanFields(
      p,
      { service: 'FDT 2099', exerciseName: 'BEISPIEL', beilage: 'Beilage 01-02 zum Befehl Muster' },
      CTX,
    );
    const loaded = roundTrip(r.plan);
    expect([loaded.service, loaded.exerciseName, loaded.beilage]).toEqual([
      'FDT 2099',
      'BEISPIEL',
      'Beilage 01-02 zum Befehl Muster',
    ]);
    expect(pageTexts(r.plan, weekId(r.plan, 0)).join('\n')).toContain(
      'Beilage 01-02 zum Befehl Muster',
    );
    expect(undo(r).service).toBe('');
  });

  it('[R-4.1-05] Standort der Sonnenzeiten: speicher- und ladbar', () => {
    const r = updatePlanFields(kpPlan(), { sunLocation: 'Kaserne Musterhausen' }, CTX);
    expect(roundTrip(r.plan).sunLocation).toBe('Kaserne Musterhausen');
    expect(undo(r).sunLocation).toBe('');
  });

  it('[R-4.1-06] Kommandant mit Grad, Name, Vorname und Funktion: alle vier Felder speicher-, lade- und änderbar', () => {
    const commander = {
      grad: 'Hptm',
      name: 'Muster',
      vorname: 'Anna',
      funktion: 'Kp Kdt',
      nameOrder: 'gradNameVorname' as const,
    };
    const r = updatePlanFields(kpPlan(), { commander }, CTX);
    expect(roundTrip(r.plan).commander).toEqual(commander);
    const again = updatePlanFields(r.plan, { commander: { ...commander, funktion: 'Kdt' } }, CTX);
    expect(again.plan.commander.funktion).toBe('Kdt');
    expect(undo(again).commander.funktion).toBe('Kp Kdt');
  });

  it('[R-4.1-13] Wappen (Bild) und Motto: speicher- und ladbar, Motto in der Seitenleiste; ungültiges Bild abgelehnt', () => {
    // 1×1-PNG, fiktiv (rein technisch, keine Daten).
    const png =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const r = updatePlanFields(
      kpPlan(),
      { motto: 'MUSTER & BEISPIEL', coatOfArms: { mime: 'image/png', dataBase64: png } },
      CTX,
    );
    const loaded = roundTrip(r.plan);
    expect(loaded.motto).toBe('MUSTER & BEISPIEL');
    expect(loaded.coatOfArms?.dataBase64).toBe(png);
    expect(pageTexts(r.plan, weekId(r.plan, 0))).toContain('MUSTER & BEISPIEL');
    expect(() =>
      updatePlanFields(kpPlan(), { coatOfArms: { mime: 'image/png', dataBase64: '' } }, CTX),
    ).toThrow(/PNG- oder JPEG/);
  });
});

describe('I3 C3 Wocheneinstellungen', () => {
  it('[R-4.2-04] Wochenziele als Aufzählung: Reihenfolge und Text bleiben, erscheinen in der Seitenleiste', () => {
    const p = kpPlan();
    const w = weekId(p, 1);
    const r = setWeekGoals(p, w, ['Ziel Beispiel A', '', ' Ziel Beispiel B '], CTX);
    const goals = r.plan.weeks[1]?.weekGoals.map((g) => g.text);
    expect(goals).toEqual(['Ziel Beispiel A', 'Ziel Beispiel B']);
    expect(roundTrip(r.plan).weeks[1]?.weekGoals.map((g) => g.text)).toEqual(goals);
    const texts = pageTexts(r.plan, w).join('\n');
    expect(texts.indexOf('Ziel Beispiel A')).toBeGreaterThanOrEqual(0);
    expect(texts.indexOf('Ziel Beispiel A')).toBeLessThan(texts.indexOf('Ziel Beispiel B'));
    const reordered = setWeekGoals(r.plan, w, ['Ziel Beispiel B', 'Ziel Beispiel A'], CTX);
    expect(reordered.plan.weeks[1]?.weekGoals.map((g) => g.text)).toEqual([
      'Ziel Beispiel B',
      'Ziel Beispiel A',
    ]);
    expect(undo(reordered).weeks[1]?.weekGoals.map((g) => g.text)).toEqual(goals);
  });

  it('[R-4.2-08] Kp: Plan-Bemerkung in Wo 2 ausgeblendet → fehlt nur in Wo 2; wieder einblendbar', () => {
    const p = kpPlan(3);
    const c = createEntry(
      p,
      { type: 'multiDayRemark', text: 'Bemerkung durchgehend', scope: { kind: 'plan' } },
      CTX,
    );
    const hidden = setRemarkHidden(c.plan, weekId(p, 1), c.entryId, true, CTX);
    const shown = (plan: Plan, i: number) =>
      remarksForWeek(plan, weekId(plan, i)).map((r) => r.text);
    expect(shown(hidden.plan, 0)).toEqual(['Bemerkung durchgehend']);
    expect(shown(hidden.plan, 1)).toEqual([]);
    expect(shown(hidden.plan, 2)).toEqual(['Bemerkung durchgehend']);
    expect(pageTexts(hidden.plan, weekId(p, 1)).join('\n')).not.toContain('Bemerkung durchgehend');
    expect(pageTexts(hidden.plan, weekId(p, 0)).join('\n')).toContain('Bemerkung durchgehend');
    const again = setRemarkHidden(hidden.plan, weekId(p, 1), c.entryId, false, CTX);
    expect(shown(again.plan, 1)).toEqual(['Bemerkung durchgehend']);
    expect(shown(undo(again), 1)).toEqual([]);
  });

  it('[R-4.2-09] Kp: Bemerkung nur für Wo 1 ergänzt → erscheint nur in Wo 1', () => {
    const p = kpPlan(3);
    const w1 = weekId(p, 1);
    const c = createEntry(
      p,
      { type: 'multiDayRemark', text: 'Nur diese Woche', scope: { kind: 'week', weekId: w1 } },
      CTX,
    );
    expect(remarksForWeek(c.plan, w1).map((r) => r.text)).toEqual(['Nur diese Woche']);
    expect(remarksForWeek(c.plan, weekId(p, 0))).toEqual([]);
    expect(remarksForWeek(c.plan, weekId(p, 2))).toEqual([]);
    expect(pageTexts(c.plan, w1).join('\n')).toContain('Nur diese Woche');
  });

  it('[R-4.8-11] Sonnenzeiten pro Woche von Hand: Handwert in der Seite (wie im PDF), Undo stellt «–» wieder her', () => {
    const p = kpPlan();
    const w = weekId(p, 0);
    const r = updateWeekFields(p, w, { sunOverride: { sunrise: 435, sunset: 1150 } }, CTX);
    const texts = pageTexts(r.plan, w);
    expect(texts).toContain('0715');
    expect(texts).toContain('1910');
    expect(roundTrip(r.plan).weeks[0]?.sunOverride).toEqual({ sunrise: 435, sunset: 1150 });
    expect(pageTexts(undo(r), w)).not.toContain('0715');
    expect(() =>
      updateWeekFields(p, w, { sunOverride: { sunrise: 433, sunset: null } }, CTX),
    ).toThrow(/5-Minuten-Raster/);
  });
});

describe('I3 C3 Legende', () => {
  it('[R-4.7-01] Kategorie mit Name und Farbe anlegen, ändern und löschen; verwendete nur mit Ersatzkategorie (F-58)', () => {
    const p = kpPlan();
    const made = upsertCategory(
      p,
      {
        name: 'Ltg Muster',
        legendLabel: 'Leitung Muster',
        color: { r: 1, g: 2, b: 3 },
        neutral: false,
        inLegend: true,
      },
      CTX,
    );
    const cat = made.plan.legend.find((c) => c.id === made.categoryId);
    if (cat === undefined) throw new Error('Kategorie fehlt');
    expect(cat).toMatchObject({ name: 'Ltg Muster', color: { r: 1, g: 2, b: 3 } });
    expect(() => upsertCategory(made.plan, { ...cat, name: 'Ltg Kp' }, CTX)).toThrow(
      /gibt es schon/,
    );
    const changed = upsertCategory(made.plan, { ...cat, color: { r: 255, g: 255, b: 0 } }, CTX);
    expect(changed.plan.legend.find((c) => c.id === made.categoryId)?.color).toEqual({
      r: 255,
      g: 255,
      b: 0,
    });
    // Verwendet: ein Block mit dieser Kategorie.
    const day = changed.plan.weeks[0]?.startDate ?? '2026-09-28';
    const block = createEntry(
      changed.plan,
      {
        type: 'block',
        date: day,
        time: { form: 'range', from: 480, to: 540 },
        columns: { kind: 'all' },
        title: [{ text: 'Block Muster', bold: true }],
        categoryId: made.categoryId,
      },
      CTX,
    );
    expect(categoryUsage(block.plan, made.categoryId)).toBe(1);
    expect(() => deleteCategory(block.plan, made.categoryId, null, CTX)).toThrow(/1-mal verwendet/);
    const kp = block.plan.legend.find((c) => c.name === 'Ltg Kp');
    if (kp === undefined) throw new Error('Ltg Kp fehlt');
    const deleted = deleteCategory(block.plan, made.categoryId, kp.id, CTX);
    expect(deleted.plan.legend.some((c) => c.id === made.categoryId)).toBe(false);
    expect(deleted.plan.entries[block.entryId]).toMatchObject({ categoryId: kp.id });
    // Ein Undo-Schritt stellt Kategorie und Zuordnung wieder her.
    const back = undo(deleted);
    expect(back.legend.some((c) => c.id === made.categoryId)).toBe(true);
    expect(back.entries[block.entryId]).toMatchObject({ categoryId: made.categoryId });
    // Unbenutzt: ohne Ersatz löschbar.
    const unused = deleteCategory(changed.plan, made.categoryId, null, CTX);
    expect(unused.plan.legend.some((c) => c.id === made.categoryId)).toBe(false);
    const updated = updateEntry(block.plan, block.entryId, 'block', { categoryId: kp.id }, CTX);
    expect(categoryUsage(updated.plan, made.categoryId)).toBe(0);
  });
});
