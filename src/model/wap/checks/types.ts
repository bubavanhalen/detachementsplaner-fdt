// Prüfregeln und Befunde (Beschrieb 7; Vertrag E1-06 Abschnitt 1; Glossar «Prüfung», «Befund», «Stufe»).
// Rein: keine Uhr, kein DOM. Die Layout-Schicht wird nur als Typ genutzt; das Layout kommt als Parameter.

import type { UserMessage } from '../errors';
import type { WeekPageLayout } from '../layout/page/types';
import type { Id, IsoDate, Plan } from '../types';

export type RuleId =
  | 'P1'
  | 'P2'
  | 'P3'
  | 'P4'
  | 'P5'
  | 'P6'
  | 'P7'
  | 'P8'
  | 'P9'
  | 'P10'
  | 'P11'
  | 'P12'
  | 'P13'
  | 'P14'
  | 'P15'
  | 'P16'
  | 'P17'
  | 'P18'
  | 'P19';

export type FindingSeverity = 'error' | 'warning' | 'hint';

/** Stufe je Regel nach der Tabelle in Beschrieb 7 (R-7-08). */
export const RULE_SEVERITY: Readonly<Record<RuleId, FindingSeverity>> = {
  P1: 'error',
  P8: 'error',
  P16: 'error',
  P17: 'error',
  P2: 'warning',
  P3: 'warning',
  P4: 'warning',
  P5: 'warning',
  P6: 'warning',
  P7: 'warning',
  P18: 'warning',
  P9: 'hint',
  P10: 'hint',
  P11: 'hint',
  P12: 'hint',
  P13: 'hint',
  P14: 'hint',
  P15: 'hint',
  P19: 'hint',
};

/** Etappe 1: P1, P8, P16, P17 (Beschrieb 13). */
export const ACTIVE_RULES: readonly RuleId[] = ['P1', 'P8', 'P16', 'P17'];

/** Oberflächentext der Stufe (Glossar «Stufe (Befund)»). */
export const SEVERITY_LABEL: Readonly<Record<FindingSeverity, string>> = {
  error: 'Fehler',
  warning: 'Warnung',
  hint: 'Hinweis',
};

export type FindingRegion = 'block' | 'agenda' | 'sidebar' | 'band' | 'header' | 'gridHead';

export interface Finding {
  /** Stabil über Neuberechnungen: Regel, Woche, Eintrag bzw. Bereich und Ursache (Quittierung, UI-F-5). */
  readonly key: string;
  readonly rule: RuleId;
  readonly severity: FindingSeverity;
  readonly weekId: Id;
  readonly date: IsoDate | null;
  readonly entryId: Id | null;
  readonly region: FindingRegion | null;
  /** Sortierzeit in Minuten (Reihenfolge der Liste); null = vor allen Zeiten. */
  readonly sortMinute: number | null;
  /** Kurzer Ort für die Befundliste, z.B. «Di 06.10.2026 0800». */
  readonly place: string;
  /** Kurztitel des Eintrags bzw. Bereichs. */
  readonly title: string;
  readonly message: UserMessage;
  /** Quittiert (plan.acknowledgedFindings); quittierte zählen nicht (R-7-34). */
  readonly acknowledged: boolean;
  /** Quittierung mit Datum und Grund, sonst null (bleibt nachvollziehbar, UI-Richtlinie 8.2). */
  readonly acknowledgement: { readonly at: IsoDate; readonly reason: string } | null;
}

export interface CheckInput {
  readonly plan: Plan;
  /** Layout der Wochenseite wie im PDF (für P8); wirft es, entfällt P8 für diese Woche. */
  readonly layoutFor: (weekId: Id) => WeekPageLayout;
}
