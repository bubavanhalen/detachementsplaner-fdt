// «Neuen Stand setzen» als ein Befehl, rein (Vertrag E1-05, Notiz «Ausarbeitung Schritt 2» Abschnitte B, D1, F;
// ADR-002 Punkt 6; R-4.6-33, R-5.5-03, R-5.5-04, R-10-30). Keine Uhr, kein Zufall, kein DOM (R-L-02).

import { formatDate, isIsoDate } from '../calendar';
import {
  type CommandContext,
  CommandError,
  type CommandResult,
  command,
} from '../commands/command';
import type { UserMessage } from '../errors';
import type { IsoDate, Plan } from '../types';

/** Eingabe des Dialogs «Neuen Stand setzen»: Datum und optional die Version (sonst vorherige + 1, F-47). */
export interface StandInput {
  readonly date: IsoDate;
  readonly version?: number;
}

/** Eigene Codes von applyStand (Abschnitt F); Fehler aus `command` (E1-03) gehen unverändert durch. */
export type StandCommandErrorCode = 'invalidDate' | 'invalidVersion' | 'versionNotIncreasing';

/** Fehlerklasse von applyStand: `CommandError` aus E1-03 mit eigenen Codes (Vertrag E1-03 §6). */
export type StandCommandError = CommandError<StandCommandErrorCode>;

/**
 * Verbindliche Meldungen (Abschnitt F). Platzhalter: {n} = plan.stand.version, {n1} = plan.stand.version + 1,
 * jeweils als Dezimalzahl ohne führende Nullen; jedes Vorkommen wird ersetzt.
 */
export const STAND_COMMAND_MESSAGES: { readonly [C in StandCommandErrorCode]: UserMessage } = {
  invalidDate: {
    cause: 'Das Datum des Stands ist kein gültiges Kalenderdatum.',
    nextStep: 'Das Datum als dd.mm.yyyy eingeben, z.B. 17.09.2026.',
  },
  invalidVersion: {
    cause: 'Die Version muss eine ganze Zahl ab 1 sein.',
    nextStep: 'Eine ganze Zahl ab 1 eingeben, z.B. 2.',
  },
  versionNotIncreasing: {
    cause: 'Die Version muss höher sein als die des letzten Stands (V{n}).',
    nextStep: 'Version {n1} oder höher eingeben.',
  },
};

function meldungMitVersion(message: UserMessage, version: number): UserMessage {
  const ersetzen = (text: string): string =>
    text.replaceAll('{n1}', String(version + 1)).replaceAll('{n}', String(version));
  return { cause: ersetzen(message.cause), nextStep: ersetzen(message.nextStep) };
}

/**
 * Setzt plan.stand, entfernt gestrichene Einträge, setzt «geändert» zurück; ein Befehl über `command` (E1-03)
 * mit numbering 'auto'. Abschnitt D1.
 */
export function applyStand(plan: Plan, input: StandInput, ctx: CommandContext): CommandResult {
  if (!isIsoDate(input.date)) {
    throw new CommandError('invalidDate', STAND_COMMAND_MESSAGES.invalidDate, { field: 'date' });
  }
  const version = input.version === undefined ? (plan.stand?.version ?? 0) + 1 : input.version;
  if (!Number.isSafeInteger(version) || version < 1) {
    throw new CommandError('invalidVersion', STAND_COMMAND_MESSAGES.invalidVersion, {
      field: 'version',
    });
  }
  if (plan.stand !== null && version <= plan.stand.version) {
    throw new CommandError(
      'versionNotIncreasing',
      meldungMitVersion(STAND_COMMAND_MESSAGES.versionNotIncreasing, plan.stand.version),
      { field: 'version' },
    );
  }
  return command(
    plan,
    `Stand V${version} vom ${formatDate(input.date, 'long')} gesetzt`,
    (draft) => {
      draft.stand = { date: input.date, version };
      for (const [id, entry] of Object.entries(draft.entries)) {
        if (entry.status === 'cancelled') delete draft.entries[id];
        else if (entry.changed === true) entry.changed = false;
      }
    },
    ctx,
    { numbering: 'auto' },
  );
}
