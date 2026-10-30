// Querbalken im Band (Vertrag E1-02d Abschnitt 2d Nr 1; Änderungsnotizen V04, V06 a, V11, Runde 2 V17;
// Beschrieb 4.5, 4.6 «Querbalken»; B-F-06, F-63 c/d, Q-013).

import { resolveTitle } from '../../derive/agenda';
import type { Id, IsoDate, Querbalken } from '../../types';
import { timeToY } from '../grid/geometry';
import type { FallbackEvent } from '../grid/types';
import type { Rect } from '../pageModel';
import { runsOf, selectColumns } from './columns';
import {
  compareEntries,
  type DayContext,
  type Drawable,
  type EntriesContext,
  type PieceDraft,
} from './draft';
import { categoryFill } from './fill';
import { largest } from './rects';
import { singleLineRuns, styledRuns } from './text';

/** Höhe einer Lage im Band in Minuten (Lage 0 = zweite, Lage 1 = erste halbe Stunde, B-F-06). */
const BAND_LEVEL_MINUTES = 30;
const BAND_LEVELS = [0, 1] as const;

export interface QuerbalkenResult {
  readonly drawables: readonly Drawable[];
  readonly bandEvents: readonly FallbackEvent[];
}

/** Querbalken mit mindestens einem sichtbaren Tag der Woche, nach Erfassung. */
function querbalkenOfWeek(ctx: EntriesContext): Querbalken[] {
  const seen = new Map<Id, Querbalken>();
  for (const day of ctx.days) {
    for (const e of day.entries) if (e.type === 'querbalken') seen.set(e.id, e);
  }
  return [...seen.values()].sort(compareEntries);
}

/** Lagen, Flächen und Band-Ereignisse aller Querbalken der Woche (F-63 d: eine Lage je Woche). */
export function layoutQuerbalken(ctx: EntriesContext, weekId: Id): QuerbalkenResult {
  const occupied = new Map<IsoDate, Set<number>>(ctx.days.map((d) => [d.geo.date, new Set()]));
  const levelsAt = (d: DayContext): Set<number> => occupied.get(d.geo.date) ?? new Set();
  const drawables: Drawable[] = [];
  const bandEvents: FallbackEvent[] = [];
  for (const q of querbalkenOfWeek(ctx)) {
    const days = ctx.days.filter((d) => q.fromDate <= d.geo.date && d.geo.date <= q.toDate);
    const first = days[0];
    if (first === undefined) continue;
    const bandLevel = BAND_LEVELS.find((l) => days.every((d) => !levelsAt(d).has(l)));
    if (bandLevel === undefined) {
      // V04, V17: Ereignis an jedem Tag mit beiden Lagen belegt, sonst am ersten sichtbaren Tag.
      const full = days.filter((d) => BAND_LEVELS.every((l) => levelsAt(d).has(l)));
      const event = (kind: FallbackEvent['kind'], date: IsoDate): FallbackEvent => ({
        kind,
        region: 'band',
        weekId,
        date,
        entryId: q.id,
        piece: null,
        dropped: [],
      });
      if (full.length > 0) for (const d of full) bandEvents.push(event('bandOverflow', d.geo.date));
      else bandEvents.push(event('bandNoCommonLane', first.geo.date));
      continue;
    }
    for (const d of days) levelsAt(d).add(bandLevel);
    drawables.push(querbalkenDrawable(ctx, q, days, bandLevel));
  }
  return { drawables, bandEvents };
}

function querbalkenDrawable(
  ctx: EntriesContext,
  q: Querbalken,
  days: readonly DayContext[],
  bandLevel: number,
): Drawable {
  const from = ctx.scale.fromMin + BAND_LEVEL_MINUTES * (1 - bandLevel);
  const y = timeToY(ctx.scale, from);
  const h = timeToY(ctx.scale, from + BAND_LEVEL_MINUTES) - y;
  const areas: { readonly date: IsoDate; readonly rect: Rect }[] = [];
  if (q.columns.kind === 'all') {
    // V-02d-1: ein Teilstück über die ganze Breite seiner sichtbaren Tage.
    const first = days[0] as DayContext;
    const last = days.at(-1) as DayContext;
    areas.push({
      date: first.geo.date,
      rect: { x: first.geo.x, y, w: last.geo.x + last.geo.w - first.geo.x, h },
    });
  } else {
    for (const d of days) {
      for (const run of runsOf(selectColumns(ctx.plan, q.columns, d.columns), d.geo)) {
        areas.push({ date: d.geo.date, rect: { x: run.x, y, w: run.w, h } });
      }
    }
  }
  const carrier = largest(areas.map((a) => a.rect));
  const head = singleLineRuns(styledRuns(resolveTitle(ctx.plan, q.title)));
  const fill = categoryFill(ctx.plan, q.categoryId);
  const pieces = areas.map(
    (a, i): PieceDraft => ({
      kind: 'querbalken',
      date: a.date,
      rect: a.rect,
      span: null,
      part: i,
      windowId: null,
      textCarrier: i === carrier,
      openTop: false,
      openBottom: false,
      continuation: 'none',
      fill,
      stroke: ctx.lines.querbalkenBorder,
      role: 'querbalken',
      lineY: null,
      text: i === carrier ? { kind: 'singleLine', head, tail: [] } : null,
      obstacle: null,
    }),
  );
  return {
    entryId: q.id,
    type: 'querbalken',
    group: 1,
    bandLevel,
    date: (days[0] as DayContext).geo.date,
    start: from,
    seq: q.createdSeq,
    sub: 0,
    pieces,
  };
}
