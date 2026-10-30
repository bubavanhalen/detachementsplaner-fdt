// Zeitspannen der Einträge je Tag: Spanne je Typ, Mitternacht, Zuschnitt auf den Zeitbereich (Vertrag E1-02d
// Abschnitt 2c; Änderungsnotizen V01, Runde 2 V14, R2-1, R2-2, R3-3, R4-1, R5-1; Beschrieb 4.5, 4.6; F-04, F-63 b).

import { addDays } from '../../calendar';
import type { LevelTemplate } from '../../template';
import type { BesoTimeWindow, Block, Entry, IsoDate, MilTime, Rapport } from '../../types';
import { GRID_CONSTANTS } from '../grid/constants';
import type { TimeSpan } from '../grid/types';
import { besoBoxSpan } from './besoBox';

/** Minuten eines Tages; eine Spanne über diesen Wert reicht in den Folgetag (R-4.5-10). */
const DAY_MINUTES = 1440;
/** Zeitformen ohne Dauer und die Mindesthöhe des Rapports in Minuten (F-04, R-4.6-19). */
const DEFAULT_MINUTES = 30;

/** Logische Spanne eines Elements am Tag seiner Erfassung. */
export interface SpanSource {
  /** Nach Zeitform und Mindesthöhe, unbegrenzt (R2-1). */
  readonly span: TimeSpan;
  /** Wird über Mitternacht geteilt: erfasste Zeit 'range' mit to > 1440 (2c «Mitternacht»). */
  readonly split: boolean;
  /** Erfasste Spanne für Kanten und Zeitzeile (nur Rapport 'range', R3-3, R4-1); sonst null. */
  readonly recorded: TimeSpan | null;
}

export type Continuation = 'none' | 'toNextDay' | 'fromPreviousDay';

/** Teil eines Elements an einem Tag. */
export interface DayPart {
  /** Logische Spanne dieses Tages vor dem Zuschnitt (`EntryPiece.span`). */
  readonly span: TimeSpan;
  /** Gezeichnete Spanne nach dem Zuschnitt auf [V0, V1]. */
  readonly drawn: TimeSpan;
  readonly openTop: boolean;
  readonly openBottom: boolean;
  readonly continuation: Continuation;
  /** Eine Kante ist durch den Zuschnitt verschoben: der Text trägt die Zeitzeile (V01, V14, R5-1). */
  readonly timeLine: boolean;
}

/** Block nach F-04: range [from, to], point [at, at+30], ab [X, X+30], bis [X−30, X]. */
export function blockSpanSource(time: Block['time']): SpanSource {
  switch (time.form) {
    case 'range':
      return {
        span: { from: time.from, to: time.to },
        split: time.to > DAY_MINUTES,
        recorded: null,
      };
    case 'point':
      return {
        span: { from: time.at, to: time.at + DEFAULT_MINUTES },
        split: false,
        recorded: null,
      };
    case 'from':
      return {
        span: { from: time.from, to: time.from + DEFAULT_MINUTES },
        split: false,
        recorded: null,
      };
    case 'until':
      return {
        span: { from: time.to - DEFAULT_MINUTES, to: time.to },
        split: false,
        recorded: null,
      };
  }
}

/** Rapport (Kästchen und Rapport-Block): range [from, max(to, from+30)], point [at, at+30] (R-4.6-19). */
export function rapportSpanSource(time: Rapport['time']): SpanSource {
  if (time.form === 'point') {
    return {
      span: { from: time.at, to: time.at + DEFAULT_MINUTES },
      split: false,
      recorded: null,
    };
  }
  return {
    span: { from: time.from, to: Math.max(time.to, time.from + DEFAULT_MINUTES) },
    split: time.to > DAY_MINUTES,
    recorded: { from: time.from, to: time.to },
  };
}

