// @vitest-environment jsdom
// F-UX1 Runde 2 (code-reviewer Daten Runde 2): Nicht übernommener Text erscheint im lokalen Importbericht.
// - CR-D-2-02: Eine ganz rot gestrichene Zeile ohne Nummer nach einem gestrichenen Termin entfiel ohne Meldung; jetzt
//   eine Meldung «partlyCancelled» … «nicht übernommen» (keine Formbilanz, Importquote unverändert).
// - CR-D-2-04: Der Bericht zu nicht sichtbaren Wochenzielen (Entscheid 9) nannte nur Anzahl Zeilen und Zeichen; jetzt
//   zeigt der Bericht in der Oberfläche den Text der nicht übernommenen Zeilen. Der Text steht nur im eigenen Feld
//   `notTakenText` (Anzeige), nie in der Meldung (die in Prüfausgaben erscheinen kann). Fiktive Arbeitsmappen.
import { render, within } from '@testing-library/react';
import { createElement } from 'react';
import { beforeAll, describe, expect, it } from 'vitest';
import { ImportReportDialog } from '../../../../src/components/wap/import/ExcelImport';
import {
  besoBox,
  emptyWeek,
  GRID_ROW_EMU,
  geometryOf,
  HEADER_ROW_EMU,
  HEADER_ROWS,
  normal,
  rawShape,
} from '../../fixtures/import/kp-workbook';
import { besos, importWeeks, titleOf } from '../import/support';

const ROT = 'C00000';

beforeAll(() => {
  const proto = HTMLDialogElement.prototype as unknown as {
    showModal?: () => void;
    close?: () => void;
  };
  proto.showModal = function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  proto.close = function (this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
});

function zweiZeilen(strike: boolean) {
  const color = strike ? ROT : undefined;
  return importWeeks([
    emptyWeek({
      shapes: [besoBox(0, 4, '0900', 10)],
      agenda: [
        {
          day: 0,
          paragraphs: [
            [{ text: '10 0900: Alt fiktiv,', strike, ...(color === undefined ? {} : { color }) }],
            [{ text: 'Ort: Halle fiktiv.', strike, ...(color === undefined ? {} : { color }) }],
          ],
        },
      ],
    }),
  ]);
}

const base = emptyWeek();
const g = geometryOf(base);
const sx0 = g.colX(g.sideCol);
const sx1 = g.colX(g.sideCol + 3);
const rowY = (r: number): number =>
  r <= HEADER_ROWS
    ? r * HEADER_ROW_EMU
    : HEADER_ROWS * HEADER_ROW_EMU + (r - HEADER_ROWS) * GRID_ROW_EMU;
const LINE = 8 * 1.2 * 12700;
const Y0 = rowY(7);
const goalsBox = (x0: number, y0: number, x1: number, y1: number, texts: readonly string[]) =>
  rawShape(x0, y0, x1, y1, { fill: null, paragraphs: texts.map((t) => [normal(`- ${t}`)]) });
const VERDECKT = ['Zusatzziel eins (fiktiv)', 'Zusatzziel zwei (fiktiv)'];

function wochenziele() {
  return importWeeks([
    {
      ...base,
      rawShapes: [
        goalsBox(sx0, Y0, sx1, Y0 + 6 * LINE, ['Ausbildung abschliessen']),
        goalsBox(sx1, Y0, sx1 + 919, rowY(24), VERDECKT),
      ],
    },
  ]);
}

describe('F-UX1 Runde 2: nicht übernommener Text im Importbericht', () => {
  it('[R-8.2-20] CR-D-2-02: ganz gestrichene Folgezeile eines gestrichenen Termins → Meldung «nicht übernommen» mit dem Text; Bilanz unverändert', () => {
    const o = zweiZeilen(true);
    const beso = besos(o.result.plan)[0];
    expect(beso?.status).toBe('cancelled');
    expect(beso === undefined ? '' : titleOf(beso)).toContain('Alt fiktiv');
    const m = o.report.items.filter(
      (i) => i.kind === 'partlyCancelled' && i.message.cause.includes('nicht übernommen'),
    );
    expect(m).toHaveLength(1);
    expect(m[0]?.besoNumber).toBe(10);
    expect(m[0]?.date).toBe(o.result.plan.weeks[0]?.startDate);
    expect(m[0]?.message.nextStep).not.toBe('');
    expect(m[0]?.notTakenText).toEqual(['Ort: Halle fiktiv.']);
    expect(m[0]?.message.cause).not.toContain('Halle');
    // Formbilanz und Quote: die Meldung ist keine nicht zugeordnete Form.
    expect(o.report.sheets.map((s) => s.unassigned)).toEqual(
      zweiZeilen(false).report.sheets.map((s) => s.unassigned),
    );
    // Ungestrichen bleibt es eine Folgezeile ohne diese Meldung.
    expect(
      zweiZeilen(false).report.items.filter((i) => i.message.cause.includes('nicht übernommen')),
    ).toEqual([]);
  });

  it('[R-4.2-04] CR-D-2-04: «nicht sichtbar, nicht übernommen» trägt den Text der Zeilen im Feld notTakenText, nicht in der Meldung', () => {
    const o = wochenziele();
    const nv = o.report.items.filter((i) => i.kind === 'notVisible');
    expect(nv).toHaveLength(1);
    expect(nv[0]?.notTakenText).toEqual(VERDECKT);
    expect(nv[0]?.message.cause).toContain('2 Zeilen');
    for (const t of VERDECKT) expect(nv[0]?.message.cause).not.toContain(t);
  });

  it('[R-4.2-04][R-8.2-20] der Importbericht zeigt den nicht übernommenen Text je Meldung (nur Oberfläche)', () => {
    const o = wochenziele();
    const r = render(
      createElement(ImportReportDialog, {
        report: o.report,
        plan: o.result.plan,
        onClose: () => undefined,
        onJump: () => undefined,
      }),
    );
    const liste = r.getByRole('list', { name: 'Nicht übernommener Text' });
    expect(
      within(liste)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(VERDECKT);
    r.unmount();
  });
});
