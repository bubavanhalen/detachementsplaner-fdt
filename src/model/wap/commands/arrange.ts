// Nachbarblöcke beim Ziehen (I2b-A A7, Auftraggeber «Variante c»; Beschrieb 4.6 «Überdeckung und Ausnahmen»).
// Rein: arrangeBlocks berechnet die Vorschau, applyArrangement schreibt sie als genau einen Befehl (ein Undo-Schritt).
// Nachbarn sind nur Blöcke mit genau denselben Spalten am selben Tag; ein Block über alle Spalten zählt nur, wenn er
// direkt an der gezogenen Kante liegt. Marker, Rapporte und Beso bewegen sich nie mit. Eine freie Kante ohne Taste
// dockt am nächsten Block derselben Spalten an, darüber nur mit Alt (Entscheid Auftraggeber 21.10.2026, 2a); Shift
// schiebt alle Folgeblöcke derselben Spalten bis Tagesende (4a).

import { castDraft, type Patch } from 'immer';
import { weekdayOf } from '../calendar';
import { dayColumns, resolveColumns } from '../derive/columns';
import type { Beso, Block, ColumnSelection, Id, IsoDate, MilTime, Plan, TimeSpec } from '../types';
import { carryEntryColumns, relativeColumns } from './columns';
import {
  type CommandContext,
  type CommandResult,
  clonePlain,
  command,
  entryLabel,
  requireEntry,
  weekOfDate,
  writeEntry,
} from './command';

/** Kürzeste Dauer eines Blocks nach einer Anpassung (Auftraggeber: «Nachbar nie kürzer als 15 Min»). */
export const MIN_BLOCK_MINUTES = 15;
const DAY_END = 1440;

/** Ohne Taste: angrenzende Kante bzw. Überdecktes kürzen; Shift: Folgeblöcke rücken; Alt: keine Anpassung. */
export type ArrangeMode = 'adjust' | 'shift' | 'none';

export interface BlockPlacement {
  readonly date: IsoDate;
  readonly from: MilTime;
  readonly to: MilTime;
  readonly columns: ColumnSelection;
}

export type BlockGesture =
  | { readonly kind: 'move'; readonly blockId: Id; readonly target: BlockPlacement }
  | { readonly kind: 'start' | 'end'; readonly blockId: Id; readonly edge: MilTime }
  | { readonly kind: 'create'; readonly target: BlockPlacement };

/** Neue Zeit eines Nachbarn; Tag und Spalten bleiben. */
export interface BlockTimeChange {
  readonly id: Id;
  readonly from: MilTime;
  readonly to: MilTime;
}

/** Zweites Teilstück eines ausgesparten Nachbarn: neue Kopie von `sourceId` mit dieser Zeit. */
export interface BlockSplit {
  readonly sourceId: Id;
  readonly from: MilTime;
  readonly to: MilTime;
}

export interface Arrangement {
  /** Zeit des gezogenen Blocks; bei einer Kante, die am Nachbarn anhält, die angehaltene Zeit. */
  readonly target: { readonly from: MilTime; readonly to: MilTime };
  readonly changes: readonly BlockTimeChange[];
  readonly splits: readonly BlockSplit[];
  /**
   * Freie Kante ohne Taste am nächsten Block derselben Spalten angedockt (Entscheid Auftraggeber 21.10.2026, 2a):
   * dessen ID; darüber hinaus nur mit Alt. Fehlt, wenn nichts andockt.
   */
  readonly dock?: Id;
  /**
   * Mitrückende Rapporte (angezeigt in Planungsspalten; mit Shift und ohne Taste verdrängt wie Blöcke, CR-F3-04) und
   * Beso-Zeitfenster (in Planungs- bzw. Nebenspalten; nur mit Shift – ohne Taste liegen sie bewusst über Blöcken,
   * R-4.6-54). Marker rücken nie mit.
   */
  readonly shifts?: readonly EntryShift[];
  /** Ohne Taste hält die Kante an, weil ein Nachbar sonst kürzer als 15 Min würde (Hinweis «Shift = mitschieben»). */
  readonly limit?: boolean;
  /**
   * Am Tagesende kein Platz (CR-F3-01): die Vorschau hält an, damit nichts über 2400 rückt (Kante: Differenz begrenzt,
   * Verschieben: Ziel so weit früher wie nötig). Hinweis «Folgende reichen über Tagesende · Alt = parallel».
   */
  readonly dayEnd?: boolean;
  /** Auch angehalten passt nichts: die Geste ändert nichts (kein Fehler beim Ablegen, nur der Hinweis). */
  readonly blocked?: boolean;
}

