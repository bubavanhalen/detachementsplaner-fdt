// Turns the calibrated shapes of one WAP sheet into reviewed-week entries.
import { applyRules } from '../../model/tagesbefehl/state';
import {
  isWeekend,
  TB_WEEKDAYS,
  type TbConflict,
  type TbConflictType,
  type TbEntry,
  type TbEntrySource,
  type TbLeitung,
  type TbRule,
  type TbSection,
  type TbWeekday,
  type WapParseResult,
} from '../../model/tagesbefehl/types';
import type { Layout, TimeScale } from './calibrate';
import {
  applyContentRules,
  type FootnoteTime,
  fold,
  isRapport,
  parseBoxText,
  parseFootnoteBody,
  sharedTokens,
  significantTokens,
  tokenWeights,
} from './content';
import type { Box, WapShape } from './drawing';
import {
  dayOfNumber,
  type Footnote,
  isFootnoteBox,
  markerNumber,
  readFootnotes,
} from './footnotes';
import type { Legend } from './legend';
import {
  aliasMap,
  aliasOf,
  type GroupItem,
  groupColumnsOf,
  isStufenLayout,
  type Placement,
  placeBox,
  sectionOf,
  stufenClusters,
  stufenHeadings,
  unitHeadings,
} from './sections';
import type { SheetModel } from './sheet';

export interface AssembleInput {
  sheetName: string;
  sheet: SheetModel;
  shapes: readonly WapShape[];
  time: TimeScale;
  layout: Layout;
  legend: Legend;
  ownUnit: string;
  rules: readonly TbRule[];
  groupAliases?: Readonly<Record<string, string>>;
}

// ---------------------------------------------------------------------------
// Time formatting.

export const round15 = (minutes: number): number => Math.round(minutes / 15) * 15;
export const hhmm = (minutes: number): string => {
  const m = Math.max(0, Math.round(minutes));
  return `${String(Math.floor(m / 60)).padStart(2, '0')}${String(m % 60).padStart(2, '0')}`;
};
export const rangeText = (start: number, end: number): string =>
  end > start ? `${hhmm(start)} - ${hhmm(end)}` : hhmm(start);

function footnoteZeit(time: FootnoteTime): string {
  if (time.kind === 'range') return rangeText(time.start, time.end ?? time.start);
  if (time.kind === 'ab') return `ab ${hhmm(time.start)}`;
  if (time.kind === 'bis') return `bis ${hhmm(time.start)}`;
  return hhmm(time.start);
}

// ---------------------------------------------------------------------------

interface Draft {
  seq: number;
  day: TbWeekday;
  section: TbSection;
  general: boolean;
  /** Group columns spanned (indices into the day's group columns). */
  groupColumns: number[];
  zeit: string;
  sortTime: number;
  taetigkeit: string;
  verantwortlich: string;
  ort: string;
  source: TbEntrySource;
  /** Shape index of the grid box (for merges and conflicts); -1 for footnotes. */
  shape: number;
  rawText: string;
  keyRef: string;
  x: number;
}

interface PendingConflict {
  type: TbConflictType;
  day: TbWeekday;
  message: string;
  refs: string[];
  key?: string;
}

const overlap1d = (a0: number, a1: number, b0: number, b1: number) =>
  Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));

/** Share of the box covered by later opaque shapes (z-order = document order). */
function coveredShare(shape: WapShape, occluders: readonly WapShape[]): number {
  const later = occluders.filter(
    (o) =>
      o.index > shape.index &&
      overlap1d(o.box.x0, o.box.x1, shape.box.x0, shape.box.x1) > 0 &&
      overlap1d(o.box.y0, o.box.y1, shape.box.y0, shape.box.y1) > 0,
  );
  if (!later.length) return 0;
  const n = 6;
  let hit = 0;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      const x = shape.box.x0 + ((i + 0.5) / n) * (shape.box.x1 - shape.box.x0);
      const y = shape.box.y0 + ((j + 0.5) / n) * (shape.box.y1 - shape.box.y0);
      if (later.some((o) => x >= o.box.x0 && x <= o.box.x1 && y >= o.box.y0 && y <= o.box.y1))
        hit++;
    }
  return hit / (n * n);
}

