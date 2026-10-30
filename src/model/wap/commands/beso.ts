// Beso: Zeitfenster, Fixierung, «Tag neu nummerieren» (Vertrag E1-03 Abschnitt 2d; Beschrieb 4.6, 5.3).

import { castDraft } from 'immer';
import { formatDate, isIsoDate, weekdayOf } from '../calendar';
import { resolveTitle } from '../derive/agenda';
import type {
  Beso,
  BesoTimeWindow,
  DayRemark,
  Id,
  IsoDate,
  Plan,
  TimeSpec,
  Weekday,
} from '../types';
import { combineResults } from './arrange';
import {
  type CommandContext,
  CommandError,
  type CommandResult,
  clonePlain,
  command,
  entryLabel,
  requireEntry,
  writeEntry,
} from './command';
import { type BesoWindowDraft, updateEntry } from './entries';
import { assignNumbers } from './numbering';

/** time null = Zeit entfernt: Zeitfenster entfällt; beim einzigen Zeitfenster wird der Beso zur ganztägigen Bemerkung (R-5.3-13). */
export interface TimeWindowChanges {
  readonly time?: TimeSpec | null;
  readonly columnId?: Id | null;
  readonly supplement?: string;
}

export interface RenumberPreviewItem {
  readonly besoId: Id;
  readonly from: number | null;
  readonly to: number | null;
}

const WEEKDAY_NAMES: Readonly<Record<Weekday, string>> = {
  Mo: 'Montag',
  Di: 'Dienstag',
  Mi: 'Mittwoch',
  Do: 'Donnerstag',
  Fr: 'Freitag',
  Sa: 'Samstag',
  So: 'Sonntag',
};

/** Beso mit der ID; fehlt er → notFound, anderer Typ → wrongEntryType (Abschnitt 2d). */
function requireBeso(plan: Plan, id: Id): Beso {
  const e = requireEntry(plan, id);
  if (e.type !== 'beso') {
    throw new CommandError(
      'wrongEntryType',
      {
        cause: 'Der gewählte Eintrag ist kein Beso.',
        nextStep: 'Einen Beso wählen; Zeitfenster und Nummern gibt es nur bei Beso.',
      },
      { entryId: id },
    );
  }
  return e;
}

/** Index des Zeitfensters; fehlt es → notFound (field 'windowId', entryId = Beso). */
function requireWindow(b: Beso, windowId: Id): number {
  const index = b.windows.findIndex((w) => w.id === windowId);
  if (index < 0) {
    throw new CommandError(
      'notFound',
      {
        cause: 'Das Zeitfenster ist bei diesem Beso nicht vorhanden.',
        nextStep: 'Ein vorhandenes Zeitfenster des Beso wählen.',
      },
      { field: 'windowId', entryId: b.id },
    );
  }
  return index;
}

function withPeriod(text: string): string {
  return text === '' || text.endsWith('.') ? text : `${text}.`;
}

/**
 * Text der ganztägigen Bemerkung aus einem Beso (R-5.3-13; Änderungsnotiz V03, Orchestrator c): Freitext
 * getrimmt; sonst «‹Titel›: ‹Zusatz›, ‹Teile›.» bzw. «‹Titel›, ‹Teile›.», ohne Titel der Zusatz an seiner
 * Stelle; ohne Nummer und ohne Zeit; Verweise aufgelöst, Fettung entfällt.
 */
function remarkText(plan: Plan, b: Beso, only: BesoTimeWindow): string {
  const override = (b.agendaOverride ?? '').trim();
  if (override !== '') return override;
  const title = resolveTitle(plan, b.title)
    .map((r) => r.text)
    .join('')
    .trim();
  const supplement = only.supplement.trim();
  const head =
    title !== '' && supplement !== ''
      ? `${title}: ${supplement}`
      : title !== ''
        ? title
        : supplement;
  const parts = (
    [
      ['Ltg', b.ltg],
      ['Tn', b.tn],
      ['Tpt', b.tpt],
      ['Ort', b.ort],
    ] as const
  )
    .map(([label, value]) => [label, value.trim()] as const)
    .filter(([, value]) => value !== '')
    .map(([label, value]) => `${label}: ${value}`);
  return withPeriod([head, ...parts].filter((p) => p !== '').join(', '));
}

/** Neues Zeitfenster am Ende (R-4.6-25). */
export function addTimeWindow(
  plan: Plan,
  besoId: Id,
  spec: BesoWindowDraft,
  ctx: CommandContext,
): CommandResult & { readonly windowId: Id } {
  requireBeso(plan, besoId);
  let windowId = '';
  const r = command(
    plan,
    'Zeitfenster hinzugefügt',
    (d, t) => {
      const target = d.entries[besoId];
      if (target === undefined || target.type !== 'beso') return;
      windowId = t.newId('t');
      target.windows.push(
        castDraft({
          id: windowId,
          time: clonePlain(spec.time),
          columnId: spec.columnId ?? null,
          supplement: spec.supplement ?? '',
        }),
      );
    },
    ctx,
  );
  return { ...r, windowId };
}

