// Darstellung der Einträge eines Tages im Bildschirmraster (I2b-A A6, A7; Beschrieb 4.6).
// Blöcke mit Aussparung (Teilstücke) und Nebeneinander bei gleichen Spalten, Rapporte in der Rap-Spalte
// (Höhe = Dauer, mindestens 30 Min), Beso-Kästchen je Zeitfenster, Marker als Linie, Querbalken im Band.

import { daysBetween, weekdayOf } from '../../../model/wap/calendar';
import { relativeColumns } from '../../../model/wap/commands/columns';
import { resolveTitle } from '../../../model/wap/derive/agenda';
import { MARKER_COLUMNS, markerLabel } from '../../../model/wap/derive/marker';
import { besoBoxSpan } from '../../../model/wap/layout/entries/besoBox';
import { categoryFill, textColorForFill } from '../../../model/wap/layout/entries/fill';
import { assignSlots, largest, subtract } from '../../../model/wap/layout/entries/rects';
import type { LevelTemplate } from '../../../model/wap/template';
import { formatMilTime, formatTimeSpec } from '../../../model/wap/time';
import type {
  Block,
  ColumnSelection,
  Entry,
  Id,
  Plan,
  Querbalken,
  RichText,
  TimeSpec,
} from '../../../model/wap/types';
import type { ColumnBox, DayBox, Scale } from './geometry';
import type { LayoutRender } from './layoutViews';

export type ViewKind = 'block' | 'rapport' | 'beso' | 'marker' | 'querbalken';

/** Kennung der Ansicht eines Rapports in den Planungsspalten (Anzeige «auch/nur in Spalten», Beschrieb 4.6). */
export const RAPPORT_IN_COLUMNS = 'inColumns';

export interface Rect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface EntryView {
  readonly key: string;
  readonly id: Id;
  readonly windowId: Id | null;
  readonly kind: ViewKind;
  readonly label: string;
  readonly text: string;
  readonly sub: string;
  readonly rect: Rect;
  /** Teilstücke relativ zu `rect` (Aussparung); leer = ganzes Rechteck. */
  readonly pieces: readonly Rect[];
  readonly textPiece: number;
  readonly fill: string;
  readonly ink: string;
  readonly z: number;
  readonly from: number;
  readonly to: number;
  /** Nur Querbalken: erster bzw. letzter Tag dieses Abschnitts. */
  readonly first: boolean;
  readonly last: boolean;
  readonly cancelled: boolean;
  /** Seit dem letzten Stand geändert (Marke «geändert», UI-Richtlinie 4.2; nur Bildschirm). */
  readonly changed?: boolean;
  /** Darstellung aus der Layout-Schicht (E1-02l); fehlt nur bei Vorschauen ohne Layout. */
  readonly render?: LayoutRender;
  /** Teilstücke der Layout-Schicht relativ zum Tag (Trefferflächen ohne Aussparungen, F-UX2 P4). */
  readonly hitRects?: readonly Rect[];
}

export interface Span {
  readonly from: number;
  readonly to: number;
}

export function plainTitle(plan: Plan, title: RichText): string {
  return resolveTitle(plan, title)
    .map((r) => r.text)
    .join('');
}

export function blockSpan(time: Block['time'], plan: Plan): Span {
  switch (time.form) {
    case 'range':
      return { from: time.from, to: time.to };
    case 'point':
      return { from: time.at, to: time.at + 30 };
    case 'from':
      return { from: time.from, to: plan.displayRange.to };
    case 'until':
      return { from: plan.displayRange.from, to: time.to };
  }
}

export function rapportSpan(time: TimeSpec): Span {
  if (time.form === 'range') return { from: time.from, to: Math.max(time.to, time.from + 30) };
  if (time.form === 'point') return { from: time.at, to: time.at + 30 };
  return { from: 0, to: 30 };
}

function rgb(c: { r: number; g: number; b: number }): string {
  return `rgb(${c.r} ${c.g} ${c.b})`;
}

/** Linke Kante und Breite der Spalten einer Auswahl am Tag (fehlende an relativer Lage). */
export function columnsRect(
  plan: Plan,
  day: DayBox,
  sel: ColumnSelection,
): { left: number; width: number; ids: readonly Id[] } {
  const resolved = relativeColumns(
    plan,
    sel,
    day.columns.map((c) => c.column),
  );
  const chosen = new Set(resolved.map((c) => c.id));
  const boxes = day.columns.filter((c) => chosen.has(c.column.id));
  const first = boxes[0];
  const last = boxes[boxes.length - 1];
  if (first === undefined || last === undefined) {
    const p = day.planning[0];
    return { left: p?.left ?? 0, width: p?.width ?? day.width, ids: [] };
  }
  return {
    left: first.left,
    width: last.left + last.width - first.left,
    ids: resolved.map((c) => c.id),
  };
}

