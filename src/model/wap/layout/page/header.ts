// Kopf der Wochen- und Fortsetzungsseite (Vertrag E1-02e, Notiz «Ausarbeitung Schritt 2» Abschnitt E1, D;
// R-10-07 bis -12, R-4.9-01, -07; B-Kp-17 bis -27; Änderungsnotiz Tests Schritt 3 S3-3, S3-4, S3-15, S3-16).
// Rein (R-L-02).

import { formatDate } from '../../calendar';
import { singleLineRuns } from '../entries/text';
import type { Rect } from '../pageModel';
import type { StyledRun } from '../text/types';
import {
  ascentPt,
  descentPt,
  lineHeightPt,
  lineItem,
  pageEvent,
  plainRuns,
  RegionBuilder,
  rectItem,
  runsText,
  textItem,
  width,
} from './common';
import { pageLage } from './geometryKpLage';
import { fitSingleLine, weekRangeText, weekTitle } from './texts';
import type { PageContext, PageTextKind, RegionLayout } from './types';

/** Ergebnis einer Einpassung; `runs` leer, wenn der Text entfällt. */
interface Fitted {
  readonly runs: readonly StyledRun[];
  readonly sizePt: number;
  readonly width: number;
}

/**
 * Kopf mit Stand-Feld; auf der Fortsetzungsseite «Fortsetzung – ‹week.label›» statt des Titels.
 * Formen (Titelrahmen, Klassifizierungsfeld, Kopf-Unterlinie) vor den Texten (D).
 */