/** Minimum IDF-weighted similarity for merging a footnote into a grid box. */
const MERGE_SCORE = 4;

const IGNORED_GEOMETRY = /^(?:sun|moon|smileyFace|heart|lightningBolt|cloud|star\d*)$/i;

function sheetSlug(name: string): string {
  return fold(name).replace(/\s+/g, '_') || 'wap';
}

/** Code tokens with a number, e.g. "ABC 4", "XYZ12" → letters part. */
function codeTokens(text: string): string[] {
  return [...text.matchAll(/\b(\p{Lu}{3,5})\s?\d{1,3}\b/gu)].map((m) => m[1]);
}

function editDistanceOne(a: string, b: string): boolean {
  if (a === b || Math.abs(a.length - b.length) > 1) return false;
  if (a.length === b.length) {
    const diff = [...a].map((ch, i) => (ch === b[i] ? -1 : i)).filter((i) => i >= 0);
    if (diff.length === 1) return true;
    return (
      diff.length === 2 &&
      diff[1] === diff[0] + 1 &&
      a[diff[0]] === b[diff[1]] &&
      a[diff[1]] === b[diff[0]]
    );
  }
  const [s, l] = a.length < b.length ? [a, b] : [b, a];
  for (let i = 0; i < l.length; i++) if (l.slice(0, i) + l.slice(i + 1) === s) return true;
  return false;
}

