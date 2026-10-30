// Rapport- und Beso-Kästchen eines Tages (Vertrag E1-02d Abschnitt 2b «Beso-Zeitfenster», 2c, 2d Nr 3, Nr 4;
// Änderungsnotizen V05, V10; Beschrieb 4.6 «Rapport», «Beso im Detail»; F-62, R-4.6-42 bis -55).

import { relativeColumns } from '../../commands/columns';
import { formatTimeSpec, sortTime } from '../../time';
import type { Beso, BesoTimeWindow, Rapport } from '../../types';
import { timeToY } from '../grid/geometry';
import type { ColumnGeometry } from '../grid/types';
import { compareEntries, type DayContext, type Drawable, type EntriesContext } from './draft';
import { categoryFill } from './fill';
import { assignSlots } from './rects';
import { besoSpanSource, type DayPart, dayPart, rapportSpanSource } from './spans';

/** Rapport-Kästchen in der Rap-Spalte; gleichzeitige teilen die Spaltenbreite (V-02d-4). */
export function layoutRapportBoxes(ctx: EntriesContext, day: DayContext): Drawable[] {
  const rap = day.geo.columns.find((c) => c.kind === 'rap');
  if (rap === undefined) return [];
  const boxes: { readonly entry: Rapport; readonly part: DayPart }[] = [];
  for (const e of day.entries) {
    if (e.type !== 'rapport' || e.display === 'onlyInColumns') continue;
    const part = dayPart(rapportSpanSource(e.time), e.date, day.geo.date, ctx.v0, ctx.v1);
    if (part !== null) boxes.push({ entry: e, part });
  }
  boxes.sort((a, b) => a.part.drawn.from - b.part.drawn.from || compareEntries(a.entry, b.entry));
  const slots = assignSlots(boxes.map((b) => b.part.drawn));
  return boxes.map(({ entry, part }, i): Drawable => {
    const w = rap.w / (slots.count[i] as number);
    const y0 = timeToY(ctx.scale, part.drawn.from);
    const y1 = timeToY(ctx.scale, part.drawn.to);
    return {
      entryId: entry.id,
      type: 'rapport',
      group: 3,
      bandLevel: 0,
      date: day.geo.date,
      start: part.drawn.from,
      seq: entry.createdSeq,
      sub: 0,
      pieces: [
        {
          kind: 'rapportBox',
          date: day.geo.date,
          rect: { x: rap.x + (slots.slot[i] as number) * w, y: y0, w, h: y1 - y0 },
          span: part.span,
          part: 0,
          windowId: null,
          textCarrier: true,
          openTop: part.openTop,
          openBottom: part.openBottom,
          continuation: part.continuation,
          fill: categoryFill(ctx.plan, entry.categoryId),
          stroke: ctx.lines.rapportBorder,
          role: 'rapport',
          lineY: null,
          text: {
            kind: 'rapportBox',
            spec: {
              code: entry.code.trim(),
              timeLine: part.timeLine ? formatTimeSpec(entry.time, entry.date) : null,
              ort: entry.ort.trim(),
            },
          },
          obstacle: null,
        },
      ],
    };
  });
}

interface BoxItem {
  readonly beso: Beso;
  readonly timeWindow: BesoTimeWindow;
  readonly index: number;
  readonly part: DayPart;
  readonly column: ColumnGeometry;
}

/**
 * Spalte eines Zeitfensters (2b; V-02d-6, V10): ohne Spalte und bei einer Frist ohne Uhrzeit die Beso-Spalte;
 * sonst die Planungs- oder Nebenspalte nach `relativeColumns`, ohne sie die Beso-Spalte.
 */
function targetColumn(
  ctx: EntriesContext,
  day: DayContext,
  w: BesoTimeWindow,
): ColumnGeometry | undefined {
  const besoColumn = day.geo.columns.find((c) => c.kind === 'beso');
  const withoutTime = w.time.form === 'deadline' && w.time.to === undefined;
  if (withoutTime || w.columnId === null) return besoColumn;
  const chosen = relativeColumns(ctx.plan, { kind: 'ids', ids: [w.columnId] }, day.columns).find(
    (c) => c.kind === 'planning' || c.kind === 'secondary',
  );
  return chosen === undefined ? besoColumn : day.geo.columns.find((c) => c.columnId === chosen.id);
}

/** Beso-Kästchen je Zeitfenster; Bahnen und geteilte Breite je Spalte (2d Nr 4, F-62). */
export function layoutBesoBoxes(ctx: EntriesContext, day: DayContext): Drawable[] {
  const items: BoxItem[] = [];
  for (const e of day.entries) {
    if (e.type !== 'beso') continue;
    e.windows.forEach((w, index) => {
      const src = besoSpanSource(w, ctx.template, ctx.scale.fromMin);
      const part = dayPart(src, e.date, day.geo.date, ctx.v0, ctx.v1);
      const column = part === null ? undefined : targetColumn(ctx, day, w);
      if (part !== null && column !== undefined) {
        items.push({ beso: e, timeWindow: w, index, part, column });
      }
    });
  }
  const out: Drawable[] = [];
  for (const column of day.geo.columns) {
    const inColumn = items
      .filter((b) => b.column.columnId === column.columnId)
      .sort(
        (a, b) =>
          sortTime(a.timeWindow.time) - sortTime(b.timeWindow.time) ||
          compareEntries(a.beso, b.beso) ||
          a.index - b.index,
      );
    const slots = assignSlots(inColumn.map((b) => b.part.drawn));
    inColumn.forEach((b, i) => {
      const n = slots.count[i] as number;
      const k = slots.slot[i] as number;
      // Beso-Spalte: bis zwei Stellen die Bahnen (halbe Breite), ab drei B/n; sonst S/n (F-62, R-4.6-55).
      const w = column.kind === 'beso' && n <= 2 ? column.w / 2 : column.w / n;
      const y0 = timeToY(ctx.scale, b.part.drawn.from);
      const y1 = timeToY(ctx.scale, b.part.drawn.to);
      out.push({
        entryId: b.beso.id,
        type: 'beso',
        group: 4,
        bandLevel: 0,
        date: day.geo.date,
        start: b.part.drawn.from,
        seq: b.beso.createdSeq,
        sub: b.index,
        pieces: [
          {
            kind: 'besoBox',
            date: day.geo.date,
            rect: { x: column.x + k * w, y: y0, w, h: y1 - y0 },
            span: b.part.span,
            part: 0,
            windowId: b.timeWindow.id,
            textCarrier: true,
            openTop: b.part.openTop,
            openBottom: b.part.openBottom,
            continuation: b.part.continuation,
            fill: categoryFill(ctx.plan, b.beso.categoryId),
            stroke: ctx.lines.besoBoxBorder,
            role: 'besoBox',
            lineY: null,
            text: {
              kind: 'number',
              text: b.beso.besoNumber === null ? '–' : String(b.beso.besoNumber),
              weight: ctx.template.besoBox.numberBold ? 'bold' : 'regular',
            },
            obstacle:
              column.kind === 'planning' || column.kind === 'secondary' ? 'blockText' : null,
          },
        ],
      });
    });
  }
  return out;
}
