// Mapping of grid boxes to Tagesbefehl sections and group headings.
//
// - Box spanning (almost) all group sub-columns of a day, or a general service item
//   (Tagwache, MoE, AV, PD/ID, ABV …) → "1 Dienstbetrieb", general part.
// - Box in group sub-columns → group heading from the sheet's own headers.
//   * Headers naming functions/levels (e.g. "Kdt | Stv | Zfhr | Trp")
//     form "Stufen": columns that boxes span together anywhere in the week are one
//     heading, listing the columns actually used that day ("Kdt / Stv").
//   * Other headers are units: a box spanning several units is listed under each;
//     sibling units ("X 10" / "X 20", single-word code names) with identical content
//     that day are merged into one heading ("X 10 / X 20").
// - Rap column → "3 Rapporte", Beso/Bes column → "2 Besonderes"; rapport items
//   (KR, DR, …Rap, Absprache) always go to Rapporte.
import type { TbSection, TbWeekday } from '../../model/tagesbefehl/types';
import type { DayBlock, Layout, SubColumn } from './calibrate';
import { fold, isDienstItem, isRapport, isResponsibleLine } from './content';
import type { Box } from './drawing';

export type Zone = 'group' | 'rap' | 'beso';

export interface Placement {
  day: TbWeekday;
  zone: Zone;
  /** Group sub-columns spanned (indices into the day's group columns). */
  groupColumns: number[];
  /** All sub-columns spanned (any kind), for the review hint. */
  columns: SubColumn[];
  /** Share of the day's group width covered (0 … 1). */
  groupCoverage: number;
}

const overlap = (a0: number, a1: number, b0: number, b1: number) =>
  Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));

export const groupColumnsOf = (day: DayBlock): SubColumn[] =>
  day.columns.filter((c) => c.kind === 'group');

export function placeBox(box: Box, layout: Layout): Placement | null {
  let best: DayBlock | null = null,
    bestOverlap = 0;
  for (const day of layout.days) {
    const o = overlap(box.x0, box.x1, day.x0, day.x1);
    if (o > bestOverlap) {
      best = day;
      bestOverlap = o;
    }
  }
  if (!best) return null;
  const width = Math.max(1, box.x1 - box.x0);
  const spanned = best.columns.filter((c) => {
    const o = overlap(box.x0, box.x1, c.x0, c.x1);
    return o > 0 && o >= 0.3 * Math.min(c.x1 - c.x0, width);
  });
  const share = { group: 0, rap: 0, beso: 0 };
  for (const c of best.columns) share[c.kind] += overlap(box.x0, box.x1, c.x0, c.x1);
  const zone: Zone =
    share.group >= share.rap && share.group >= share.beso
      ? 'group'
      : share.rap >= share.beso
        ? 'rap'
        : 'beso';
  const groups = groupColumnsOf(best);
  let groupColumns = groups.map((c, i) => (spanned.includes(c) ? i : -1)).filter((i) => i >= 0);
  if (zone === 'group' && !groupColumns.length && groups.length) {
    // Box in a gap between sub-columns: nearest group column.
    const cx = (box.x0 + box.x1) / 2;
    let nearest = 0;
    groups.forEach((c, i) => {
      const d = Math.abs((c.x0 + c.x1) / 2 - cx);
      if (d < Math.abs((groups[nearest].x0 + groups[nearest].x1) / 2 - cx)) nearest = i;
    });
    groupColumns = [nearest];
  }
  const total = groups.reduce((sum, c) => sum + (c.x1 - c.x0), 0);
  const covered = groups.reduce((sum, c) => sum + overlap(box.x0, box.x1, c.x0, c.x1), 0);
  return {
    day: best.day,
    zone,
    groupColumns,
    columns: spanned,
    groupCoverage: total ? covered / total : 1,
  };
}

/** Section of a box activity (group headings are resolved per day later). */
export function sectionOf(
  placement: Placement,
  taetigkeit: string,
  groupCount: number,
): { section: TbSection; general: boolean } {
  if (isRapport(taetigkeit) || placement.zone === 'rap')
    return { section: 'rapporte', general: true };
  if (placement.zone === 'beso') return { section: 'besonderes', general: true };
  const full =
    placement.groupCoverage >= 0.8 ||
    (groupCount > 1 && placement.groupColumns.length >= groupCount) ||
    groupCount <= 1;
  return { section: 'dienstbetrieb', general: full || isDienstItem(taetigkeit) };
}

// ---------------------------------------------------------------------------
// Group headings.

export type Aliases = ReadonlyMap<string, string>;