export function layoutHeader(ctx: PageContext, page: 'week' | 'continuation'): RegionLayout {
  const { plan, week, template, geometry: g, frame: pf, options } = ctx;
  const lage = pageLage(g);
  const b = new RegionBuilder();
  const S = template.fontSizes.standard;
  const min = template.fontSizes.min;
  const text = g.colors.text;
  const fx = pf.frame.x;
  const fy = pf.frame.y;
  const right = pf.frame.x + pf.frame.w;
  const xS = pf.standCell.x;
  const yK = pf.header.y + pf.header.h;
  const h = pf.h;
  const cx = fx + pf.frame.w / 2;

  /** Einzeiliger Text in `widthPt`; Ereignis bei Kürzung oder Wegfall (V-02e-9). */
  const einpassen = (
    runs: readonly StyledRun[],
    widthPt: number,
    standard: number,
    field: PageTextKind,
  ): Fitted => {
    const lineRuns = singleLineRuns(runs);
    if (lineRuns.length === 0) return { runs: [], sizePt: standard, width: 0 };
    if (!(widthPt > 0)) {
      b.event(pageEvent('textOmitted', 'header', week.id, field));
      return { runs: [], sizePt: Math.min(standard, min), width: 0 };
    }
    const r = fitSingleLine(lineRuns, widthPt, { standard, min: Math.min(min, standard) });
    if (r.result === 'ellipsis' || r.result === 'omitted') {
      b.event(
        pageEvent(r.result === 'ellipsis' ? 'ellipsis' : 'textOmitted', 'header', week.id, field),
      );
    }
    return { runs: r.runs, sizePt: r.sizePt, width: width(r.runs, r.sizePt) };
  };

  const lineBox = (x: number, w: number, baseline: number, size: number): Rect => ({
    x,
    y: baseline - ascentPt(size),
    w,
    h: lineHeightPt(size),
  });

  // Erste Kopfzeile (S3-15): gemeinsame Grundlinie von «SCHWEIZER ARMEE», Klassifizierung und Einheit.
  const classStroke = g.pageLines.classificationFrame.widthPt;
  const row1 =
    fy +
    Math.max(
      lage.firstBaselineH * h,
      g.frameStroke.widthPt / 2 +
        lage.firstRowStrokeGap +
        classStroke / 2 +
        lage.classPadY +
        ascentPt(S),
    );
  const weekLineBaseline = yK - lage.weekLineAboveHeaderBottom;

  // Links: «SCHWEIZER ARMEE» (Q-012: Arimo fett) und Wochenzeile; rechts davon der Titelbereich.
  const armyRuns = plainRuns('SCHWEIZER ARMEE', 'bold');
  const weekRuns = plainRuns(weekRangeText(plan, week.id), 'bold');
  const wl = g.fontSizes.weekLine;
  const leftNeed = Math.max(lage.armyX + width(armyRuns, S), lage.weekLineX + width(weekRuns, wl));
  const leftRight = fx + Math.min(leftNeed, (cx - fx) / 2);
  const army = einpassen(armyRuns, leftRight - (fx + lage.armyX), S, 'army');
  const weekLine = einpassen(weekRuns, leftRight - (fx + lage.weekLineX), wl, 'weekLine');

  // Mitte: Titelrahmen, waagrecht auf die Rahmenmitte zentriert (B-Kp-20, -21; R-10-08).
  const half = Math.min(cx - leftRight, xS - cx) - lage.titleGap;
  const textWidth = 2 * half - 2 * lage.titlePadX;
  const titleKind: PageTextKind = page === 'week' ? 'title' : 'continuationTitle';
  const titleText =
    page === 'week' ? weekTitle(plan, week.id, template) : `Fortsetzung – ${week.label}`;
  const title = einpassen(plainRuns(titleText, 'bold'), textWidth, g.fontSizes.title, titleKind);
  const beilageText = runsText(singleLineRuns(plainRuns(plan.beilage, 'regular')));
  const beilageLine =
    beilageText === ''
      ? ''
      : beilageText.startsWith('Beilage')
        ? beilageText
        : `Beilage ${beilageText}`;
  const beilage = einpassen(
    plainRuns(beilageLine, 'regular'),
    textWidth,
    g.fontSizes.beilage,
    'beilage',
  );
  const frameW = Math.max(title.width, beilage.width) + 2 * lage.titlePadX;
  const titleStroke = g.pageLines.titleFrame;
  const titleRect: Rect = {
    x: cx - frameW / 2,
    y: fy + lage.titleTop,
    w: frameW,
    h: lage.titleHeightH * h,
  };
  b.shape(rectItem('header', titleRect, null, titleStroke));

  // Rechts: Klassifizierung und Einheit im Stand-Feld [xS + 0,4, K] (S3-16, V-02e-17).
  const K = right - lage.rightTextInset;
  const cellLeft = xS + lage.standX;
  const classRuns = singleLineRuns(plainRuns(plan.classification, 'bold'));
  const classFit =
    classRuns.length === 0
      ? null
      : einpassen(
          classRuns,
          (K - cellLeft) / 2 - 2 * lage.classPadX - classStroke,
          S,
          'classification',
        );
  const classPresent = classFit !== null && classFit.runs.length > 0;
  const F = classPresent ? classFit.width + 2 * lage.classPadX : 0;
  const unitAvail = K - cellLeft - (classPresent ? F + classStroke + lage.classGap : 0);
  const unit = einpassen(plainRuns(plan.unit, 'regular'), unitAvail, S, 'unit');
  const unitX = K - unit.width;
  let classRect: Rect | null = null;
  if (classPresent) {
    const size = classFit.sizePt;
    const desc = descentPt(size);
    classRect = {
      x: unitX - lage.classGap - F,
      y: row1 - ascentPt(size) - lage.classPadY,
      w: F,
      h: ascentPt(size) + desc + 2 * lage.classPadY,
    };
    b.shape(rectItem('header', classRect, null, g.pageLines.classificationFrame));
  }

  // Kopf-Unterlinie von Rahmen links bis xS (B-Kp-27).
  b.shape(lineItem('header', fx, yK, xS, yK, g.pageLines.headerBottom));

  // Texte.
  b.text(
    textItem({
      role: 'header',
      x: fx + lage.armyX,
      baselineY: row1,
      sizePt: army.sizePt,
      runs: army.runs,
      color: text,
      frame: lineBox(fx + lage.armyX, leftRight - (fx + lage.armyX), row1, army.sizePt),
    }),
    'army',
    S,
    null,
  );
  b.text(
    textItem({
      role: 'header',
      x: fx + lage.weekLineX,
      baselineY: weekLineBaseline,
      sizePt: weekLine.sizePt,
      runs: weekLine.runs,
      color: text,
      frame: lineBox(
        fx + lage.weekLineX,
        leftRight - (fx + lage.weekLineX),
        weekLineBaseline,
        weekLine.sizePt,
      ),
    }),
    'weekLine',
    wl,
    null,
  );

  // Zeilenblock senkrecht in der Rahmenmitte, jede Zeile im Rahmen zentriert (E1).
  const titleLh = lineHeightPt(title.sizePt);
  const beilageLh = beilage.runs.length === 0 ? 0 : lineHeightPt(beilage.sizePt);
  const innerTop = titleRect.y + titleStroke.widthPt / 2;
  const innerH = titleRect.h - titleStroke.widthPt;
  const blockTop = innerTop + (innerH - titleLh - beilageLh) / 2;
  const textLeft = cx - textWidth / 2;
  const titleBaseline = blockTop + ascentPt(title.sizePt);
  b.text(
    textItem({
      role: page === 'week' ? 'header' : 'continuation',
      x: cx - title.width / 2,
      baselineY: titleBaseline,
      sizePt: title.sizePt,
      runs: title.runs,
      color: text,
      frame: lineBox(textLeft, textWidth, titleBaseline, title.sizePt),
    }),
    titleKind,
    g.fontSizes.title,
    null,
  );
  const beilageBaseline = blockTop + titleLh + ascentPt(beilage.sizePt);
  b.text(
    textItem({
      role: 'header',
      x: cx - beilage.width / 2,
      baselineY: beilageBaseline,
      sizePt: beilage.sizePt,
      runs: beilage.runs,
      color: text,
      frame: lineBox(textLeft, textWidth, beilageBaseline, beilage.sizePt),
    }),
    'beilage',
    g.fontSizes.beilage,
    null,
  );

  if (classPresent && classRect !== null) {
    b.text(
      textItem({
        role: 'header',
        x: classRect.x + lage.classPadX,
        baselineY: row1,
        sizePt: classFit.sizePt,
        runs: classFit.runs,
        color: text,
        frame: classRect,
      }),
      'classification',
      S,
      null,
    );
  }
  b.text(
    textItem({
      role: 'header',
      x: unitX,
      baselineY: row1,
      sizePt: unit.sizePt,
      runs: unit.runs,
      color: text,
      frame: lineBox(K - unitAvail, unitAvail, row1, unit.sizePt),
    }),
    'unit',
    S,
    null,
  );

  // Stand (B-Kp-26, V21, V-02e-5): «Stand» links bei xS + 0,4, Datum rechtsbündig an K, gleiche Grundlinie.
  const standY = fy + lage.standBaselineH * h;
  const standFrameW = K - cellLeft;
  const standDate = options.standOverride?.date ?? plan.stand?.date ?? null;
  const dateText = standDate === null ? 'Entwurf' : formatDate(standDate, 'long');
  const standLabel = einpassen(plainRuns('Stand', 'bold'), standFrameW, S, 'stand');
  const standValue = einpassen(plainRuns(dateText, 'bold'), standFrameW, S, 'stand');
  const standFrame = (size: number): Rect => lineBox(cellLeft, standFrameW, standY, size);
  b.text(
    textItem({
      role: 'header',
      x: cellLeft,
      baselineY: standY,
      sizePt: standLabel.sizePt,
      runs: standLabel.runs,
      color: template.standColor,
      frame: standFrame(standLabel.sizePt),
    }),
    'stand',
    S,
    null,
  );
  b.text(
    textItem({
      role: 'header',
      x: K - standValue.width,
      baselineY: standY,
      sizePt: standValue.sizePt,
      runs: standValue.runs,
      color: template.standColor,
      frame: standFrame(standValue.sizePt),
    }),
    'stand',
    S,
    null,
  );
  return b.build();
}