function kindColumn(day: DayBox, kind: 'rap' | 'beso'): ColumnBox | undefined {
  return day.columns.find((c) => c.column.kind === kind);
}

function yOf(minute: number, plan: Plan, scale: Scale): number {
  return (minute - plan.displayRange.from) * scale.minute;
}

function clipRect(span: Span, left: number, width: number, plan: Plan, scale: Scale): Rect | null {
  const from = Math.max(plan.displayRange.from, span.from);
  const to = Math.min(plan.displayRange.to, span.to);
  if (to <= from) return null;
  return { left, top: yOf(from, plan, scale), width, height: (to - from) * scale.minute };
}

interface BlockItem {
  readonly block: Block;
  readonly span: Span;
  readonly left: number;
  readonly width: number;
  readonly ids: readonly Id[];
}

function subsetOf(a: readonly Id[], b: readonly Id[]): boolean {
  return a.length < b.length && a.every((id) => b.includes(id));
}

function blockViews(plan: Plan, day: DayBox, blocks: readonly Block[], scale: Scale): EntryView[] {
  const items: BlockItem[] = blocks.map((block) => {
    const { left, width, ids } = columnsRect(plan, day, block.columns);
    return { block, span: blockSpan(block.time, plan), left, width, ids };
  });
  // Nebeneinander nur bei genau denselben Spalten (Beschrieb 4.6).
  const slots = new Map<Id, { slot: number; count: number }>();
  const groups = new Map<string, BlockItem[]>();
  for (const item of items) {
    const key = item.ids.join(',');
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  for (const group of groups.values()) {
    const sorted = [...group].sort(
      (a, b) => a.span.from - b.span.from || a.block.createdSeq - b.block.createdSeq,
    );
    const r = assignSlots(sorted.map((i) => i.span));
    sorted.forEach((item, i) => {
      slots.set(item.block.id, { slot: r.slot[i] ?? 0, count: r.count[i] ?? 1 });
    });
  }
  const maxCols = Math.max(1, ...items.map((i) => i.ids.length));
  const out: EntryView[] = [];
  for (const item of items) {
    const s = slots.get(item.block.id) ?? { slot: 0, count: 1 };
    const laneWidth = item.width / s.count;
    const rect = clipRect(item.span, item.left + s.slot * laneWidth, laneWidth, plan, scale);
    if (rect === null) continue;
    // Ausnahme: schmalere Blöcke in Teilmengen der Spalten sparen diesen Block aus (Teilstücke).
    const holes = items
      .filter(
        (o) =>
          o !== item &&
          subsetOf(o.ids, item.ids) &&
          o.span.from < item.span.to &&
          item.span.from < o.span.to,
      )
      .map((o) => {
        const r = clipRect(o.span, o.left, o.width, plan, scale);
        return r === null ? null : { x: r.left, y: r.top, w: r.width, h: r.height };
      })
      .filter((r): r is { x: number; y: number; w: number; h: number } => r !== null);
    const parts =
      holes.length === 0
        ? []
        : subtract({ x: rect.left, y: rect.top, w: rect.width, h: rect.height }, holes).map(
            (p) => ({
              left: p.x - rect.left,
              top: p.y - rect.top,
              width: p.w,
              height: p.h,
            }),
          );
    const textPiece =
      parts.length === 0
        ? 0
        : largest(parts.map((p) => ({ x: p.left, y: p.top, w: p.width, h: p.height })));
    const fill = categoryFill(plan, item.block.categoryId);
    const title = plainTitle(plan, item.block.title);
    out.push({
      key: item.block.id,
      id: item.block.id,
      windowId: null,
      kind: 'block',
      label: `Block ${title || 'ohne Titel'} ${formatTimeSpec(item.block.time, item.block.date)} · ${day.weekday}`,
      text: title,
      sub: item.block.supplement,
      rect,
      pieces: parts,
      textPiece: Math.max(0, textPiece),
      fill: rgb(fill),
      ink: rgb(textColorForFill(fill)),
      z: 2 + (maxCols - item.ids.length),
      from: item.span.from,
      to: item.span.to,
      first: true,
      last: true,
      cancelled: item.block.status === 'cancelled',
      changed: item.block.changed,
    });
  }
  return out;
}

/** Querbalken-Bahnen der Woche in Erfassungsreihenfolge (Beschrieb 4.6 «mehrere übereinander»). */
export function querbalkenLanes(
  bars: readonly Querbalken[],
): ReadonlyMap<Id, { lane: number; lanes: number }> {
  const sorted = [...bars].sort((a, b) => a.createdSeq - b.createdSeq);
  const spans = sorted.map((q) => ({
    from: daysBetween('2000-01-03', q.fromDate),
    to: daysBetween('2000-01-03', q.toDate) + 1,
  }));
  const r = assignSlots(spans);
  const lanes = Math.max(1, ...r.slot.map((s) => s + 1));
  const out = new Map<Id, { lane: number; lanes: number }>();
  sorted.forEach((q, i) => {
    out.set(q.id, { lane: r.slot[i] ?? 0, lanes });
  });
  return out;
}

export function dayViews(
  plan: Plan,
  day: DayBox,
  entries: readonly Entry[],
  scale: Scale,
  template: LevelTemplate,
  lanes: ReadonlyMap<Id, { lane: number; lanes: number }>,
): readonly EntryView[] {
  const out: EntryView[] = [];
  const blocks = entries.filter((e): e is Block => e.type === 'block' && e.date === day.date);
  out.push(...blockViews(plan, day, blocks, scale));
  const rap = kindColumn(day, 'rap');
  const besoColumn = kindColumn(day, 'beso');
  const besoItems: { view: Omit<EntryView, 'rect'>; span: Span; column: ColumnBox | undefined }[] =
    [];
  for (const e of entries) {
    if (e.type === 'rapport' && e.date === day.date && e.display !== 'rapColumn') {
      // Derselbe Rapport zusätzlich bzw. nur als Block in den gewählten Spalten (ein Objekt, Beschrieb 4.6).
      const span = rapportSpan(e.time);
      const { left, width } = columnsRect(plan, day, e.displayColumns);
      const rect = clipRect(span, left, width, plan, scale);
      const fill = categoryFill(plan, e.categoryId);
      if (rect !== null)
        out.push({
          key: `${e.id}:${RAPPORT_IN_COLUMNS}`,
          id: e.id,
          windowId: RAPPORT_IN_COLUMNS,
          kind: 'rapport',
          label: `Rapport ${e.code} ${formatTimeSpec(e.time, e.date)} · ${day.weekday} · in Spalten`,
          text: e.code,
          sub: e.ort === '' ? '' : `(${e.ort})`,
          rect,
          pieces: [],
          textPiece: 0,
          fill: rgb(fill),
          ink: rgb(textColorForFill(fill)),
          z: 3,
          from: span.from,
          to: span.to,
          first: true,
          last: true,
          cancelled: e.status === 'cancelled',
          changed: e.changed,
        });
    }
    if (e.type === 'rapport' && e.date === day.date && rap !== undefined) {
      if (e.display === 'onlyInColumns') continue;
      const span = rapportSpan(e.time);
      const rect = clipRect(span, rap.left, rap.width, plan, scale);
      if (rect === null) continue;
      const fill = categoryFill(plan, e.categoryId);
      out.push({
        key: e.id,
        id: e.id,
        windowId: null,
        kind: 'rapport',
        label: `Rapport ${e.code} ${formatTimeSpec(e.time, e.date)} · ${day.weekday}`,
        text: e.code,
        sub: e.ort === '' ? '' : `(${e.ort})`,
        rect,
        pieces: [],
        textPiece: 0,
        fill: rgb(fill),
        ink: rgb(textColorForFill(fill)),
        z: 6,
        from: span.from,
        to: span.to,
        first: true,
        last: true,
        cancelled: e.status === 'cancelled',
        changed: e.changed,
      });
    } else if (e.type === 'beso' && e.date === day.date) {
      const fill = categoryFill(plan, e.categoryId);
      const title = plainTitle(plan, e.title);
      for (const w of e.windows) {
        const span = besoBoxSpan(w.time, template, plan.displayRange.from);
        const column =
          w.columnId === null
            ? besoColumn
            : (day.columns.find((c) => c.column.id === w.columnId) ?? besoColumn);
        besoItems.push({
          view: {
            key: `${e.id}:${w.id}`,
            id: e.id,
            windowId: w.id,
            kind: 'beso',
            label: `Beso ${e.besoNumber ?? '–'} ${title} ${formatTimeSpec(w.time, e.date)} · ${day.weekday}`,
            text: e.besoNumber === null ? '–' : String(e.besoNumber),
            sub: '',
            pieces: [],
            textPiece: 0,
            fill: rgb(fill),
            ink: rgb(textColorForFill(fill)),
            z: 7,
            from: span.from,
            to: span.to,
            first: true,
            last: true,
            cancelled: e.status === 'cancelled',
            changed: e.changed,
          },
          span,
          column,
        });
      }
    } else if (e.type === 'marker' && e.date === day.date) {
      // Immer über alle Planungsspalten (MARKER_COLUMNS; Entscheid Auftraggeber 21.10.2026).
      const { left, width } = columnsRect(plan, day, MARKER_COLUMNS);
      const top = yOf(e.at, plan, scale);
      if (e.at < plan.displayRange.from || e.at > plan.displayRange.to) continue;
      const label = markerLabel(e, plan);
      out.push({
        key: e.id,
        id: e.id,
        windowId: null,
        kind: 'marker',
        label: `Marker ${e.kind === 'custom' ? e.customKind : e.kind} ${formatMilTime(e.at)} · ${day.weekday}`,
        text: label,
        sub: '',
        rect: { left, top: top - 6, width, height: 12 },
        pieces: [],
        textPiece: 0,
        fill: 'transparent',
        ink: 'rgb(0 0 0)',
        z: 8,
        from: e.at,
        to: e.at,
        first: true,
        last: true,
        cancelled: e.status === 'cancelled',
        changed: e.changed,
      });
    } else if (
      e.type === 'querbalken' &&
      daysBetween(e.fromDate, day.date) >= 0 &&
      daysBetween(day.date, e.toDate) >= 0
    ) {
      const lane = lanes.get(e.id) ?? { lane: 0, lanes: 1 };
      const band = 60 * scale.minute;
      const h = Math.min(16, band / lane.lanes);
      const fill = categoryFill(plan, e.categoryId);
      const title = plainTitle(plan, e.title);
      const first = e.fromDate === day.date;
      const last = e.toDate === day.date;
      const p = day.planning;
      const left = p[0]?.left ?? 0;
      const right =
        p.length === 0 ? day.width : (p[p.length - 1]?.left ?? 0) + (p[p.length - 1]?.width ?? 0);
      out.push({
        key: `${e.id}:${day.date}`,
        id: e.id,
        windowId: null,
        kind: 'querbalken',
        label: `Querbalken ${title} ${weekdayOf(e.fromDate)}${e.fromDate === e.toDate ? '' : `–${weekdayOf(e.toDate)}`} · ${day.weekday}`,
        text: first || day.weekday === 'Mo' ? title : '',
        sub: '',
        rect: { left, top: band - h * (lane.lanes - lane.lane), width: right - left, height: h },
        pieces: [],
        textPiece: 0,
        fill: rgb(fill),
        ink: rgb(textColorForFill(fill)),
        z: 9,
        from: plan.displayRange.from,
        to: plan.displayRange.from + 60,
        first,
        last,
        cancelled: e.status === 'cancelled',
        changed: e.changed,
      });
    }
  }
  // Beso-Kästchen: in der Beso-Spalte weicht ein späteres in die zweite Bahn aus; ab drei geteilte Breite.
  const byColumn = new Map<string, typeof besoItems>();
  for (const item of besoItems) {
    const key = item.column?.column.id ?? '';
    byColumn.set(key, [...(byColumn.get(key) ?? []), item]);
  }
  for (const group of byColumn.values()) {
    const sorted = [...group].sort((a, b) => a.span.from - b.span.from);
    const r = assignSlots(sorted.map((i) => i.span));
    sorted.forEach((item, i) => {
      if (item.column === undefined) return;
      const count = r.count[i] ?? 1;
      const lanesInColumn = item.column.column.kind === 'beso' && count === 2 ? 2 : count;
      const width = item.column.width / lanesInColumn;
      const rect = clipRect(
        item.span,
        item.column.left + (r.slot[i] ?? 0) * width,
        width,
        plan,
        scale,
      );
      if (rect !== null) out.push({ ...item.view, rect });
    });
  }
  return out;
}