export const aliasMap = (aliases: Readonly<Record<string, string>> | undefined): Aliases =>
  new Map(
    Object.entries(aliases ?? {})
      .filter(([, to]) => to.trim())
      .map(([from, to]) => [fold(from), to.trim()]),
  );

export const aliasOf = (label: string, aliases: Aliases): string =>
  aliases.get(fold(label)) ?? label;

/** Header labels naming functions/levels ("Kdt", "Stv", "Wm", "Trp") → Stufen layout. */
export function isStufenLayout(labels: readonly string[]): boolean {
  if (labels.length < 2) return false;
  const functional = labels.filter(
    (l) => isResponsibleLine(l) || /^(?:Trp|Truppe|Kader|Stufe|Mannschaft|Sdt)$/i.test(l.trim()),
  ).length;
  return functional / labels.length >= 0.67;
}

/** Sibling units: same first word ("X 10" / "X 20") or single-word code names. */
export function areSiblings(a: string, b: string): boolean {
  const wa = a.trim().split(/\s+/),
    wb = b.trim().split(/\s+/);
  if (wa.length > 1 && wb.length > 1 && fold(wa[0]) === fold(wb[0])) return true;
  const code = (w: string[]) => w.length === 1 && /^\p{Lu}{3,}$/u.test(w[0]);
  return code(wa) && code(wb);
}

export interface GroupItem {
  /** Group columns spanned (indices into the day's group columns). */
  columns: number[];
  /** Signature for identical-content comparison. */
  signature: string;
}

/**
 * Stufen clusters: union of group columns spanned together by one box, over all
 * days sharing the same header layout. Returns cluster id per column index.
 */
export function stufenClusters(columnCount: number, spans: readonly number[][]): number[] {
  const parent = Array.from({ length: columnCount }, (_, i) => i);
  const find = (i: number): number => {
    let root = i;
    while (parent[root] !== root) root = parent[root];
    return root;
  };
  for (const span of spans)
    for (let i = 1; i < span.length; i++) parent[find(span[i])] = find(span[0]);
  return parent.map((_, i) => find(i));
}

export interface HeadingUnit {
  heading: string;
  columns: number[];
}

/** Headings for one day in a Stufen layout. */
export function stufenHeadings(
  labels: readonly string[],
  clusters: readonly number[],
  items: readonly GroupItem[],
  aliases: Aliases,
): { units: HeadingUnit[]; unitOf: (item: GroupItem) => number[] } {
  const used = new Set(items.flatMap((i) => i.columns));
  const ids = [...new Set(clusters)].sort((a, b) => clusters.indexOf(a) - clusters.indexOf(b));
  const units: HeadingUnit[] = ids
    .map((id) => {
      const columns = clusters.map((c, i) => (c === id ? i : -1)).filter((i) => i >= 0);
      const names = [
        ...new Set(columns.filter((i) => used.has(i)).map((i) => aliasOf(labels[i], aliases))),
      ];
      return { heading: names.join(' / '), columns };
    })
    .filter((u) => u.heading);
  return {
    units,
    unitOf: (item) => {
      const index = units.findIndex((u) => item.columns.some((c) => u.columns.includes(c)));
      return index >= 0 ? [index] : [];
    },
  };
}

/** Headings for one day in a unit layout (per column, identical siblings merged). */
export function unitHeadings(
  labels: readonly string[],
  items: readonly GroupItem[],
  aliases: Aliases,
): { units: HeadingUnit[]; unitOf: (item: GroupItem) => number[] } {
  const content = labels.map((_, col) =>
    items
      .filter((item) => item.columns.includes(col))
      .map((item) => item.signature)
      .sort()
      .join('\n'),
  );
  const units: { names: string[]; columns: number[]; content: string }[] = [];
  labels.forEach((label, col) => {
    const name = aliasOf(label, aliases);
    const last = units[units.length - 1];
    const lastName = last?.names[last.names.length - 1];
    const sameAlias = !!last?.names.includes(name);
    const identicalSiblings =
      last &&
      content[col] &&
      last.content === content[col] &&
      lastName != null &&
      areSiblings(labels[last.columns[last.columns.length - 1]], label);
    if (last && (sameAlias || identicalSiblings)) {
      if (!sameAlias) last.names.push(name);
      last.columns.push(col);
    } else units.push({ names: [name], columns: [col], content: content[col] });
  });
  const withContent = units.filter((u) => u.columns.some((c) => content[c]));
  return {
    units: withContent.map((u) => ({ heading: u.names.join(' / '), columns: u.columns })),
    unitOf: (item) =>
      withContent
        .map((u, i) => (item.columns.some((c) => u.columns.includes(c)) ? i : -1))
        .filter((i) => i >= 0),
  };
}