/** Beso-Kästchen nach `besoBoxSpan`; geteilt nur bei der Vorlage 'duration' (2c «Mitternacht»). */
export function besoSpanSource(
  timeWindow: BesoTimeWindow,
  template: LevelTemplate,
  displayFrom: MilTime,
): SpanSource {
  const t = timeWindow.time;
  return {
    span: besoBoxSpan(t, template, displayFrom),
    split: template.besoBox.height === 'duration' && t.form === 'range' && t.to > DAY_MINUTES,
    recorded: null,
  };
}

/**
 * Teil eines Elements, erfasst an `entryDate`, am Tag `date`; null, wenn das Element dort nicht liegt.
 * `v0` = Bandende, `v1` = Anzeigeende (Zeitbereich der zeitlichen Einträge, 2a Nr 5).
 */
export function dayPart(
  src: SpanSource,
  entryDate: IsoDate,
  date: IsoDate,
  v0: number,
  v1: number,
): DayPart | null {
  let span: TimeSpan;
  let recorded: TimeSpan;
  let continuation: Continuation;
  if (entryDate === date) {
    if (src.split) {
      span = { from: src.span.from, to: DAY_MINUTES };
      continuation = 'toNextDay';
      recorded =
        src.recorded === null
          ? span
          : { from: src.recorded.from, to: Math.min(src.recorded.to, DAY_MINUTES) };
    } else {
      span = src.span;
      continuation = 'none';
      recorded = src.recorded ?? span;
    }
  } else if (src.split && addDays(entryDate, 1) === date) {
    span = { from: 0, to: src.span.to - DAY_MINUTES };
    continuation = 'fromPreviousDay';
    recorded =
      src.recorded === null
        ? span
        : {
            from: Math.max(src.recorded.from - DAY_MINUTES, 0),
            to: src.recorded.to - DAY_MINUTES,
          };
  } else {
    return null;
  }
  // Randhöhe höchstens 30 Min und höchstens der Zeitbereich (Änderungsnotiz Code-Review Runde 1, C1).
  const edge = Math.min(GRID_CONSTANTS.maxEdgeMinutes, v1 - v0);
  if (span.to <= span.from) {
    // R2-2, R5-1, C1: leeres Teil vor Mitternacht am Rand des eigenen Tags, immer mit Zeitzeile.
    return {
      span,
      drawn: { from: v1 - edge, to: v1 },
      openTop: false,
      openBottom: true,
      continuation,
      timeLine: true,
    };
  }
  const d = Math.min(span.to - span.from, edge);
  let drawn: TimeSpan;
  if (span.to <= v0) drawn = { from: v0, to: v0 + d };
  else if (span.from >= v1) drawn = { from: v1 - d, to: v1 };
  else drawn = { from: Math.max(span.from, v0), to: Math.min(span.to, v1) };
  // Kanten aus dem Zuschnitt (beim Rapport 'range' nach der erfassten Teilspanne, R3-3, R4-1).
  const clipTop = recorded.from < v0;
  const clipBottom = recorded.to > v1;
  return {
    span,
    drawn,
    openTop: clipTop || continuation === 'fromPreviousDay',
    openBottom: clipBottom || continuation === 'toNextDay',
    continuation,
    timeLine: clipTop || clipBottom,
  };
}

/**
 * Hat der Eintrag einen Folgetag-Teil nach 2c «Mitternacht» (Änderungsnotiz Code-Review Runde 1, C2)? Abgeleitet
 * aus `split` der Spannenquelle desselben Typs: Block oder Rapport 'range' mit to > 1440, Beso-Kästchen der
 * Vorlage 'duration' mit 'range' to > 1440.
 */
export function hasNextDayPart(e: Entry, template: LevelTemplate): boolean {
  switch (e.type) {
    case 'block':
      return blockSpanSource(e.time).split;
    case 'rapport':
      return rapportSpanSource(e.time).split;
    case 'beso':
      // `displayFrom` wirkt nur auf die Spanne einer Frist ohne Uhrzeit, nie auf `split`; daher genügt 0.
      return e.windows.some((w) => besoSpanSource(w, template, 0).split);
    default:
      return false;
  }
}
