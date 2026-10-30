// @vitest-environment node
// F-DOKU, Auflagen TR-2-05 und TR-2-07 des test-reviewer-2: Kurztitel der Befundliste an der Grenze 40 Zeichen
// (Beschrieb 7; tötet Handmutant J), CSV-Wert nur mit «;» gequotet (RFC 4180, normalisierung; Handmutant I hier
// statt nur im älteren Listen-Export-Test) und Terminzeile mit Doppelpunkt ohne Zeit: kein Zeitfenster (Beschrieb 4.8,
// normalisierung 5.5). Fiktive Daten.
import { describe, expect, it } from 'vitest';
import { parseAgendaLine } from '../../../../src/io/wap-import/index';
import type { ShapeTextRun } from '../../../../src/io/xlsx-drawing/index';
import { runChecks } from '../../../../src/model/wap/checks';
import { setDayDisplay } from '../../../../src/model/wap/commands/days';
import { listCsv } from '../../../../src/model/wap/list';
import type { Id, Plan } from '../../../../src/model/wap/types';
import { block, CTX, kpPlan } from '../../support/i5/plan';

const wk = (plan: Plan): Id => plan.weeks[0]?.id ?? '';

/** Kurztitel des Befunds P16 (Eintrag an ausgeblendetem Tag) für einen Block mit `titel`. */
function kurztitel(titel: string): string | undefined {
  const r = block(kpPlan(1), titel);
  const p = setDayDisplay(r.plan, wk(r.plan), ['Mo'], 'hidden', CTX).plan;
  const f = runChecks({ plan: p, layoutFor: () => ({ fallbacks: [] }) as never }).find(
    (x) => x.rule === 'P16' && x.entryId === r.id,
  );
  return f?.title;
}

describe('F-DOKU TR-2-05: Kurztitel in der Befundliste an der Grenze 40 Zeichen', () => {
  it('[R-7-03] genau 40 Zeichen → ungekürzt, ohne «…»', () => {
    expect(kurztitel('B'.repeat(40))).toBe('B'.repeat(40));
  });

  it('[R-7-03] 41 Zeichen → auf 40 gekürzt mit «…»', () => {
    expect(kurztitel('B'.repeat(41))).toBe(`${'B'.repeat(40)}…`);
  });
});

describe('F-DOKU TR-2-07: CSV der Listenansicht quotet einen Wert schon wegen «;» allein', () => {
  it('[R-6-16] Titel mit «;» ohne «"» → Feld in Anführungszeichen; ohne «;» → nicht gequotet', () => {
    const mit = block(kpPlan(1), 'Teil A; Teil B').plan;
    const zeileMit = listCsv(mit, 'plan').split('\n')[1] ?? '';
    expect(zeileMit).toContain(';"Teil A; Teil B";');
    const ohne = block(kpPlan(1), 'Teil A, Teil B').plan;
    const zeileOhne = listCsv(ohne, 'plan').split('\n')[1] ?? '';
    expect(zeileOhne).toContain(';Teil A, Teil B;');
    expect(zeileOhne).not.toContain('"');
  });
});

describe('F-DOKU TR-2-07: Terminzeile ohne Zeit nach dem Doppelpunkt', () => {
  const N = (text: string): ShapeTextRun => ({
    paragraph: 0,
    line: 0,
    text,
    bold: false,
    strike: false,
    color: null,
    sizePt: 8,
  });

  it('[R-8.2-34] «17 Material: Kisten, Säcke» → kein Zeitfenster, keine Frist, Text als Freitext', () => {
    const p = parseAgendaLine([N('17 Material: Kisten, Säcke')]);
    expect(p.number).toBe(17);
    expect(p.time).toBeNull();
    expect(p.deadline).toBeNull();
    expect(p.windows).toEqual([]);
    expect(p.freeText).toBe('Material: Kisten, Säcke');
  });

  it('[R-8.2-34] Doppelpunkt am Anfang «16 : 0900 X, 1000 Y» → kein Muster mehrerer Zeitfenster (höchstens ein Zeitfenster), Freitext und «unsicher»', () => {
    const p = parseAgendaLine([N('16 : 0900 X, 1000 Y')]);
    expect(p.windows.length).toBeLessThanOrEqual(1);
    expect(p.freeText).toBe(': 0900 X, 1000 Y');
    expect(p.uncertain).toBe(true);
  });
});