export function assemble(input: AssembleInput): WapParseResult {
  const { shapes, time, layout, legend, ownUnit } = input;
  const aliases = aliasMap(input.groupAliases);
  const diagnostics: string[] = [];
  const pending: PendingConflict[] = [];
  const dayOrder = (day: TbWeekday) => TB_WEEKDAYS.indexOf(day);
  const blockOf = (day: TbWeekday) => layout.days.find((d) => d.day === day);
  const dayAt = (x: number): TbWeekday | null =>
    layout.days.find((d) => x >= d.x0 && x < d.x1)?.day ?? null;
  const toMin = (y: number) => time.toMinutes(y);
  const perHour =
    (time.labels[time.labels.length - 1].y - time.labels[0].y) /
    ((time.labels[time.labels.length - 1].minutes - time.labels[0].minutes) / 60);

  // --- classify shapes -------------------------------------------------------
  const gridX0 = layout.days[0].x0,
    gridX1 = layout.days[layout.days.length - 1].x1;
  const lastLabelY = time.labels[time.labels.length - 1].y;
  const textShapes = shapes.filter(
    (s) =>
      s.kind === 'sp' &&
      !time.labelShapes.has(s.index) &&
      !IGNORED_GEOMETRY.test(s.geometry) &&
      s.lines.some(Boolean),
  );
  const footnoteBoxes = textShapes.filter((s) => isFootnoteBox(s, time));
  const rest = textShapes.filter((s) => !footnoteBoxes.includes(s));
  const cx = (b: Box) => (b.x0 + b.x1) / 2;
  const side = rest.filter((s) => s.box.x0 >= gridX1 - perHour / 4 && s.box.y0 < lastLabelY);
  const inGrid = rest.filter(
    (s) =>
      !side.includes(s) &&
      cx(s.box) >= gridX0 &&
      cx(s.box) <= gridX1 &&
      s.box.y1 > time.gridTop &&
      s.box.y0 < time.gridBottom,
  );
  const occluders = shapes.filter((s) => (s.kind === 'sp' && s.fill) || s.kind === 'pic');
  const visible = inGrid.filter((s) => coveredShare(s, occluders) < 0.9);
  if (visible.length < inGrid.length)
    diagnostics.push(`Verdeckte Kästchen ignoriert: ${inGrid.length - visible.length}`);

  const markers = visible.filter((s) => {
    if (markerNumber(s) == null) return false;
    const day = blockOf(dayAt(cx(s.box)) ?? 'Mo');
    return (
      s.box.y1 - s.box.y0 <= perHour * 3 && (!day || s.box.x1 - s.box.x0 <= (day.x1 - day.x0) / 3)
    );
  });
  const boxes = visible.filter((s) => !markers.includes(s));

  /** Visible vertical extent: later full-width boxes can hide the top or bottom part. */
  const visibleSpan = (shape: WapShape): [number, number] => {
    let y0 = shape.box.y0,
      y1 = shape.box.y1;
    const width = shape.box.x1 - shape.box.x0;
    const covering = occluders.filter(
      (o) =>
        o.index > shape.index &&
        overlap1d(o.box.x0, o.box.x1, shape.box.x0, shape.box.x1) >= 0.9 * width,
    );
    for (let pass = 0; pass < 4; pass++)
      for (const o of covering) {
        const tol = (y1 - y0) * 0.02;
        if (o.box.y0 <= y0 + tol && o.box.y1 > y0 && o.box.y1 < y1) y0 = o.box.y1;
        if (o.box.y1 >= y1 - tol && o.box.y0 < y1 && o.box.y0 > y0) y1 = o.box.y0;
      }
    return [y0, y1];
  };

  // --- grid boxes → drafts ---------------------------------------------------
  const drafts: Draft[] = [];
  let seq = 0;
  const placements = new Map<number, Placement>();
  for (const shape of boxes) {
    const placement = placeBox(shape.box, layout);
    if (!placement) continue;
    placements.set(shape.index, placement);
    const [visibleTop, visibleBottom] = visibleSpan(shape);
    const rawStart = toMin(visibleTop),
      rawEnd = toMin(visibleBottom);
    const leitung: TbLeitung = legend.leitungOf(shape.fill);
    const rawText = shape.lines.filter(Boolean).join(' / ');
    const parsed = parseBoxText(shape.lines, ownUnit);
    const groupCount = groupColumnsOf(blockOf(placement.day) ?? layout.days[0]).length;
    const refs: string[] = [];
    for (const activity of parsed.activities) {
      let taetigkeit = activity.taetigkeit;
      const code = legend.abbreviations.get(taetigkeit.replace(/\s+/g, ''));
      if (code) taetigkeit = applyContentRules(code);
      if (!taetigkeit) continue;
      const { section, general } = sectionOf(placement, taetigkeit, groupCount);
      const flags: string[] = [];
      let zeit: string, sortTime: number;
      const s = round15(rawStart),
        e = round15(rawEnd);
      if (activity.labelTime != null) {
        zeit = hhmm(activity.labelTime);
        sortTime = activity.labelTime;
        flags.push('Zeit aus Beschriftung');
        if (activity.labelTime < rawStart - 15 || activity.labelTime > rawEnd + 15) {
          flags.push('Label-Zeit ≠ Position');
          pending.push({
            type: 'label_vs_position',
            day: placement.day,
            message: `Beschriftung ${hhmm(activity.labelTime)}, im WAP aber bei ${rangeText(s, e)} eingezeichnet.`,
            refs: [`d${seq}`],
          });
        }
      } else if (activity.anschl) {
        zeit = 'anschl';
        sortTime = rawStart;
        flags.push('anschliessend (Position als Hinweis)');
      } else if (activity.point) {
        zeit = hhmm(s);
        sortTime = s;
        flags.push('Zeit aus Position');
      } else {
        zeit = rangeText(s, e);
        sortTime = s;
        flags.push('Zeit aus Position');
      }
      const finalSection: TbSection =
        section === 'rapporte' && isWeekend(placement.day) ? 'besonderes' : section;
      const columns = placement.columns.map((c) => aliasOf(c.label, aliases)).filter(Boolean);
      drafts.push({
        seq,
        day: placement.day,
        section: finalSection,
        general,
        groupColumns: placement.groupColumns,
        zeit,
        sortTime,
        taetigkeit,
        verantwortlich: activity.verantwortlich,
        ort: activity.ort,
        source: {
          kind: 'box',
          rawText,
          rawStart: Math.round(rawStart),
          rawEnd: Math.round(rawEnd),
          leitung,
          columns,
          flags,
        },
        shape: shape.index,
        rawText,
        keyRef: `d${seq}`,
        x: shape.box.x0,
      });
      refs.push(`d${seq}`);
      seq++;
    }
    if (parsed.split && refs.length > 1)
      pending.push({
        type: 'ambiguous',
        day: placement.day,
        message:
          'Kästchen enthält mehrere Tätigkeiten und wurde aufgeteilt – bitte Aufteilung prüfen.',
        refs,
      });
  }

  // --- footnotes -------------------------------------------------------------
  const footnotes = readFootnotes(footnoteBoxes, dayAt);
  const byNr = new Map<number, Footnote>();
  for (const fn of footnotes) {
    if (byNr.has(fn.nr)) diagnostics.push(`Fussnotennummer mehrfach vergeben: ${fn.nr}`);
    else byNr.set(fn.nr, fn);
  }
  const markerByNr = new Map<number, WapShape>();
  for (const marker of markers) {
    const nr = markerNumber(marker) as number;
    if (!markerByNr.has(nr)) markerByNr.set(nr, marker);
  }
  const boxDrafts = [...drafts];
  const weight = tokenWeights([
    ...new Set([...boxDrafts.map((d) => d.rawText), ...footnotes.map((f) => f.body)]),
  ]);
  for (const [nr, fn] of [...byNr.entries()].sort((a, b) => a[0] - b[0])) {
    const marker = markerByNr.get(nr);
    const markerDay = marker ? dayAt(cx(marker.box)) : null;
    const day = markerDay ?? fn.day ?? dayOfNumber(nr);
    if (!day || !blockOf(day)) {
      diagnostics.push(`Fussnote ohne zuordenbaren Tag: ${nr}`);
      continue;
    }
    const fields = parseFootnoteBody(fn.body, ownUnit);
    const mTop = marker ? toMin(marker.box.y0) : null;
    const mBottom = marker ? toMin(marker.box.y1) : null;
    const mCentre = marker ? toMin((marker.box.y0 + marker.box.y1) / 2) : null;
    const fnStart = fn.time?.start ?? mCentre;
    // Footnote repeating a grid box → merge into that entry.
    let target: Draft | null = null,
      score = 0;
    if (fnStart != null)
      for (const draft of boxDrafts) {
        if (draft.day !== day || draft.source.footnote) continue;
        const rs = draft.source.rawStart ?? 0,
          re = draft.source.rawEnd ?? rs;
        const times = [fnStart, mTop, mCentre].filter((t): t is number => t != null);
        if (!times.some((t) => t >= rs - 15 && t <= re + 15)) continue;
        // Raw box wording only (expansions like "Fassung" would create false matches).
        const shared = sharedTokens(fn.body, draft.rawText);
        const value = shared.reduce((sum, token) => sum + weight(token), 0);
        if (shared.length < 2 || value < MERGE_SCORE) continue;
        if (value > score) {
          score = value;
          target = draft;
        }
      }
    if (target) {
      const rs = round15(target.source.rawStart ?? 0),
        re = round15(target.source.rawEnd ?? 0);
      let prefix = '';
      if (fn.time && fn.time.kind !== 'range') prefix = `${footnoteZeit(fn.time)} `;
      // Drop the footnote's first clause when it only repeats the box wording.
      const [firstClause, ...restClauses] = fields.taetigkeit.split(/(?<=[,;])\s*/);
      const boxTokens = significantTokens(`${target.rawText} ${target.taetigkeit}`);
      const repeats =
        restClauses.length > 0 &&
        significantTokens(firstClause).every((t) => boxTokens.includes(t));
      const addition = repeats ? restClauses.join(' ').replace(/^[,;]\s*/, '') : fields.taetigkeit;
      target.taetigkeit = applyContentRules(`${target.taetigkeit}; ${prefix}${addition}`);
      if (fields.verantwortlich && !target.verantwortlich.includes(fields.verantwortlich))
        target.verantwortlich = target.verantwortlich
          ? `${fields.verantwortlich} / ${target.verantwortlich}`
          : fields.verantwortlich;
      if (!target.ort) target.ort = fields.ort;
      target.source = {
        ...target.source,
        footnote: String(nr),
        rawText: `${target.source.rawText} ‖ ${fn.raw}`,
        flags: [...(target.source.flags ?? []), `Fussnote ${nr} zusammengeführt`],
      };
      const differs =
        fn.time &&
        (fn.time.kind === 'range'
          ? Math.abs(fn.time.start - rs) >= 15 ||
            Math.abs((fn.time.end ?? fn.time.start) - re) >= 15
          : fn.time.start < rs - 15 || fn.time.start > re + 15);
      if (differs && fn.time)
        pending.push({
          type: 'footnote_vs_box',
          day,
          message: `Fussnote ${nr} (${footnoteZeit(fn.time)}) weicht vom Kästchen (${rangeText(rs, re)}) ab; Einträge zusammengeführt.`,
          refs: [target.keyRef],
          key: `fn${nr}`,
        });
      continue;
    }
    // Standalone footnote entry.
    const flags: string[] = [];
    let zeit: string, sortTime: number;
    if (fn.time) {
      zeit = footnoteZeit(fn.time);
      sortTime = fn.time.start;
      flags.push('Zeit aus Fussnote');
      if (
        mTop != null &&
        mBottom != null &&
        (fn.time.start < mTop - 45 || fn.time.start > mBottom + 45)
      )
        pending.push({
          type: 'footnote_vs_box',
          day,
          message: `Fussnote ${nr}: Zeit ${footnoteZeit(fn.time)}, Markierung im WAP bei ~${hhmm(round15(mTop))}.`,
          refs: [`d${seq}`],
          key: `fn${nr}`,
        });
    } else if (mCentre != null) {
      zeit = hhmm(round15(mCentre));
      sortTime = round15(mCentre);
      flags.push('Zeit aus Position, Fussnote ohne Zeit');
      pending.push({
        type: 'footnote_without_time',
        day,
        message: `Fussnote ${nr} ohne Zeit – Zeit aus der Markierung übernommen (~${zeit}).`,
        refs: [`d${seq}`],
        key: `fn${nr}`,
      });
    } else {
      zeit = '';
      sortTime = 24 * 60;
      flags.push('Fussnote ohne Zeit und ohne Markierung');
      pending.push({
        type: 'footnote_without_time',
        day,
        message: `Fussnote ${nr} ohne Zeit und ohne Markierung im Raster.`,
        refs: [`d${seq}`],
        key: `fn${nr}`,
      });
    }
    if (!marker) {
      flags.push('Fussnote ohne Markierung');
      pending.push({
        type: 'footnote_missing_marker',
        day,
        message: `Fussnote ${nr} hat keine Markierung im Raster.`,
        refs: [`d${seq}`],
        key: `fn${nr}`,
      });
    }
    const rapport = isRapport(fields.taetigkeit);
    drafts.push({
      seq,
      day,
      section: rapport && !isWeekend(day) ? 'rapporte' : 'besonderes',
      general: true,
      groupColumns: [],
      zeit,
      sortTime,
      taetigkeit: fields.taetigkeit,
      verantwortlich: fields.verantwortlich,
      ort: fields.ort,
      source: {
        kind: 'footnote',
        rawText: fn.raw,
        ...(mTop != null && mBottom != null
          ? { rawStart: Math.round(mTop), rawEnd: Math.round(mBottom) }
          : {}),
        footnote: String(nr),
        flags,
      },
      shape: -1,
      rawText: fn.raw,
      keyRef: `d${seq}`,
      x: marker?.box.x0 ?? 0,
    });
    seq++;
  }
  for (const [nr, marker] of markerByNr) {
    if (byNr.has(nr)) continue;
    const day = dayAt(cx(marker.box));
    if (!day) continue;
    const centre = round15(toMin((marker.box.y0 + marker.box.y1) / 2));
    drafts.push({
      seq,
      day,
      section: 'besonderes',
      general: true,
      groupColumns: [],
      zeit: hhmm(centre),
      sortTime: centre,
      taetigkeit: `Fussnote ${nr} (Text fehlt im WAP)`,
      verantwortlich: '',
      ort: '',
      source: {
        kind: 'footnote',
        rawText: String(nr),
        rawStart: Math.round(toMin(marker.box.y0)),
        rawEnd: Math.round(toMin(marker.box.y1)),
        footnote: String(nr),
        flags: ['Markierung ohne Fussnotentext'],
      },
      shape: marker.index,
      rawText: String(nr),
      keyRef: `d${seq}`,
      x: marker.box.x0,
    });
    pending.push({
      type: 'footnote_missing_text',
      day,
      message: `Markierung ${nr} im Raster, aber kein Fussnotentext gefunden.`,
      refs: [`d${seq}`],
      key: `fn${nr}`,
    });
    seq++;
  }

  // --- duplicates (same item drawn twice, e.g. in a group column and in Rap) ---
  const removed = new Map<string, string>();
  const kept: Draft[] = [];
  for (const draft of drafts) {
    const twin = kept.find(
      (k) =>
        k.day === draft.day &&
        k.section === draft.section &&
        k.general === draft.general &&
        fold(k.taetigkeit) === fold(draft.taetigkeit) &&
        k.source.rawStart != null &&
        draft.source.rawStart != null &&
        overlap1d(
          k.source.rawStart,
          k.source.rawEnd ?? k.source.rawStart,
          draft.source.rawStart,
          draft.source.rawEnd ?? draft.source.rawStart,
        ) >=
          0.5 *
            Math.min(
              (k.source.rawEnd ?? k.source.rawStart) - k.source.rawStart,
              (draft.source.rawEnd ?? draft.source.rawStart) - draft.source.rawStart,
            ) &&
        k.source.kind === 'box' &&
        draft.source.kind === 'box' &&
        // Identical boxes in different group columns are separate items, not duplicates.
        (k.section !== 'dienstbetrieb' ||
          k.general ||
          k.groupColumns.some((c) => draft.groupColumns.includes(c))),
    );
    if (!twin) {
      kept.push(draft);
      continue;
    }
    removed.set(draft.keyRef, twin.keyRef);
    const start = Math.min(twin.source.rawStart ?? 0, draft.source.rawStart ?? 0);
    const end = Math.max(twin.source.rawEnd ?? 0, draft.source.rawEnd ?? 0);
    twin.source = {
      ...twin.source,
      rawStart: start,
      rawEnd: end,
      flags: [...(twin.source.flags ?? []), 'Im WAP doppelt eingezeichnet'],
    };
    twin.verantwortlich ||= draft.verantwortlich;
    twin.ort ||= draft.ort;
    if (/^\d{4} - \d{4}$/.test(twin.zeit)) twin.zeit = rangeText(round15(start), round15(end));
    twin.groupColumns = [...new Set([...twin.groupColumns, ...draft.groupColumns])].sort(
      (a, b) => a - b,
    );
  }

  // --- group headings -----------------------------------------------------------
  const clustersBySignature = new Map<string, number[]>();
  const layoutSignature = (day: TbWeekday) =>
    groupColumnsOf(blockOf(day) ?? layout.days[0])
      .map((c) => fold(c.label))
      .join('|');
  for (const block of layout.days) {
    const labels = groupColumnsOf(block).map((c) => c.label);
    const signature = layoutSignature(block.day);
    if (!isStufenLayout(labels) || clustersBySignature.has(signature)) continue;
    const spans = kept
      .filter(
        (d) =>
          d.section === 'dienstbetrieb' &&
          !d.general &&
          d.groupColumns.length > 1 &&
          layoutSignature(d.day) === signature,
      )
      .map((d) => d.groupColumns);
    clustersBySignature.set(signature, stufenClusters(labels.length, spans));
  }

  const groups: Partial<Record<TbWeekday, string[]>> = {};
  const columnsOut: Partial<Record<TbWeekday, string[]>> = {};
  const placed: { draft: Draft; group: string; groupRank: number }[] = [];
  for (const block of layout.days) {
    const labels = groupColumnsOf(block).map((c) => c.label);
    columnsOut[block.day] = block.columns.map((c) => c.label).filter(Boolean);
    const dayDrafts = kept.filter((d) => d.day === block.day);
    const grouped = dayDrafts.filter((d) => d.section === 'dienstbetrieb' && !d.general);
    const items: (GroupItem & { draft: Draft })[] = grouped.map((draft) => ({
      draft,
      columns: draft.groupColumns,
      signature: `${draft.zeit}|${fold(draft.taetigkeit)}`,
    }));
    const clusters = clustersBySignature.get(layoutSignature(block.day));
    const { units, unitOf } = clusters
      ? stufenHeadings(labels, clusters, items, aliases)
      : unitHeadings(labels, items, aliases);
    const headings: string[] = [];
    // Identical boxes drawn in merged sibling columns appear once under the heading.
    const inUnit = new Map<number, Map<string, Draft>>();
    for (const item of items) {
      const indices = unitOf(item);
      if (!indices.length) {
        placed.push({ draft: item.draft, group: '', groupRank: 0 });
        continue;
      }
      let twin: Draft | undefined;
      let used = false;
      for (const index of indices) {
        const signatures = inUnit.get(index) ?? new Map<string, Draft>();
        inUnit.set(index, signatures);
        const existing = signatures.get(item.signature);
        if (existing) {
          twin = existing;
          continue;
        }
        signatures.set(item.signature, item.draft);
        placed.push({ draft: item.draft, group: units[index].heading, groupRank: 1 + index });
        used = true;
      }
      if (!used && twin) removed.set(item.draft.keyRef, twin.keyRef);
    }
    units.forEach((unit, index) => {
      if (placed.some((p) => p.draft.day === block.day && p.groupRank === 1 + index))
        headings.push(unit.heading);
    });
    if (headings.length) groups[block.day] = [...new Set(headings)];
    for (const draft of dayDrafts)
      if (!grouped.includes(draft)) placed.push({ draft, group: '', groupRank: 0 });
  }

  // --- order, ids, rules --------------------------------------------------------
  const sectionRank = (p: { draft: Draft; groupRank: number }) =>
    p.draft.section === 'dienstbetrieb'
      ? p.groupRank
      : p.draft.section === 'besonderes'
        ? 1000
        : 2000;
  placed.sort(
    (a, b) =>
      dayOrder(a.draft.day) - dayOrder(b.draft.day) ||
      sectionRank(a) - sectionRank(b) ||
      a.draft.sortTime - b.draft.sortTime ||
      a.draft.x - b.draft.x ||
      a.draft.seq - b.draft.seq,
  );
  const slug = sheetSlug(input.sheetName);
  const counters = new Map<TbWeekday, number>();
  const idsByRef = new Map<string, string[]>();
  const entries: TbEntry[] = placed.map(({ draft, group }) => {
    const n = (counters.get(draft.day) ?? 0) + 1;
    counters.set(draft.day, n);
    const id = `${slug}_${draft.day}_${n}`;
    idsByRef.set(draft.keyRef, [...(idsByRef.get(draft.keyRef) ?? []), id]);
    const base: TbEntry = {
      id,
      day: draft.day,
      section: draft.section,
      group: draft.section === 'dienstbetrieb' ? group : '',
      zeit: draft.zeit,
      taetigkeit: draft.taetigkeit,
      verantwortlich: draft.verantwortlich,
      ort: draft.ort,
      source: { ...draft.source, flags: [...new Set(draft.source.flags ?? [])] },
    };
    const leitung = draft.source.leitung;
    const specific = input.rules.filter((r) => r.leitung && r.leitung === leitung);
    return applyRules(applyRules(base, specific), input.rules);
  });
  for (const [from, to] of removed) idsByRef.set(from, idsByRef.get(to) ?? []);

  // --- naming: near-identical codes (e.g. a letter swapped) --------------------
  const codeSources = new Map<string, Set<string>>();
  const addCodes = (text: string, ref: string) => {
    for (const code of codeTokens(text))
      codeSources.set(code, new Set([...(codeSources.get(code) ?? []), ref]));
  };
  for (const draft of drafts) addCodes(`${draft.rawText} ${draft.verantwortlich}`, draft.keyRef);
  for (const fn of footnotes) addCodes(fn.raw, `fn${fn.nr}`);
  const codes = [...codeSources.keys()];
  for (const a of codes)
    for (const b of codes) {
      if (a >= b || !editDistanceOne(a, b)) continue;
      // Flag the rarer spelling on the entries that use it.
      const [rare, common] =
        (codeSources.get(a)?.size ?? 0) <= (codeSources.get(b)?.size ?? 0) ? [a, b] : [b, a];
      const refs = [...(codeSources.get(rare) ?? [])].filter((r) => r.startsWith('d'));
      const byDay = new Map<TbWeekday, string[]>();
      for (const ref of refs) {
        const draft = drafts.find((d) => d.keyRef === ref);
        if (draft) byDay.set(draft.day, [...(byDay.get(draft.day) ?? []), ref]);
      }
      for (const [day, dayRefs] of byDay)
        pending.push({
          type: 'naming',
          day,
          message: `Schreibweise prüfen: «${rare}» ähnlich «${common}» an anderer Stelle im WAP.`,
          refs: dayRefs,
          key: `${rare}`,
        });
    }

  // --- conflicts with stable ids -------------------------------------------------
  const conflicts: TbConflict[] = [];
  const seen = new Set<string>();
  for (const p of pending) {
    const entryIds = [...new Set(p.refs.flatMap((ref) => idsByRef.get(ref) ?? []))].sort();
    const id = `${p.type}_${p.day}_${entryIds.join('+')}${p.key ? `_${fold(p.key).replace(/\s+/g, '')}` : ''}`;
    if (seen.has(id)) continue;
    seen.add(id);
    conflicts.push({ id, day: p.day, type: p.type, message: p.message, entryIds });
  }
  conflicts.sort((a, b) => dayOrder(a.day) - dayOrder(b.day) || a.id.localeCompare(b.id));

  // --- side boxes: Wochenziele / Bemerkungen -------------------------------------
  const notes = { wochenziele: [] as string[], bemerkungen: [] as string[] };
  const headerCell = (re: RegExp) =>
    input.sheet.cells.find((c) => re.test(c.text) && input.sheet.colX(c.col) >= gridX1 - 1);
  const bemCell = headerCell(/^\s*bemerkungen/i);
  const legCell = headerCell(/^\s*legende/i);
  const bemY = bemCell ? input.sheet.rowY(bemCell.row) : Number.POSITIVE_INFINITY;
  const legY = legCell ? input.sheet.rowY(legCell.row) : Number.POSITIVE_INFINITY;
  const cleanLine = (line: string) => applyContentRules(line.replace(/^\s*[-–•·*]\s*/, ''));
  for (const box of side.sort((a, b) => a.box.y0 - b.box.y0)) {
    const lines = box.lines.filter(Boolean);
    const first = lines[0] ?? '';
    const cy = (box.box.y0 + box.box.y1) / 2;
    let target: 'wochenziele' | 'bemerkungen' | null = null;
    if (/^\s*bemerkungen/i.test(first)) target = 'bemerkungen';
    else if (/^\s*wochenziele/i.test(first)) target = 'wochenziele';
    else if (cy >= legY) target = null;
    else target = cy >= bemY ? 'bemerkungen' : 'wochenziele';
    if (!target) continue;
    const body = /^\s*(?:bemerkungen|wochenziele)/i.test(first) ? lines.slice(1) : lines;
    notes[target].push(...body.map(cleanLine).filter(Boolean));
  }

  // --- diagnostics (data-free) ----------------------------------------------------
  const first = time.labels[0],
    last = time.labels[time.labels.length - 1];
  diagnostics.unshift(
    `Stundenmarken: ${time.labels.length} (${hhmm(first.minutes)}–${hhmm(last.minutes)})`,
    `Tage: ${layout.days.map((d) => d.day).join(', ')}`,
    `Kästchen: ${boxes.length}, Markierungen: ${markers.length}, Fussnoten: ${footnotes.length}`,
    `Legende: ${Object.values(legend.fromSheet).filter(Boolean).length} Farben aus dem Tabellenblatt`,
    `Datum: ${layout.startDate ? 'aus dem Tabellenblatt' : 'nicht gefunden'}`,
  );
  // Sanity check: red connector lines (AV/HV) should sit on a full hour.
  const red = shapes.filter(
    (s) => s.kind === 'cxn' && (s.fill === 'FF0000' || s.line === 'FF0000') && dayAt(cx(s.box)),
  );
  if (red.length) {
    const offsets = red.map((s) => {
      const m = toMin((s.box.y0 + s.box.y1) / 2);
      return Math.abs(m - Math.round(m / 60) * 60);
    });
    diagnostics.push(
      `Rote Linien: ${red.length}, grösste Abweichung zur vollen Stunde ${Math.round(Math.max(...offsets))} min`,
    );
  }

  return {
    sheet: input.sheetName,
    startDate: layout.startDate,
    days: layout.days.map((d) => d.day),
    entries,
    groups,
    columns: columnsOut,
    conflicts,
    notes,
    diagnostics,
  };
}