/** Rapport bzw. Beso-Zeitfenster um `delta` Minuten verschieben (Runde 4). */
export interface EntryShift {
  readonly id: Id;
  readonly windowId: Id | null;
  readonly delta: number;
}

interface Span {
  readonly id: Id;
  readonly from: number;
  readonly to: number;
  readonly block: Block;
}

function rangeOf(b: Block): { from: number; to: number } | null {
  return b.time.form === 'range' ? { from: b.time.from, to: b.time.to } : null;
}

function columnsOn(plan: Plan, date: IsoDate, sel: ColumnSelection): readonly Id[] {
  const week = weekOfDate(plan, date);
  if (week === null) return sel.kind === 'ids' ? sel.ids : [];
  const columns = dayColumns(plan, week.id, weekdayOf(date));
  const resolved =
    sel.kind === 'all' ? resolveColumns(sel, columns) : relativeColumns(plan, sel, columns);
  return resolved.map((c) => c.id);
}

function isAllColumns(plan: Plan, date: IsoDate, sel: ColumnSelection): boolean {
  if (sel.kind === 'all') return true;
  const week = weekOfDate(plan, date);
  if (week === null) return false;
  const planning = dayColumns(plan, week.id, weekdayOf(date)).filter((c) => c.kind === 'planning');
  const ids = new Set(columnsOn(plan, date, sel));
  return planning.length > 0 && planning.every((c) => ids.has(c.id));
}

