// Befunde bewusst quittieren und die Quittierung aufheben (Beschrieb 7 Nachsatz; R-7-34; UI-Richtlinie 8.2, F-5).
// Je ein Befehl über `command` (E1-03): rückgängig machbar, sofort gespeichert. Rein.

import { formatDate, isIsoDate } from '../calendar';
import { type CommandContext, type CommandResult, command } from '../commands/command';
import type { IsoDate, Plan } from '../types';
import type { Finding } from './types';

const REASON_LENGTH = 200;

/** Quittiert einen Befund mit Datum und optionalem Grund (eine Zeile). Schon quittiert: unverändert. */
export function acknowledgeFinding(
  plan: Plan,
  finding: Pick<Finding, 'key' | 'rule' | 'title'>,
  reason: string,
  date: IsoDate,
  ctx: CommandContext,
): CommandResult {
  if (!isIsoDate(date)) throw new RangeError('acknowledgeFinding: ungültiges Datum');
  const text = reason.replace(/\s+/g, ' ').trim().slice(0, REASON_LENGTH);
  return command(
    plan,
    `Befund ${finding.rule} «${finding.title}» quittiert`,
    (draft) => {
      if (draft.acknowledgedFindings.some((a) => a.key === finding.key)) return;
      draft.acknowledgedFindings.push({ key: finding.key, reason: text, at: date });
    },
    ctx,
    { numbering: 'none' },
  );
}

/** Hebt die Quittierung auf; der Befund zählt wieder. Nicht quittiert: unverändert. */
export function unacknowledgeFinding(
  plan: Plan,
  finding: Pick<Finding, 'key' | 'rule' | 'title'>,
  ctx: CommandContext,
): CommandResult {
  return command(
    plan,
    `Quittierung von ${finding.rule} «${finding.title}» aufgehoben`,
    (draft) => {
      const i = draft.acknowledgedFindings.findIndex((a) => a.key === finding.key);
      if (i >= 0) draft.acknowledgedFindings.splice(i, 1);
    },
    ctx,
    { numbering: 'none' },
  );
}

/** «quittiert am 06.10.2026: Grund» für die Liste «Quittiert». */
export function acknowledgementText(a: { readonly at: IsoDate; readonly reason: string }): string {
  const day = isIsoDate(a.at) ? formatDate(a.at, 'long') : a.at;
  return a.reason === '' ? `quittiert am ${day}` : `quittiert am ${day}: ${a.reason}`;
}
