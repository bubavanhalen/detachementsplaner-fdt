// Dateinamen nach Konvention und Erinnerung an die Datei-Sicherung (I2b-B B5, B8; Beschrieb 5.6 Pkt 1 und 3,
// Beschrieb 6 «Dateiname nach Konvention»). Rein; Datum und Uhrzeit in der lokalen Zeit des Geräts.

import { fileNamePrefix, sanitizeNamePart } from '../../../model/wap/stand/fileName';
import type { Plan } from '../../../model/wap/types';

/** Plan für die Namensbildung: Ohne «Dienst» steht der Planname an seiner Stelle (sonst nur «WAP_…»). */
export function namingPlan(plan: Plan): Plan {
  return plan.service.trim() === '' && plan.exerciseName.trim() !== ''
    ? { ...plan, service: plan.exerciseName }
    : plan;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Lokales Datum yyyy-mm-dd. */
export function localDate(at: Date): string {
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
}

/**
 * Plan-Datei: «‹Beilage mit _›_WAP_‹Dienst›_‹Planname›_Plan_‹yyyy-mm-dd›_‹hhmm›.wap.json»; der Planname entfällt,
 * wenn er dem Dienst gleicht. Die Uhrzeit macht den Namen eindeutig (mehrere Sicherungen am selben Tag).
 */
export function planFileNameFor(plan: Plan, at: Date): string {
  const prefix = fileNamePrefix(plan);
  const name = sanitizeNamePart(plan.exerciseName);
  const service = sanitizeNamePart(plan.service);
  const parts = [prefix, name !== '' && name !== service ? name : '', 'Plan', localDate(at)];
  const stamp = `${pad(at.getHours())}${pad(at.getMinutes())}`;
  return `${parts.filter((p) => p !== '').join('_')}_${stamp}.wap.json`;
}

const DAY_MS = 86_400_000;

function startOfDay(at: Date): number {
  return new Date(at.getFullYear(), at.getMonth(), at.getDate()).getTime();
}

/** Ganze Kalendertage zwischen zwei Zeitpunkten (lokal), ≥ 0. */
export function calendarDaysBetween(from: Date, to: Date): number {
  return Math.max(0, Math.round((startOfDay(to) - startOfDay(from)) / DAY_MS));
}

/** «noch nie», «heute», «gestern», «vor n Tagen» (UI-Richtlinie 11.3). */
export function fileSaveAge(lastFileSaveAt: string | null, now: Date): string {
  if (lastFileSaveAt === null) return 'noch nie';
  const days = calendarDaysBetween(new Date(lastFileSaveAt), now);
  return days === 0 ? 'heute' : days === 1 ? 'gestern' : `vor ${days} Tagen`;
}

/** Arbeitstage (Mo–Fr) nach dem Tag von `from` bis und mit dem Tag von `to`. */
export function workingDaysSince(from: Date, to: Date): number {
  let count = 0;
  const day = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const end = startOfDay(to);
  for (day.setDate(day.getDate() + 1); day.getTime() <= end; day.setDate(day.getDate() + 1)) {
    const weekday = day.getDay();
    if (weekday !== 0 && weekday !== 6) count++;
  }
  return count;
}

export interface SaveState {
  readonly lastFileSaveAt: string | null;
  /** Zeitpunkt der letzten gespeicherten Änderung. */
  readonly modifiedAt: string;
  /** Erste Änderung der Historie (für «noch nie gesichert»); null ohne Historie. */
  readonly firstChangeAt: string | null;
}

/** Ungesicherte Änderungen seit der letzten Datei-Sicherung. */
export function hasUnsavedChanges(state: SaveState): boolean {
  if (state.lastFileSaveAt === null) return state.firstChangeAt !== null;
  return new Date(state.modifiedAt).getTime() > new Date(state.lastFileSaveAt).getTime();
}

/**
 * Erinnerung beim Schliessen (Beschrieb 5.6 Pkt 3): ungesicherte Änderungen und seit mehr als einem Arbeitstag
 * keine Datei-Sicherung (ohne Sicherung gilt die erste Änderung als Beginn).
 */
export function needsSaveReminder(state: SaveState, now: Date): boolean {
  if (!hasUnsavedChanges(state)) return false;
  const since = state.lastFileSaveAt ?? state.firstChangeAt;
  if (since === null) return false;
  return workingDaysSince(new Date(since), now) > 1;
}

/** Warnfarbe der Speicheranzeige (F-19): älter als 24 h mit ungesicherten Änderungen. */
export function saveIsStale(state: SaveState, now: Date): boolean {
  if (!hasUnsavedChanges(state)) return false;
  const since = state.lastFileSaveAt ?? state.firstChangeAt;
  return since !== null && now.getTime() - new Date(since).getTime() > DAY_MS;
}