function sameIds(a: readonly Id[], b: readonly Id[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

/** Blöcke am Tag mit Zeitform von–bis; ohne `exclude`. */
function blocksOn(plan: Plan, date: IsoDate, exclude: Id | null): Span[] {
  const out: Span[] = [];
  for (const e of Object.values(plan.entries)) {
    if (e.type !== 'block' || e.date !== date || e.id === exclude) continue;
    const r = rangeOf(e);
    if (r !== null) out.push({ id: e.id, ...r, block: e });
  }
  return out.sort((a, b) => a.from - b.from || a.block.createdSeq - b.block.createdSeq);
}

/** Nachbar an einer Kante: gleiche Spalten oder (direkt angrenzend) einer der beiden über alle Spalten. */
function edgeNeighbour(
  plan: Plan,
  date: IsoDate,
  sel: ColumnSelection,
  exclude: Id,
  side: 'before' | 'after',
  at: number,
): Span | null {
  const own = columnsOn(plan, date, sel);
  const ownAll = isAllColumns(plan, date, sel);
  const touching = blocksOn(plan, date, exclude).filter((s) =>
    side === 'after' ? s.from === at : s.to === at,
  );
  const same = touching.find((s) => sameIds(columnsOn(plan, date, s.block.columns), own));
  if (same !== undefined) return same;
  return (
    touching.find((s) => {
      if (ownAll) return true;
      return isAllColumns(plan, date, s.block.columns);
    }) ?? null
  );
}

function placementOf(
  plan: Plan,
  gesture: BlockGesture,
): BlockPlacement & { readonly id: Id | null } {
  if (gesture.kind === 'create') return { ...gesture.target, id: null };
  const e = requireEntry(plan, gesture.blockId);
  if (e.type !== 'block') throw new RangeError('arrangeBlocks: Der Eintrag ist kein Block.');
  const r = rangeOf(e) ?? { from: 0, to: 0 };
  if (gesture.kind === 'move') return { ...gesture.target, id: e.id };
  return {
    date: e.date,
    columns: e.columns,
    from: gesture.kind === 'start' ? gesture.edge : r.from,
    to: gesture.kind === 'end' ? gesture.edge : r.to,
    id: e.id,
  };
}

// ---------------------------------------------------------------------------------------------------------
// Einträge mit Lage (Runde 4): Blöcke, Rapporte und Beso-Zeitfenster mit ihren Spalten am Tag
// ---------------------------------------------------------------------------------------------------------

/** Ein Eintrag mit Zeitspanne und Spalten; Rapport in der Rap-Spalte bzw. Beso in der Beso-Spalte ohne Spalten. */
interface Item {
  readonly id: Id;
  readonly windowId: Id | null;
  readonly kind: 'block' | 'rapport' | 'beso';
  readonly from: number;
  readonly to: number;
  readonly cols: ReadonlySet<Id>;
  readonly seq: number;
  /** Grösster Versatz nach unten bzw. oben, ohne den Tag zu verlassen (Beginn bzw. Ende ≤ 2400, ≥ 0000). */
  readonly up: number;
  readonly down: number;
}

/**
 * Wie weit eine Zeit verschoben werden darf (CR-F3-01, -02): Ende ≤ 2400; ein Block über Mitternacht (Ende > 2400)
 * darf bis zum Beginn 2400 rücken; nach oben bis 0000.
 */
function boundsOf(t: TimeSpec): { readonly up: number; readonly down: number } {
  switch (t.form) {
    case 'range':
      return { up: t.to <= DAY_END ? DAY_END - t.to : DAY_END - t.from, down: -t.from };
    case 'point':
      return { up: DAY_END - t.at, down: -t.at };
    case 'from':
      return { up: DAY_END - t.from, down: -t.from };
    case 'until':
      return { up: DAY_END - t.to, down: -t.to };
    default:
      return { up: 0, down: 0 };
  }
}

function spanOf(t: TimeSpec, minimum: number): { from: number; to: number } | null {
  switch (t.form) {
    case 'range':
      return { from: t.from, to: t.to };
    case 'point':
      return { from: t.at, to: t.at + minimum };
    case 'from':
      return { from: t.from, to: t.from + minimum };
    case 'until':
      return { from: t.to - minimum, to: t.to };
    default:
      return null;
  }
}

/**
 * Blöcke, Rapporte (nur angezeigt in Planungsspalten) und Beso-Zeitfenster (nur in Planungs- bzw. Nebenspalten) des
 * Tages ohne `exclude`. Marker fehlen: ihr Zeitpunkt bleibt (Runde 4).
 */
function itemsOn(plan: Plan, date: IsoDate, exclude: Id | null): Item[] {
  const out: Item[] = [];
  for (const e of Object.values(plan.entries)) {
    if (!('date' in e) || e.date !== date || e.id === exclude) continue;
    if (e.type === 'block') {
      const r = rangeOf(e);
      if (r !== null)
        out.push({
          id: e.id,
          windowId: null,
          kind: 'block',
          ...r,
          cols: new Set(columnsOn(plan, date, e.columns)),
          seq: e.createdSeq,
          ...boundsOf(e.time),
        });
    } else if (e.type === 'rapport') {
      if (e.display === 'rapColumn') continue;
      const r = spanOf(e.time, 30);
      if (r !== null)
        out.push({
          id: e.id,
          windowId: null,
          kind: 'rapport',
          ...r,
          cols: new Set(columnsOn(plan, date, e.displayColumns)),
          seq: e.createdSeq,
          ...boundsOf(e.time),
        });
    } else if (e.type === 'beso') {
      for (const w of e.windows) {
        if (w.columnId === null) continue;
        const r = spanOf(w.time, 15);
        if (r !== null)
          out.push({
            id: e.id,
            windowId: w.id,
            kind: 'beso',
            ...r,
            cols: new Set([w.columnId]),
            seq: e.createdSeq,
            ...boundsOf(w.time),
          });
      }
    }
  }
  return out.sort((a, b) => a.from - b.from || a.seq - b.seq);
}

function meets(a: ReadonlySet<Id>, b: ReadonlySet<Id>): boolean {
  for (const x of a) if (b.has(x)) return true;
  return false;
}

/** Ergebnis für verschobene Einträge: Blöcke als neue Zeit, Rapporte und Beso-Zeitfenster als Versatz. */
function moved(
  items: readonly { readonly item: Item; readonly from: number }[],
): Pick<Arrangement, 'changes' | 'shifts'> {
  const changes: BlockTimeChange[] = [];
  const shifts: EntryShift[] = [];
  for (const { item, from } of [...items].sort((a, b) => a.item.from - b.item.from)) {
    if (from === item.from) continue;
    if (item.kind === 'block') changes.push({ id: item.id, from, to: from + item.to - item.from });
    else shifts.push({ id: item.id, windowId: item.windowId, delta: from - item.from });
  }
  return shifts.length === 0 ? { changes } : { changes, shifts };
}

/**
 * Shift an einer Kante (4a, Runde 4): alle Einträge unter (bzw. über) dem Block, deren Spalten sich mit ihm
 * überschneiden, rücken um die Differenz bis Tagesende; transitiv rückt mit, was ein rückender Eintrag überdecken
 * würde. Die Differenz wird so begrenzt, dass alles im Tag bleibt und der Block mindestens 15 Min dauert.
 */
function shiftEdge(
  items: readonly Item[],
  own: { readonly from: number; readonly to: number; readonly cols: ReadonlySet<Id> },
  side: 'after' | 'before',
  wanted: number,
): { readonly d: number; readonly movers: readonly Item[]; readonly dayEnd: boolean } {
  const seeds = items.filter(
    (x) => meets(x.cols, own.cols) && (side === 'after' ? x.from >= own.to : x.to <= own.from),
  );
  const moversFor = (d: number): Item[] => {
    const set = new Set<Item>(seeds);
    let grew = true;
    while (grew) {
      grew = false;
      for (const x of items) {
        if (set.has(x)) continue;
        for (const m of set) {
          if (!meets(x.cols, m.cols)) continue;
          if (x.from < m.to + d && x.to > m.from + d) {
            set.add(x);
            grew = true;
            break;
          }
        }
      }
    }
    return [...set];
  };
  let d = wanted;
  let dayEnd = false;
  for (let i = 0; i < 8; i++) {
    const movers = moversFor(d);
    let next = d;
    // Grenze je Mitläufer am Tag (Beginn bzw. Ende, CR-F3-02 für Blöcke über Mitternacht).
    if (side === 'after') {
      for (const m of movers) next = Math.min(next, Math.max(0, m.up));
      if (next < d) dayEnd = true;
      next = Math.max(next, own.from + MIN_BLOCK_MINUTES - own.to);
    } else {
      for (const m of movers) next = Math.max(next, Math.min(0, m.down));
      if (next > d) dayEnd = true;
      next = Math.min(next, own.to - MIN_BLOCK_MINUTES - own.from);
    }
    if (next === d) return { d, movers: d === 0 ? [] : movers, dayEnd };
    d = next;
  }
  return { d, movers: d === 0 ? [] : moversFor(d), dayEnd };
}

/**
 * Shift beim Verschieben und Erfassen (Runde 4): der angeschnittene Block gleicher Spalten wird geteilt; alles ab
 * Beginn, dessen Spalten sich mit dem Ziel bzw. einem rückenden Eintrag überschneiden, rückt so weit nach, dass
 * nichts überdeckt wird (transitiv, Lücken bleiben).
 */
function pushFollowing(
  plan: Plan,
  date: IsoDate,
  sel: ColumnSelection,
  exclude: Id | null,
  from: number,
  to: number,
): Arrangement & { readonly overflow: boolean } {
  const own = new Set(columnsOn(plan, date, sel));
  const ownIds = columnsOn(plan, date, sel);
  const changes: BlockTimeChange[] = [];
  const splits: BlockSplit[] = [];
  const items = itemsOn(plan, date, exclude);
  interface Run {
    readonly item: Item;
    readonly from: number;
    readonly split: boolean;
  }
  const runs: Run[] = [];
  for (const x of items) {
    if (x.from < from && x.to > from) {
      // Angeschnittener Block derselben Spalten: Teil ab Beginn wird abgetrennt (wie bisher); anders breite bleiben.
      const same =
        x.kind === 'block' && sameIds([...x.cols].sort(), [...own].sort()) && ownIds.length > 0;
      if (!same) continue;
      const head = from - x.from;
      if (head >= MIN_BLOCK_MINUTES) {
        changes.push({ id: x.id, from: x.from, to: from });
        runs.push({ item: { ...x, from, to: x.to }, from, split: true });
      } else runs.push({ item: x, from: x.from, split: false });
    } else if (x.from >= from) runs.push({ item: x, from: x.from, split: false });
  }
  runs.sort((a, b) => a.from - b.from || a.item.seq - b.item.seq);
  const cursor = new Map<Id, number>();
  for (const c of own) cursor.set(c, to);
  const placed: { item: Item; from: number }[] = [];
  let overflow = false;
  for (const r of runs) {
    let need: number | undefined;
    for (const c of r.item.cols) {
      const v = cursor.get(c);
      if (v !== undefined) need = need === undefined ? v : Math.max(need, v);
    }
    const duration = r.item.to - r.item.from;
    if (need !== undefined && r.from < need) {
      const at = need;
      if (at - r.from > r.item.up) overflow = true;
      for (const c of r.item.cols)
        cursor.set(c, Math.max(cursor.get(c) ?? at + duration, at + duration));
      if (r.split) splits.push({ sourceId: r.item.id, from: at, to: at + duration });
      else placed.push({ item: r.item, from: at });
    } else {
      for (const c of r.item.cols) {
        const v = cursor.get(c);
        if (v !== undefined) cursor.set(c, Math.max(v, r.from + duration));
      }
      if (r.split) splits.push({ sourceId: r.item.id, from: r.from, to: r.from + duration });
    }
  }
  const m = moved(placed);
  return {
    target: { from, to },
    changes: [...changes, ...m.changes],
    splits,
    ...(m.shifts === undefined ? {} : { shifts: m.shifts }),
    overflow,
  };
}

/**
 * Ohne Taste beim Verschieben und Erfassen: Überdecktes gleicher Spalten kürzen bzw. aussparen. Nie zwei Aufträge
 * parallel (Runde 4): ein ganz überdeckter Nachbar bzw. einer, von dem weniger als 15 Min blieben, rückt direkt unter
 * das Ziel; was er dort überdecken würde, rückt mit (gleiche Spalten). Rapporte, die in überschneidenden
 * Planungsspalten angezeigt werden, rücken ebenso unter das Ziel (CR-F3-04, nie gekürzt); Beso-Kästchen bleiben
 * (R-4.6-54). Anders breite Blöcke bleiben (Ausnahme, Beschrieb 4.6). `overflow`: etwas rückte über 2400.
 */
function adjustOverlaps(
  plan: Plan,
  date: IsoDate,
  sel: ColumnSelection,
  exclude: Id | null,
  from: number,
  to: number,
): Arrangement & { readonly overflow: boolean } {
  const own = new Set(columnsOn(plan, date, sel));
  const all = itemsOn(plan, date, exclude);
  const ownSorted = [...own].sort();
  const blocks = all.filter((x) => x.kind === 'block' && sameIds([...x.cols].sort(), ownSorted));
  const rapports = all.filter((x) => x.kind === 'rapport' && meets(x.cols, own));
  const changes: BlockTimeChange[] = [];
  const splits: BlockSplit[] = [];
  const displaced: Item[] = [];
  for (const s of blocks) {
    if (s.to <= from || s.from >= to) continue;
    const head = from - s.from;
    const tail = s.to - to;
    const keepHead = head >= MIN_BLOCK_MINUTES;
    const keepTail = tail >= MIN_BLOCK_MINUTES;
    if (head > 0 && tail > 0) {
      if (keepHead && keepTail) {
        changes.push({ id: s.id, from: s.from, to: from });
        splits.push({ sourceId: s.id, from: to, to: s.to });
      } else if (keepHead) changes.push({ id: s.id, from: s.from, to: from });
      else if (keepTail) changes.push({ id: s.id, from: to, to: s.to });
      else displaced.push(s);
    } else if (head > 0) {
      if (keepHead) changes.push({ id: s.id, from: s.from, to: from });
      else displaced.push(s);
    } else if (tail > 0) {
      if (keepTail) changes.push({ id: s.id, from: to, to: s.to });
      else displaced.push(s);
    } else displaced.push(s);
  }
  for (const r of rapports) if (r.from < to && r.to > from) displaced.push(r);
  if (displaced.length === 0) return { target: { from, to }, changes, splits, overflow: false };
  // Verdrängte direkt unter das Ziel, danach alles Folgende (gleiche Spalten bzw. Rapporte) so weit nötig.
  const shown = new Map(changes.map((c) => [c.id, c]));
  const after = [...blocks, ...rapports]
    .filter((x) => !displaced.includes(x) && (shown.get(x.id)?.from ?? x.from) >= to)
    .map((x) => ({
      item: x,
      from: shown.get(x.id)?.from ?? x.from,
      to: shown.get(x.id)?.to ?? x.to,
    }))
    .sort((a, b) => a.from - b.from);
  let cursor = to;
  let overflow = false;
  const next = new Map<Id, BlockTimeChange>(changes.map((c) => [c.id, c]));
  const shifts: EntryShift[] = [];
  const place = (x: Item, base: { from: number; to: number }, at: number) => {
    const duration = base.to - base.from;
    if (
      x.kind === 'block'
        ? x.to <= DAY_END
          ? at + duration > DAY_END
          : at > DAY_END
        : at - x.from > x.up
    )
      overflow = true;
    if (x.kind === 'block') next.set(x.id, { id: x.id, from: at, to: at + duration });
    else shifts.push({ id: x.id, windowId: x.windowId, delta: at - x.from });
    cursor = at + duration;
  };
  for (const x of displaced.sort((a, b) => a.from - b.from)) place(x, x, cursor);
  for (const a of after) {
    if (a.from < cursor) place(a.item, a, cursor);
    else cursor = Math.max(cursor, a.to);
  }
  const order = new Map(all.map((x) => [x.id, x.from]));
  const ordered = [...next.values()].sort(
    (a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0),
  );
  return {
    target: { from, to },
    changes: ordered,
    splits,
    ...(shifts.length === 0 ? {} : { shifts }),
    overflow,
  };
}

/**
 * Kante ohne Taste (Variante c, Runde 4: nie überlappen). Nach aussen: jeder Block, dessen Spalten sich mit dem
 * gezogenen überschneiden und der unter (über) der alten Kante beginnt (endet), schrumpft mit – eine gemeinsame
 * Kante wandert zusammen, eine freie Kante dockt an (2a) und lässt den Nachbarn ab dort schrumpfen; jeder bleibt
 * mindestens 15 Min, sonst hält die Kante an (`limit`). Nach innen: der direkt angrenzende Nachbar (gleiche Spalten
 * bzw. über alle Spalten) wächst mit.
 */
function adjustEdge(
  plan: Plan,
  block: Block,
  original: { readonly from: number; readonly to: number },
  side: 'after' | 'before',
  wanted: number,
): Arrangement {
  const id = block.id;
  const own = new Set(columnsOn(plan, block.date, block.columns));
  const at = side === 'after' ? original.to : original.from;
  const inward = side === 'after' ? wanted <= at : wanted >= at;
  if (inward) {
    const n = edgeNeighbour(plan, block.date, block.columns, id, side, at);
    const target =
      side === 'after' ? { from: original.from, to: wanted } : { from: wanted, to: original.to };
    if (n === null || wanted === at) return { target, changes: [], splits: [] };
    return {
      target,
      changes: [
        side === 'after'
          ? { id: n.id, from: wanted, to: n.to }
          : { id: n.id, from: n.from, to: wanted },
      ],
      splits: [],
    };
  }
  const spans = blocksOn(plan, block.date, id).filter((s) =>
    meets(new Set(columnsOn(plan, block.date, s.block.columns)), own),
  );
  let edge = wanted;
  let limit = false;
  // Rapporte in überschneidenden Planungsspalten (CR-F3-04): feste Dauer, die Kante dockt an ihnen an.
  let rapportDock: Id | undefined;
  for (const r of itemsOn(plan, block.date, id)) {
    if (r.kind !== 'rapport' || !meets(r.cols, own)) continue;
    if (side === 'after' && r.from >= at && r.from < edge) {
      edge = r.from;
      rapportDock = r.id;
    } else if (side === 'before' && r.to <= at && r.to > edge) {
      edge = r.to;
      rapportDock = r.id;
    }
  }
  let affected: Span[] = [];
  for (let i = 0; i < 8; i++) {
    affected =
      side === 'after'
        ? spans.filter((s) => s.from >= at && s.from < edge)
        : spans.filter((s) => s.to <= at && s.to > edge);
    let next = edge;
    for (const s of affected)
      next =
        side === 'after'
          ? Math.min(next, s.to - MIN_BLOCK_MINUTES)
          : Math.max(next, s.from + MIN_BLOCK_MINUTES);
    if (next === edge) break;
    limit = true;
    edge = next;
  }
  const target =
    side === 'after' ? { from: original.from, to: edge } : { from: edge, to: original.to };
  const changes = affected.map((s) =>
    side === 'after' ? { id: s.id, from: edge, to: s.to } : { id: s.id, from: s.from, to: edge },
  );
  const docked =
    changes.length === 0
      ? (spans.find((s) => (side === 'after' ? s.from === edge : s.to === edge))?.id ?? rapportDock)
      : undefined;
  return {
    target,
    changes,
    splits: [],
    ...(docked === undefined ? {} : { dock: docked }),
    ...(limit ? { limit: true } : {}),
  };
}

/**
 * Vorschau einer Geste (A7, Runde 4): ohne Taste wird nie überlappt – Kanten schieben Nachbarn mit sich (gemeinsame
 * Kante, Andocken), Verschieben kürzt bzw. spart Überdecktes gleicher Spalten aus und lässt ganz Überdecktes nachrücken;
 * Shift schiebt alle Einträge darunter mit überschneidenden Spalten (transitiv, bis Tagesende); Alt ändert nichts.
 * Wirft nie bei gültigem Block.
 */
export function arrangeBlocks(plan: Plan, gesture: BlockGesture, mode: ArrangeMode): Arrangement {
  const p = placementOf(plan, gesture);
  const empty: Arrangement = { target: { from: p.from, to: p.to }, changes: [], splits: [] };
  if (mode === 'none') return empty;
  if (gesture.kind === 'move' || gesture.kind === 'create') {
    const arrangeAt = (from: number): Arrangement & { readonly overflow: boolean } => {
      const to = from + (p.to - p.from);
      return mode === 'shift'
        ? pushFollowing(plan, p.date, p.columns, p.id, from, to)
        : adjustOverlaps(plan, p.date, p.columns, p.id, from, to);
    };
    const strip = ({ overflow: _, ...a }: Arrangement & { readonly overflow: boolean }) => a;
    const first = arrangeAt(p.from);
    if (!first.overflow) return strip(first);
    // Am Tagesende kein Platz (CR-F3-01): das Ziel hält so weit früher an, dass alles im Tag bleibt.
    for (let k = 15; p.from - k >= 0; k += 15) {
      const a = arrangeAt(p.from - k);
      if (!a.overflow) return { ...strip(a), dayEnd: true };
    }
    return { ...empty, dayEnd: true, blocked: true };
  }
  const block = requireEntry(plan, gesture.blockId) as Block;
  const original = rangeOf(block);
  if (original === null) return empty;
  const side = gesture.kind === 'end' ? 'after' : 'before';
  if (mode === 'shift') {
    const own = { ...original, cols: new Set(columnsOn(plan, block.date, block.columns)) };
    const wanted = gesture.edge - (side === 'after' ? original.to : original.from);
    const { d, movers, dayEnd } = shiftEdge(itemsOn(plan, block.date, block.id), own, side, wanted);
    const m = moved(movers.map((x) => ({ item: x, from: x.from + d })));
    return {
      target:
        side === 'after'
          ? { from: original.from, to: original.to + d }
          : { from: original.from + d, to: original.to },
      changes: m.changes,
      splits: [],
      ...(m.shifts === undefined ? {} : { shifts: m.shifts }),
      ...(dayEnd ? { dayEnd: true } : {}),
    };
  }
  return adjustEdge(plan, block, original, side, gesture.edge);
}

/** Zwei aufeinanderfolgende Befehle als ein Undo-Schritt: Patches nacheinander, inverse in umgekehrter Folge. */
export function combineResults(
  first: CommandResult,
  second: CommandResult,
  label: string,
): CommandResult {
  const patches: Patch[] = [...first.patches, ...second.patches];
  const inversePatches: Patch[] = [...second.inversePatches, ...first.inversePatches];
  return {
    plan: second.plan,
    patches,
    inversePatches,
    label,
    affectedDates: [...new Set([...first.affectedDates, ...second.affectedDates])].sort(),
    affectedEntryIds: [...new Set([...first.affectedEntryIds, ...second.affectedEntryIds])].sort(),
  };
}

/** Schreibt Nachbarzeiten und Teilstücke einer Anordnung als Befehl (ohne den gezogenen Block selbst). */
export function writeArrangement(
  plan: Plan,
  arrangement: Arrangement,
  label: string,
  ctx: CommandContext,
): CommandResult {
  return command(
    plan,
    label,
    (d, t) => {
      for (const c of arrangement.changes) {
        const before = requireEntry(plan, c.id);
        if (before.type !== 'block') continue;
        writeEntry(d, before, { ...before, time: { form: 'range', from: c.from, to: c.to } });
      }
      for (const s of arrangement.splits) {
        const source = requireEntry(plan, s.sourceId);
        if (source.type !== 'block') continue;
        const id = t.newId('e');
        const copy: Block = {
          ...clonePlain(source),
          id,
          createdSeq: t.newSeq(),
          time: { form: 'range', from: s.from, to: s.to },
        };
        d.entries[id] = castDraft(copy);
      }
      // Mitrückende Rapporte und Beso-Zeitfenster (Runde 4): Zeit um den Versatz, Spalten bleiben.
      const besos = new Map<Id, Beso>();
      for (const x of arrangement.shifts ?? []) {
        const before = besos.get(x.id) ?? requireEntry(plan, x.id);
        if (before.type === 'rapport') {
          writeEntry(d, before, { ...before, time: shiftSpec(before.time, x.delta) });
        } else if (before.type === 'beso') {
          besos.set(x.id, {
            ...before,
            windows: before.windows.map((w) =>
              w.id === x.windowId ? { ...w, time: shiftSpec(w.time, x.delta) } : w,
            ),
          });
        }
      }
      for (const [id, b] of besos) writeEntry(d, requireEntry(plan, id), b);
    },
    ctx,
  );
}

/** Anzahl betroffener Nachbarn für Beschriftung und Ansage. */
export function arrangementSize(a: Arrangement): number {
  return new Set([
    ...a.changes.map((c) => c.id),
    ...a.splits.map((s) => s.sourceId),
    ...(a.shifts ?? []).map((x) => x.id),
  ]).size;
}

/** Zeitangabe um `d` Minuten (Rapport, Beso-Zeitfenster; Frist nur mit Zeit). */
function shiftSpec<T extends TimeSpec>(t: T, d: number): T {
  switch (t.form) {
    case 'point':
      return { ...t, at: t.at + d };
    case 'range':
      return { ...t, from: t.from + d, to: t.to + d };
    case 'from':
      return { ...t, from: t.from + d };
    case 'until':
      return { ...t, to: t.to + d };
    default:
      return t.to === undefined ? t : { ...t, to: t.to + d };
  }
}

/**
 * Wendet eine Geste mit Nachbaranpassung als genau einen Undo-Schritt an. `place` setzt den gezogenen Block
 * (Erfassen: createEntry, Verschieben/Kante: updateEntry) und liefert seine ID; danach folgen die Nachbarn.
 */
export function applyArrangement(
  plan: Plan,
  gesture: BlockGesture,
  mode: ArrangeMode,
  place: (
    plan: Plan,
    time: { from: MilTime; to: MilTime },
  ) => CommandResult & { readonly entryId: Id },
  ctx: CommandContext,
): CommandResult & { readonly entryId: Id } {
  const arrangement = arrangeBlocks(plan, gesture, mode);
  const placed = place(plan, arrangement.target);
  const count = arrangementSize(arrangement);
  if (count === 0) return placed;
  const entry = requireEntry(placed.plan, placed.entryId);
  const verb =
    gesture.kind === 'create' ? 'erstellt' : gesture.kind === 'move' ? 'verschoben' : 'geändert';
  const label = `${entryLabel(placed.plan, entry, verb)} · ${count === 1 ? '1 Nachbar' : `${count} Nachbarn`} angepasst`;
  const neighbours = writeArrangement(placed.plan, arrangement, label, ctx);
  return { ...combineResults(placed, neighbours, label), entryId: placed.entryId };
}

/** Zeitfenster eines Beso an neue Zeit, Spalte und (für den ganzen Beso) Tag (A6); Nummern nach Beschrieb 5.3. */
export function placeTimeWindow(
  plan: Plan,
  besoId: Id,
  windowId: Id,
  place: { readonly date: IsoDate; readonly time: TimeSpec; readonly columnId: Id | null },
  ctx: CommandContext,
): CommandResult {
  const b = requireEntry(plan, besoId);
  if (b.type !== 'beso') throw new RangeError('placeTimeWindow: Der Eintrag ist kein Beso.');
  let next: Beso = {
    ...b,
    windows: b.windows.map((w) =>
      w.id === windowId ? { ...w, time: place.time, columnId: place.columnId } : w,
    ),
  };
  if (place.date !== b.date) {
    const week = weekOfDate(plan, place.date);
    const moved: Beso = { ...next, date: place.date };
    const carried =
      week === null
        ? moved
        : (carryEntryColumns(
            plan,
            moved,
            dayColumns(plan, week.id, weekdayOf(place.date)),
          ) as Beso);
    next = {
      ...carried,
      windows: carried.windows.map((w) =>
        w.id === windowId ? { ...w, columnId: place.columnId } : w,
      ),
    };
  }
  const final = next;
  return command(plan, entryLabel(plan, b, 'verschoben'), (d) => writeEntry(d, b, final), ctx);
}
