// @vitest-environment jsdom
// F-FIX Runde 4: Befund CR-4-05 (code-reviewer-4) zu R-8.2-44 und R-4.6-15. Ein unsichtbarer Linienrest von wenigen
// hundert EMU darf den Marker nicht übernehmen, auch wenn er die Zeit um Bruchteile einer Minute besser trifft: Als
// Linie zählt erst, was mindestens 10 % der schmalsten Planungsspalte des Tags lang ist; liegen zwei Linien innerhalb
// von 2 Min, gewinnt die längere. Frei erfundene Arbeitsmappen.
import { describe, expect, it } from 'vitest';
import type { Marker } from '../../../../src/model/wap/types';
import {
  block,
  COL_EMU,
  emptyWeek,
  geometryOf,
  HEADER_ROWS,
  MINUTE_EMU,
  minutes,
  normal,
  type WeekDef,
  yOf,
} from '../../fixtures/import/kp-workbook';
import { entries, importWeeks } from '../import/support';

const g = geometryOf(emptyWeek());
const START = g.dayStart[0] ?? 1;
/** Linke Kante von Kdo und rechte Kante von Bravo (alle drei Planungsspalten des Tags). */
const X0 = g.colX(START) + 3000;
const X1 = g.colX(START + 3) - 3000;

function punkt(tag: 'from' | 'to', x: number, minute: number): string {
  const col = Math.floor(x / COL_EMU);
  const ab = minute - 240;
  const row = HEADER_ROWS + Math.floor(ab / 15);
  const rowOff = Math.round((ab % 15) * MINUTE_EMU);
  return `<xdr:${tag}><xdr:col>${col}</xdr:col><xdr:colOff>${Math.round(x - col * COL_EMU)}</xdr:colOff><xdr:row>${row}</xdr:row><xdr:rowOff>${rowOff}</xdr:rowOff></xdr:${tag}>`;
}

let id = 8000;
function cxn(x0: number, y: number, cx: number, flip = ''): string {
  return (
    `<xdr:cxnSp macro=""><xdr:nvCxnSpPr><xdr:cNvPr id="${id++}" name="Linie fiktiv"/><xdr:cNvCxnSpPr/></xdr:nvCxnSpPr>` +
    `<xdr:spPr><a:xfrm${flip}><a:off x="${Math.round(x0)}" y="${Math.round(y)}"/><a:ext cx="${Math.round(cx)}" cy="0"/></a:xfrm>` +
    `<a:prstGeom prst="line"><a:avLst/></a:prstGeom><a:ln w="38100"><a:solidFill><a:srgbClr val="000000"/></a:solidFill></a:ln></xdr:spPr></xdr:cxnSp>`
  );
}

/** Linie von `x0` bis `x1` bei `minute` (Anker zwei Zellen). */
const linie = (x0: number, x1: number, minute: number): string =>
  `<xdr:twoCellAnchor>${punkt('from', x0, minute)}${punkt('to', x1, minute)}${cxn(x0, yOf(minute), x1 - x0)}<xdr:clientData/></xdr:twoCellAnchor>`;

/** Woche mit der Beschriftung «AV» 0700–0715 in Bravo und den Linien in Dokumentreihenfolge. */
function woche(linien: readonly string[]): WeekDef {
  return emptyWeek({
    shapes: [block(0, [2, 2], '0700', '0715', [[normal('AV')]])],
    rawShapes: linien,
  });
}

const marker = (w: WeekDef): Marker | undefined =>
  entries(importWeeks([w]).result.plan).find((e): e is Marker => e.type === 'marker');

/** Linker Rand von Bravo (dritte Planungsspalte). */
const BRAVO0 = g.colX(START + 2) + 3000;

describe('F-FIX Runde 4: Linienrest und Vorrang der längeren Linie (CR-4-05, R-8.2-44)', () => {
  it('[R-8.2-44][R-4.6-15] Linienrest von 500 EMU genau auf 0700, echte Linie 0703 (ausserhalb 2 Min): Rest zählt nicht, Marker über alle Spalten', () => {
    const m = marker(woche([linie(X1 - 500, X1, minutes('0700')), linie(X0, X1, minutes('0703'))]));
    expect(m).toMatchObject({ kind: 'AV', at: 425, columns: { kind: 'all' } });
  });

  it('[R-8.2-44][R-4.6-15] Zwei Linien innerhalb von 2 Min: die längere gewinnt (kurze 0703 über Bravo, lange 0701 über alle)', () => {
    // Entscheid Auftraggeber 21.10.2026: Marker gelten immer über alle Planungsspalten; welche Linie gewinnt, zeigt
    // deshalb die Zeit (lange 0701 → 0700, kurze 0703 → 0705), nicht mehr die Spaltenwahl.
    const m = marker(woche([linie(BRAVO0, X1, minutes('0703')), linie(X0, X1, minutes('0701'))]));
    expect(m).toMatchObject({ kind: 'AV', at: 420, columns: { kind: 'all' } });
  });

  it('[R-8.2-44][R-4.6-15] Gegenprobe: kurze echte Linie über eine Spalte allein bleibt Linienmarker, gilt aber über alle Spalten', () => {
    const m = marker(woche([linie(BRAVO0, X1, minutes('0700'))]));
    expect(m).toMatchObject({ kind: 'AV', at: 420, columns: { kind: 'all' } });
  });

  it('[R-8.2-44][R-4.6-15] Gegenprobe: Linien mehr als 2 Min auseinander: die zeitlich nähere gewinnt, auch wenn sie kürzer ist', () => {
    const m = marker(woche([linie(BRAVO0, X1, minutes('0700')), linie(X0, X1, minutes('0705'))]));
    expect(m).toMatchObject({ kind: 'AV', at: 420, columns: { kind: 'all' } });
  });
});