/** Zeit, Spalte oder Zusatz eines Zeitfensters ändern; `time: null` entfernt die Zeit (R-5.3-13). */
export function updateTimeWindow(
  plan: Plan,
  besoId: Id,
  windowId: Id,
  changes: TimeWindowChanges,
  ctx: CommandContext,
): CommandResult {
  const b = requireBeso(plan, besoId);
  const index = requireWindow(b, windowId);
  const timeWindow = b.windows[index] as BesoTimeWindow;
  if (changes.time === null && b.windows.length === 1) {
    // Einziges Zeitfenster ohne Zeit: der Beso wird zur ganztägigen Bemerkung; seine Nummer wird frei.
    const remark: DayRemark = {
      id: b.id,
      type: 'dayRemark',
      date: b.date,
      text: remarkText(plan, b, timeWindow),
      status: b.status,
      changed: b.changed,
      createdSeq: b.createdSeq,
      internalNote: b.internalNote,
      removedText: b.removedText,
    };
    return command(
      plan,
      entryLabel(plan, b, 'in Ganztägige Bemerkung umgewandelt'),
      (d) => writeEntry(d, b, remark),
      ctx,
    );
  }
  const { time } = changes;
  const windows: BesoTimeWindow[] =
    time === null
      ? b.windows.filter((_, i) => i !== index)
      : b.windows.map((w, i) =>
          i === index
            ? {
                ...w,
                ...(time === undefined ? {} : { time }),
                ...(changes.columnId === undefined ? {} : { columnId: changes.columnId }),
                ...(changes.supplement === undefined ? {} : { supplement: changes.supplement }),
              }
            : w,
        );
  return command(plan, 'Zeitfenster geändert', (d) => writeEntry(d, b, { ...b, windows }), ctx);
}

/**
 * Meldung, wenn eine Frist mit Datum nicht am Tag des Beso liegen kann (FA2-03; R-5.7-04): ein Beso mit mehreren
 * Zeitfenstern bleibt an seinem Tag. `null`, wenn die Frist übernommen werden kann.
 */
export function deadlineDateProblem(
  plan: Plan,
  besoId: Id,
  time: TimeSpec,
  deadlineDate: IsoDate | null,
): { readonly cause: string; readonly nextStep: string } | null {
  const b = requireBeso(plan, besoId);
  if (time.form !== 'deadline' || deadlineDate === null || deadlineDate === b.date) return null;
  if (b.windows.length <= 1) return null;
  const day = formatDate(b.date, 'long').slice(0, 6);
  return {
    cause: `Die Frist bis ${formatDate(deadlineDate, 'long').slice(0, 6)} liegt an einem anderen Tag als der Beso (${weekdayOf(b.date)} ${day}); ein Beso mit mehreren Zeitfenstern bleibt an seinem Tag.`,
    nextStep: `Eine Frist am ${day} eingeben oder das Zeitfenster als eigenen Beso anlegen.`,
  };
}

/**
 * Zeit eines Zeitfensters mit dem Datum einer Frist (FA2-03; R-4.6-35, R-4.6-36, R-5.7-04): eine Frist gilt am Tag
 * des Eintrags. Liegt das eingegebene Datum an einem anderen Tag, rückt ein Beso mit einem Zeitfenster auf diesen Tag
 * (ein Undo-Schritt); mit mehreren Zeitfenstern CommandError mit Ursache und nächstem Schritt. Nie still eine andere
 * Frist.
 */
export function setWindowTime(
  plan: Plan,
  besoId: Id,
  windowId: Id,
  time: TimeSpec,
  deadlineDate: IsoDate | null,
  ctx: CommandContext,
): CommandResult {
  const b = requireBeso(plan, besoId);
  if (time.form !== 'deadline' || deadlineDate === null || deadlineDate === b.date)
    return updateTimeWindow(plan, besoId, windowId, { time }, ctx);
  const problem = deadlineDateProblem(plan, besoId, time, deadlineDate);
  if (problem !== null)
    throw new CommandError('invalidDate', problem, { field: 'time', entryId: besoId });
  const moved = updateEntry(plan, besoId, 'beso', { date: deadlineDate }, ctx);
  const timed = updateTimeWindow(moved.plan, besoId, windowId, { time }, ctx);
  return combineResults(
    moved,
    timed,
    entryLabel(plan, b, `Frist bis ${formatDate(deadlineDate, 'long').slice(0, 6)}`),
  );
}

