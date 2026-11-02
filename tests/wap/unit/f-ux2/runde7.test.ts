// @vitest-environment node
// F-UX2 Runde 7 (Nacharbeit SA-34; Beschrieb 4.6, 5.1, 6; normalisierung.md 5.9): Listenzellen – neuer Beso-Titel nicht
// fett (UX-AB-04), «geändert» ist eine Markierung und kein wählbarer Status (UX-AB-05), Beso ohne Leitungskategorie
// (UX-AB-15: Modell, Plan-Datei und Liste). Fiktive Daten.
import { describe, expect, it } from 'vitest';
import { commitCell } from '../../../../src/components/wap/list/commit';
import { parsePlanFile, serializePlanFile } from '../../../../src/io/wap-plan/planFile';
import { listRows } from '../../../../src/model/wap/list/index';
import { builtInTemplates } from '../../../../src/model/wap/template';
import type { Beso, Plan } from '../../../../src/model/wap/types';
import { validateEntry } from '../../../../src/model/wap/validate';
import { basePlan, beso, withEntries } from '../../support/model/builders';

const CTX = { templates: builtInTemplates() };

function plan(over: Partial<Beso> = {}): Plan {
  return withEntries(basePlan({ id: 'fux2-runde7' }), [beso('b1', 1, { title: [], ...over })]);
}

const row = (p: Plan) => {
  const r = listRows(p, 'plan').find((x) => x.entryId === 'b1');
  if (r === undefined) throw new Error('Zeile fehlt');
  return r;
};

describe('F-UX2 Runde 7: Listenzellen und Beso-Kategorie', () => {
  it('[R-5.1-23] UX-AB-04: Titel eines Beso ohne bisherigen Titel ist nicht fett', () => {
    const p = plan();
    const r = commitCell(p, row(p), 'titel', 'Kontrolle Fahrzeuge')(p, CTX);
    const e = r.plan.entries.b1;
    expect(e?.type === 'beso' ? e.title : null).toEqual([
      { text: 'Kontrolle Fahrzeuge', bold: false },
    ]);
  });

  it('[R-4.6-33][R-4.6-67] UX-AB-05: Status aus der Liste lässt die Markierung «geändert»; «geändert» selbst ist nicht wählbar', () => {
    const p = plan({ changed: true });
    expect(row(p).status).toBe('geändert');
    const r = commitCell(p, row(p), 'status', 'offen')(p, CTX);
    const e = r.plan.entries.b1;
    expect(e?.status).toBe('open');
    expect(e?.changed).toBe(true);
    expect(() => commitCell(p, row(p), 'status', 'geändert')).toThrow(/Markierung/);
  });

  it('[R-4.6-25] UX-AB-15: Beso ohne Leitungskategorie – gültig, in der Plan-Datei erhalten, Liste und Export leer', () => {
    const p = plan();
    const r = commitCell(p, row(p), 'kategorie', '')(p, CTX);
    const e = r.plan.entries.b1;
    expect(e?.type === 'beso' ? e.categoryId : 'x').toBeNull();
    expect(validateEntry(r.plan, e as Beso)).toEqual([]);
    expect(row(r.plan).kategorie).toBe('');
    const bytes = serializePlanFile(
      { plan: r.plan, revision: 1, modifiedAt: '2026-10-12T07:00:00.000Z', stands: [] },
      { now: () => new Date('2026-10-12T07:00:00.000Z') },
    );
    const back = parsePlanFile(bytes).plan.entries.b1;
    expect(back?.type === 'beso' ? back.categoryId : 'x').toBeNull();
    // Leer bleibt Pflichtfeld-Fehler (nur null heisst «keine»).
    expect(validateEntry(r.plan, { ...(e as Beso), categoryId: '' }).map((i) => i.code)).toContain(
      'missingField',
    );
  });
});
