// Excel-Import Kp als ein Befehl (Vertrag E1-08 §1; ADR-008 Entscheid 3, 3a; Beschrieb 8.2 Regel 8–10).
// Rein: liest die Arbeitsmappe nicht selbst; IDs aus plan.nextId (ADR-002 Punkt 8b).

import { addDays, daysBetween } from '../../model/wap/calendar';
import { type CommandContext, command, entryError } from '../../model/wap/commands/command';
import type {
  Column,
  ColumnSelection,
  ColumnSet,
  DayConfig,
  Entry,
  Id,
  IsoDate,
  Plan,
  Week,
  WeekGoal,
} from '../../model/wap/types';
import type { Workbook } from '../xlsx-drawing/index';
import {
  analyzeSheet,
  type ColumnDraft,
  type ColumnPick,
  type DayDraft,
  type SheetDraft,
  WEEKDAYS,
} from './sheet';
import {
  ImportError,
  type ImportOptions,
  type ImportReport,
  type ImportReportItem,
  type SheetBalance,
} from './types';

export interface ImportOutcome {
  readonly result: import('../../model/wap/commands/command').CommandResult;
  readonly report: ImportReport;
}

const columnSignature = (cols: readonly ColumnDraft[]): string =>
  JSON.stringify(cols.map((c) => [c.name, c.kind, c.weight]));

function serviceOf(beilage: string): string {
  return (
    /\b((?:FDT|WK|KVK|RS|UOS|OS|ES|AVS)\s*\d{4})\b/i.exec(beilage)?.[1]?.replace(/\s+/g, ' ') ?? ''
  );
}

function setName(sheet: SheetDraft, days: readonly DayDraft[]): string {
  const names = days.map((d) => d.weekday);
  const label = names.length > 2 ? `${names[0] ?? ''}–${names.at(-1) ?? ''}` : names.join(', ');
  return `${sheet.shortName} ${label}`;
}

/**
 * Rein. Ersetzt den Inhalt eines frisch aus der Vorlage erzeugten Plans durch das Importergebnis als **ein**
 * Befehl (Undo, R-5.6-14); Beso-Nummern fixiert durch den ersten Stand (R-8.2-23, Vertrag E1-03 Notiz);
 * erster Stand mit dem Stand-Datum der Datei (R-8.2-24). Fehler: ImportError 'noWeekSheets'.
 */
