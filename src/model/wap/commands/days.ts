// Spaltensatz und Darstellung je Tag (Vertrag E1-03 Abschnitt 2c; Beschrieb 5.2).

import { addDays, isIsoDate } from '../calendar';
import type { DayDisplay, Id, IsoDate, Plan, Week, Weekday } from '../types';
import { carryEntryColumns } from './columns';
import {
  type CommandContext,
  CommandError,
  type CommandResult,
  command,
  writeEntry,
} from './command';

const WEEKDAYS: readonly Weekday[] = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

const DISPLAY_NAMES: Readonly<Record<DayDisplay, string>> = {
  full: 'voll',
  compact: 'kompakt',
  hidden: 'ausgeblendet',
};

/** Woche und Tagesindizes ohne Doppel; Fehler in Parameterreihenfolge (Abschnitt 2c). */
function requireDays(
  plan: Plan,
  weekId: Id,
  weekdays: readonly Weekday[],
): { readonly weekIndex: number; readonly week: Week; readonly days: readonly number[] } {
  const weekIndex = plan.weeks.findIndex((w) => w.id === weekId);
  const week = plan.weeks[weekIndex];
  if (week === undefined) {
    throw new CommandError('unknownWeek', {
      cause: 'Die Woche ist im Plan nicht vorhanden.',
      nextStep: 'Eine vorhandene Woche wählen.',
    });
  }
  if (weekdays.length === 0) {
    throw new CommandError('emptySelection', {
      cause: 'Es ist kein Tag gewählt.',
      nextStep: 'Mindestens einen Tag wählen.',
    });
  }
  const days = [...new Set(weekdays)]
    .map((d) => WEEKDAYS.indexOf(d))
    .filter((i) => i >= 0)
    .sort((a, b) => a - b);
  return { weekIndex, week, days };
}

/** Weist den Tagen den Spaltensatz zu (ein Undo-Schritt, R-5.2-07); Einträge folgen mit carryColumnSelection (R-5.2-08/09). */
export function setDayColumnSet(
  plan: Plan,
  weekId: Id,
  weekdays: readonly Weekday[],
  columnSetId: Id,
  ctx: CommandContext,
): CommandResult {
  const { weekIndex, week, days } = requireDays(plan, weekId, weekdays);
  const set = plan.columnSets.find((s) => s.id === columnSetId);
  if (set === undefined) {
    throw new CommandError('unknownColumnSet', {
      cause: 'Der Spaltensatz ist im Plan nicht vorhanden.',
      nextStep: 'Einen vorhandenen Spaltensatz wählen.',
    });
  }
  const changedDays = days.filter((i) => week.days[i]?.columnSetId !== columnSetId);
  const dates = new Set<IsoDate>(
    isIsoDate(week.startDate) ? changedDays.map((i) => addDays(week.startDate, i)) : [],
  );
  return command(
    plan,
    `Spaltensatz «${set.name}» zugewiesen`,
    (d) => {
      const target = d.weeks[weekIndex];
      if (target === undefined) return;
      for (const i of changedDays) {
        const day = target.days[i];
        if (day !== undefined) day.columnSetId = columnSetId;
      }
      for (const e of Object.values(plan.entries)) {
        if (e.type === 'querbalken' || e.type === 'multiDayRemark' || !dates.has(e.date)) continue;
        const carried = carryEntryColumns(plan, e, set.columns);
        if (carried !== e) writeEntry(d, e, carried);
      }
    },
    ctx,
  );
}

/** Darstellung voll, kompakt oder ausgeblendet; Einträge bleiben unverändert. */
export function setDayDisplay(
  plan: Plan,
  weekId: Id,
  weekdays: readonly Weekday[],
  display: DayDisplay,
  ctx: CommandContext,
): CommandResult {
  const { weekIndex, days } = requireDays(plan, weekId, weekdays);
  return command(
    plan,
    `Darstellung «${DISPLAY_NAMES[display]}» gesetzt`,
    (d) => {
      const target = d.weeks[weekIndex];
      if (target === undefined) return;
      for (const i of days) {
        const day = target.days[i];
        if (day !== undefined && day.display !== display) day.display = display;
      }
    },
    ctx,
  );
}