/** Letztes Zeitfenster → CommandError 'lastTimeWindow'; die Oberfläche fragt «Beso löschen?» und ruft deleteEntries (F-56). */
export function removeTimeWindow(
  plan: Plan,
  besoId: Id,
  windowId: Id,
  ctx: CommandContext,
): CommandResult {
  const b = requireBeso(plan, besoId);
  const index = requireWindow(b, windowId);
  if (b.windows.length === 1) {
    throw new CommandError(
      'lastTimeWindow',
      {
        cause: 'Das ist das letzte Zeitfenster; ein Beso braucht mindestens eines.',
        nextStep: 'Den ganzen Beso löschen oder zuerst ein weiteres Zeitfenster erfassen.',
      },
      { field: 'windowId', entryId: b.id },
    );
  }
  return command(
    plan,
    'Zeitfenster gelöscht',
    (d) => writeEntry(d, b, { ...b, windows: b.windows.filter((_, i) => i !== index) }),
    ctx,
  );
}

function invalidNumber(besoId: Id, cause: string): CommandError {
  return new CommandError(
    'invalidNumber',
    { cause, nextStep: 'Eine ganze Zahl ab 0 eingeben, z.B. 15.' },
    { field: 'besoNumber', entryId: besoId },
  );
}

/** Nummer fixieren (mit oder ohne neue Nummer) bzw. lösen (R-5.3-05). */
export function setBesoNumberFixed(
  plan: Plan,
  besoId: Id,
  fixed: boolean,
  number: number | null,
  ctx: CommandContext,
): CommandResult {
  const b = requireBeso(plan, besoId);
  let target = b.besoNumber;
  if (!fixed) {
    if (number !== null) {
      throw invalidNumber(besoId, 'Beim Lösen der Fixierung wird keine Nummer angegeben.');
    }
  } else if (number === null) {
    if (b.besoNumber === null) {
      throw invalidNumber(besoId, 'Der Beso hat keine Nummer, die fixiert werden kann.');
    }
  } else {
    if (!Number.isInteger(number) || number < 0) {
      throw invalidNumber(besoId, `«${number}» ist keine ganze Zahl ab 0.`);
    }
    // Belegt: ein anderer Beso desselben Datums hält n (Abschnitt 3, Modus 'auto'; Änderungsnotiz V09a).
    const taken = Object.values(plan.entries).some(
      (e) =>
        e.type === 'beso' &&
        e.id !== b.id &&
        e.date === b.date &&
        e.besoNumber === number &&
        (plan.stand !== null || e.numberFixed || e.status === 'cancelled'),
    );
    if (taken) {
      throw new CommandError(
        'numberTaken',
        {
          cause: `Die Nummer ${number} trägt an diesem Tag schon ein anderer Beso.`,
          nextStep: 'Eine freie Nummer wählen oder die andere Nummer zuerst lösen.',
        },
        { field: 'besoNumber', entryId: besoId },
      );
    }
    target = number;
  }
  const r = command(
    plan,
    '',
    (d) => writeEntry(d, b, { ...b, besoNumber: target, numberFixed: fixed }),
    ctx,
  );
  const after = r.plan.entries[besoId];
  const n = after?.type === 'beso' ? after.besoNumber : null;
  return { ...r, label: `Nr ${n === null ? '–' : n} ${fixed ? 'fixiert' : 'gelöst'}` };
}

/** Vorschau alt → neu für «Tag neu nummerieren» (R-5.3-08, Oberfläche E1-16); rein. */
export function renumberDayPreview(plan: Plan, date: IsoDate): readonly RenumberPreviewItem[] {
  const items: RenumberPreviewItem[] = [];
  for (const [besoId, to] of assignNumbers(plan, date, 'renumber')) {
    const e = plan.entries[besoId];
    items.push({ besoId, from: e?.type === 'beso' ? e.besoNumber : null, to });
  }
  return items;
}

/** Befehl «Tag neu nummerieren» (Modus 'renumber', Abschnitt 3). */
export function renumberDay(plan: Plan, date: IsoDate, ctx: CommandContext): CommandResult {
  if (!isIsoDate(date)) {
    throw new CommandError(
      'invalidDate',
      {
        cause: 'Das Datum ist kein gültiges Kalenderdatum.',
        nextStep: 'Das Datum als dd.mm.yyyy eingeben, z.B. 28.09.2026.',
      },
      { field: 'date' },
    );
  }
  const numbers = assignNumbers(plan, date, 'renumber');
  return command(
    plan,
    `${WEEKDAY_NAMES[weekdayOf(date)]} ${formatDate(date, 'long')} neu nummeriert`,
    (d) => {
      for (const [id, n] of numbers) {
        const e = d.entries[id];
        if (e !== undefined && e.type === 'beso' && e.besoNumber !== n) e.besoNumber = n;
      }
    },
    ctx,
    { numbering: 'none' },
  );
}