export function importKpWorkbook(
  target: Plan,
  workbook: Workbook,
  fileName: string,
  options: ImportOptions,
  ctx: CommandContext,
): ImportOutcome {
  const rapportCodes = [
    ...new Set([
      ...options.template.rapportCodes.map((r) => r.code),
      ...target.rapportCodes.map((r) => r.code),
    ]),
  ];
  const drafts: { draft: SheetDraft; shapes: number }[] = [];
  workbook.sheets.forEach((sheet, i) => {
    if (sheet.hidden) return;
    const draft = analyzeSheet(sheet, {
      plan: target,
      formText: {
        persons: options.persons,
        functionList: options.functionList,
        ltgInBlock: options.template.ltgInBlock,
      },
      date1904: workbook.date1904,
      rapportCodes,
      prefix: `s${i}:`,
    });
    if (draft !== null) drafts.push({ draft, shapes: sheet.shapes.length });
  });
  if (drafts.length === 0) throw new ImportError('noWeekSheets');
  drafts.sort((a, b) => (a.draft.startDate < b.draft.startDate ? -1 : 1));

  let nextId = target.nextId;
  let nextSeq = target.nextSeq;
  const newId = (prefix: string): Id => `${prefix}${nextId++}`;

  // Spaltensätze (dedupliziert über Name, Art und Gewicht) und Wochen.
  const columnSets: ColumnSet[] = [];
  const setBySignature = new Map<string, ColumnSet>();
  const weeks: Week[] = [];
  const dayColumnsOf = new Map<string, readonly Column[]>(); // `${sheet}|${weekday}`
  const weekIdOf = new Map<string, Id>();
  for (const { draft } of drafts) {
    const weekId = newId('w');
    weekIdOf.set(draft.sheet, weekId);
    const groups = new Map<string, DayDraft[]>();
    for (const d of draft.days) {
      if (d.columns === null) continue;
      const sig = columnSignature(d.columns);
      groups.set(sig, [...(groups.get(sig) ?? []), d]);
    }
    for (const [sig, ds] of groups) {
      let set = setBySignature.get(sig);
      if (set === undefined) {
        const first = ds[0];
        set = {
          id: newId('s'),
          name: setName(draft, ds),
          columns: (first?.columns ?? []).map(
            (c): Column => ({
              id: newId('c'),
              name: c.name,
              kind: c.kind,
              weight: c.weight,
              labelOrientation: 'horizontal',
              defaultCategoryId: null,
              origin: 'manual',
            }),
          ),
        };
        setBySignature.set(sig, set);
        columnSets.push(set);
      }
      for (const d of ds) dayColumnsOf.set(`${draft.sheet}|${d.weekday}`, set.columns);
    }
    const days = WEEKDAYS.map((weekday): DayConfig => {
      const d = draft.days.find((x) => x.weekday === weekday);
      const cols = d?.columns;
      const set =
        cols === null || cols === undefined ? undefined : setBySignature.get(columnSignature(cols));
      return {
        weekday,
        columnSetId: set?.id ?? columnSets[0]?.id ?? null,
        display: d?.display ?? 'hidden',
        internalNote: '',
      };
    }) as unknown as Week['days'];
    const goals: WeekGoal[] = draft.weekGoals.map((text) => ({
      id: newId('g'),
      text,
      group: null,
    }));
    weeks.push({
      id: weekId,
      label: draft.label,
      shortName: draft.shortName,
      startDate: draft.startDate,
      days,
      weekGoals: goals,
      heightenedReadiness: draft.heightenedReadiness,
      sunOverride: { sunrise: draft.sun.sunrise, sunset: draft.sun.sunset },
      agendaWeekend: 'auto',
      hiddenRemarkIds: [],
    });
  }
  // Ausgeblendete Tage ohne Spaltensatz erhalten den ersten Satz der Woche (Daten bleiben gültig).
  for (const w of weeks) {
    const fallback =
      w.days.find((d) => d.columnSetId !== null)?.columnSetId ?? columnSets[0]?.id ?? null;
    (w as { days: Week['days'] }).days = w.days.map((d) =>
      d.columnSetId === null ? { ...d, columnSetId: fallback } : d,
    ) as unknown as Week['days'];
  }

  const entryIdOf = new Map<string, Id>();
  const entries: Record<Id, Entry> = {};
  const dropped: {
    sheet: string;
    shapes: readonly number[];
    cause: string;
    date: IsoDate | null;
  }[] = [];

  const basePlan: Plan = {
    ...target,
    weeks,
    columnSets,
    entries: {},
    deletedWeeks: [],
  };

  const selection = (pick: ColumnPick, cols: readonly Column[]): ColumnSelection =>
    pick.kind === 'all'
      ? { kind: 'all' }
      : {
          kind: 'ids',
          ids: pick.indexes.map((i) => cols[i]?.id).filter((x): x is Id => x !== undefined),
        };

  // Querbalken über mehrere Blätter: gleicher Titel und Zeitraum → ein Eintrag (R-4.6-10).
  const querbalkenSeen = new Map<string, Id>();
  // Kp-Bemerkungen «gelten durchgehend» (Beschrieb 4.2, R-4.2-07/-08): einmal pro Plan, je Woche ausblendbar.
  const planWideRemarks = options.template.id === 'kp';
  const remarkBySig = new Map<string, Id>();
  const remarksOfSheet = new Map<string, Id[]>();

  for (const { draft } of drafts) {
    const weekId = weekIdOf.get(draft.sheet) ?? '';
    for (const d of draft.entries) {
      const date =
        'weekday' in d
          ? addDays(draft.startDate, WEEKDAYS.indexOf(d.weekday))
          : 'date' in d
            ? d.date
            : null;
      const cols =
        'weekday' in d
          ? (dayColumnsOf.get(`${draft.sheet}|${d.weekday}`) ?? [])
          : d.type === 'beso'
            ? (dayColumnsOf.get(
                `${draft.sheet}|${WEEKDAYS[(daysBetween(draft.startDate, d.date) + 7) % 7] ?? 'Mo'}`,
              ) ?? [])
            : [];
      if (d.type === 'querbalken') {
        const sig = `${d.title.map((r) => r.text).join('')}|${d.fromDate}|${d.toDate}`;
        const existing = querbalkenSeen.get(sig);
        if (existing !== undefined) {
          entryIdOf.set(d.key, existing);
          continue;
        }
      }
      const remarkSig =
        d.type === 'multiDayRemark' && planWideRemarks
          ? `${String(d.number ?? '')}|${d.text.replace(/\s+/g, ' ').trim()}`
          : null;
      if (remarkSig !== null) {
        const existing = remarkBySig.get(remarkSig);
        if (existing !== undefined) {
          entryIdOf.set(d.key, existing);
          remarksOfSheet.set(draft.sheet, [...(remarksOfSheet.get(draft.sheet) ?? []), existing]);
          continue;
        }
      }
      const id = newId('e');
      const seq = nextSeq++;
      const common = {
        id,
        status: d.status,
        changed: d.changed,
        createdSeq: seq,
        internalNote: '',
        removedText: [...d.removedText],
      };
      let entry: Entry;
      switch (d.type) {
        case 'block':
          entry = {
            ...common,
            type: 'block',
            date: date ?? draft.startDate,
            time: d.time,
            columns: selection(d.columns, cols),
            title: [...d.title],
            supplement: d.supplement,
            ltg: d.ltg,
            tn: '',
            tpt: '',
            ort: d.ort,
            tenue: d.tenue,
            printTn: target.printDefaults.printTn,
            printTenue: target.printDefaults.printTenue,
            categoryId: d.categoryId,
            secondCategoryId: d.secondCategoryId,
            textDirection: 'auto',
            openEnd: d.openEnd,
            ...(d.subtasks.length > 0
              ? { subtasks: d.subtasks.map((s) => ({ ...s, title: [...s.title] })) }
              : {}),
          };
          break;
        case 'querbalken':
          entry = {
            ...common,
            type: 'querbalken',
            title: [...d.title],
            fromDate: d.fromDate,
            toDate: d.toDate,
            columns: { kind: 'all' },
            categoryId: d.categoryId,
          };
          querbalkenSeen.set(
            `${d.title.map((r) => r.text).join('')}|${d.fromDate}|${d.toDate}`,
            id,
          );
          break;
        case 'marker':
          entry = {
            ...common,
            type: 'marker',
            date: date ?? draft.startDate,
            at: d.at,
            kind: d.kind,
            customKind: d.customKind,
            // Immer über alle Planungsspalten (Entscheid Auftraggeber 21.10.2026), unabhängig von der Form.
            columns: { kind: 'all' },
            asFlatBlock: d.asFlatBlock,
            ...(d.flatBlockMinutes === null ? {} : { flatBlockMinutes: d.flatBlockMinutes }),
          };
          break;
        case 'rapport':
          entry = {
            ...common,
            type: 'rapport',
            date: date ?? draft.startDate,
            code: d.code,
            time: d.time,
            ort: d.ort,
            tn: '',
            categoryId: d.categoryId,
            display:
              d.displayColumns === null ? 'rapColumn' : d.inRap ? 'alsoInColumns' : 'onlyInColumns',
            displayColumns:
              d.displayColumns === null
                ? { kind: 'ids', ids: [] }
                : selection(d.displayColumns, cols),
          };
          break;
        case 'beso':
          entry = {
            ...common,
            type: 'beso',
            date: d.date,
            title: [...d.title],
            windows: d.windows.map((w) => ({
              id: newId('t'),
              time: w.time,
              columnId: w.column === null ? null : (cols[w.column]?.id ?? null),
              supplement: w.supplement,
            })),
            ltg: d.ltg,
            tn: d.tn,
            tpt: d.tpt,
            ort: d.ort,
            categoryId: d.categoryId,
            besoNumber: d.besoNumber,
            // Regel 10: importierte Nummern gelten als fixiert, auch ohne Stand-Datum (CR-H-D-03).
            numberFixed: true,
            agendaOverride: d.agendaOverride,
          };
          break;
        case 'dayRemark':
          entry = { ...common, type: 'dayRemark', date: d.date, text: d.text };
          break;
        case 'multiDayRemark':
          entry = {
            ...common,
            type: 'multiDayRemark',
            text: d.text,
            scope: planWideRemarks ? { kind: 'plan' } : { kind: 'week', weekId },
            number: d.number,
            refBoxColumnId: null,
          };
          break;
      }
      const error = entryError(basePlan, entry);
      if (error !== null) {
        dropped.push({
          sheet: draft.sheet,
          shapes: d.shapes,
          cause: error.userMessage.cause,
          date,
        });
        continue;
      }
      entries[id] = entry;
      entryIdOf.set(d.key, id);
      if (remarkSig !== null) {
        remarkBySig.set(remarkSig, id);
        remarksOfSheet.set(draft.sheet, [...(remarksOfSheet.get(draft.sheet) ?? []), id]);
      }
    }
  }
  // Je Woche ausgeblendet: Plan-Bemerkungen, die ihre Box nicht nennt. Eine Woche ohne eigene Bemerkungen
  // übernimmt die der Vorwoche (gelten durchgehend).
  if (planWideRemarks) {
    const all = [...remarkBySig.values()];
    let shown = new Set<Id>();
    for (const { draft } of drafts) {
      const own = remarksOfSheet.get(draft.sheet) ?? [];
      if (own.length > 0) shown = new Set(own);
      const week = weeks.find((w) => w.id === weekIdOf.get(draft.sheet));
      if (week !== undefined)
        (week as { hiddenRemarkIds: Week['hiddenRemarkIds'] }).hiddenRemarkIds = all.filter(
          (x) => !shown.has(x),
        );
    }
  }

  // Stand-Datum der Datei (Regel 10): das späteste aller Blätter.
  const standDate =
    drafts
      .map((x) => x.draft.standDate)
      .filter((d): d is IsoDate => d !== null)
      .sort()
      .at(-1) ?? null;
  const first = drafts[0]?.draft;
  const unit = first?.unit ?? '';
  const motto = drafts.map((x) => x.draft.motto).find((x) => x !== '') ?? '';
  const beilage = first?.beilage ?? '';
  const abbreviationMeanings: Record<string, string> = {};
  for (const { draft } of drafts)
    for (const [code, meaning] of draft.abbreviations) abbreviationMeanings[code] ??= meaning;

  // Bericht mit IDs.
  const items: ImportReportItem[] = [];
  let reportSeq = 0;
  for (const { draft } of drafts) {
    const weekId = weekIdOf.get(draft.sheet) ?? null;
    for (const r of draft.reports) {
      const members =
        r.group?.members.map((k) => entryIdOf.get(k)).filter((x): x is Id => x !== undefined) ?? [];
      items.push({
        id: `r${++reportSeq}`,
        sheet: draft.sheet,
        weekId,
        date: r.date,
        kind: r.kind,
        message: r.message,
        target: {
          entryId: r.entryKey === null ? null : (entryIdOf.get(r.entryKey) ?? null),
          shapeIndex: r.shapeIndex,
          originalBox: r.box,
        },
        group:
          r.group === null ? null : { count: r.group.count, members: [...new Set(members)].sort() },
        besoNumber: r.besoNumber,
        span: r.span,
        ...(r.notTakenText === undefined ? {} : { notTakenText: r.notTakenText }),
      });
    }
  }
  // Jede Form eines verworfenen Entwurfs einzeln (Regel 8, CR-H-D-07); ohne Form ein Eintrag ohne Sprung.
  for (const d of dropped)
    for (const shapeIndex of d.shapes.length === 0 ? [null] : d.shapes)
      items.push({
        id: `r${++reportSeq}`,
        sheet: d.sheet,
        weekId: weekIdOf.get(d.sheet) ?? null,
        date: d.date,
        kind: 'unassignedShape',
        message: {
          cause: `Eine Form konnte nicht als Eintrag übernommen werden: ${d.cause}`,
          nextStep: 'Den Eintrag im Raster neu erfassen.',
        },
        target: { entryId: null, shapeIndex, originalBox: null },
        group: null,
        besoNumber: null,
        span: null,
      });
  if (standDate === null)
    items.push({
      id: `r${++reportSeq}`,
      sheet: first?.sheet ?? '',
      weekId: null,
      date: null,
      kind: 'missingHeader',
      message: {
        cause: 'In der Datei steht kein Stand-Datum; der Import hat keinen ersten Stand gesetzt.',
        nextStep: 'Mit «Neuen Stand setzen» einen Stand festlegen.',
      },
      target: { entryId: null, shapeIndex: null, originalBox: null },
      group: null,
      besoNumber: null,
      span: null,
    });

  // Bilanz je Blatt (R-8.2-20): gelesen = zugeordnet + nicht zugeordnet.
  const sheets: SheetBalance[] = drafts.map(({ draft, shapes }) => {
    const reported = new Set(
      items
        .filter(
          (i) => i.sheet === draft.sheet && (i.kind === 'unassignedShape' || i.kind === 'hidden'),
        )
        .map((i) => i.target.shapeIndex)
        .filter((x): x is number => x !== null),
    );
    const unassigned = reported.size;
    return {
      sheet: draft.sheet,
      weekId: weekIdOf.get(draft.sheet) ?? null,
      shapesRead: shapes,
      assigned: shapes - unassigned,
      unassigned,
    };
  });

  const result = command(
    target,
    `Excel-WAP «${fileName}» importiert`,
    (draft) => {
      draft.weeks = weeks as unknown as typeof draft.weeks;
      draft.columnSets = columnSets as unknown as typeof draft.columnSets;
      draft.entries = entries as unknown as typeof draft.entries;
      draft.deletedWeeks = [];
      if (unit !== '') draft.unit = unit;
      if (motto !== '' && draft.motto.trim() === '') draft.motto = motto;
      if (beilage !== '') draft.beilage = beilage;
      const service = serviceOf(beilage);
      if (service !== '') draft.service = service;
      if (draft.exerciseName.trim() === '') draft.exerciseName = fileName.replace(/\.xlsx?$/i, '');
      if (Object.keys(abbreviationMeanings).length > 0)
        draft.abbreviationMeanings = {
          ...(target.abbreviationMeanings ?? {}),
          ...abbreviationMeanings,
        };
      draft.stand = standDate === null ? null : { date: standDate, version: 1 };
      draft.nextId = nextId;
      draft.nextSeq = nextSeq;
    },
    ctx,
    { numbering: 'none' },
  );
  return { result, report: { fileName, sheets, items } };
}
