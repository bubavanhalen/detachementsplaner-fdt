// Fehlerverhalten des WAP-Planers (_konventionen.md Abschnitt 3; Vertrag E1-02a Abschnitt 3, 4, 8 P-2).
// Reine Funktionen werfen nur bei ungültiger Eingabe des Aufrufers; fachliche Zustände sind Rückgabewerte.

import type { IsoDate } from './types';

export interface UserMessage {
  /** Ursache in Deutsch (Schweiz), ein bis zwei Sätze. */
  readonly cause: string;
  /** Nächster Schritt für den Nutzer (Beschrieb 5.7). */
  readonly nextStep: string;
}

/** Basisklasse aller erwarteten Fehler des WAP-Planers. */
export class WapError extends Error {
  /** Stabil, camelCase, für Tests und Meldungskatalog (E1-11). */
  readonly code: string;
  readonly userMessage: UserMessage;

  constructor(code: string, userMessage: UserMessage, options?: { cause?: unknown }) {
    super(userMessage.cause, options);
    this.name = new.target.name;
    this.code = code;
    this.userMessage = userMessage;
  }
}

/** Codes der Fehler aus dem Modell-Kern (Vertrag E1-02a Abschnitt 4). */
export type ModelErrorCode =
  | 'startNotMonday'
  | 'timeNotOnFiveMinutes'
  | 'invalidTime'
  | 'invalidDate'
  | 'invalidEntry'
  | 'besoWithoutWindow'
  | 'unknownTemplate'
  | 'invalidColumnSet'
  | 'invalidPlanInput'
  | 'unknownWeek';

export interface ModelErrorDetails {
  /** Betroffenes Feld, z.B. 'categoryId', 'windows', 'windows[1].time', 'weekCount'. */
  readonly field?: string;
  /** Vorgeschlagenes Datum, bei 'startNotMonday' der vorangehende Montag (F-15). */
  readonly suggestion?: IsoDate;
}

/** Fehler des Modell-Kerns mit prüfbarem Feld und Vorschlag (Vertrag E1-02a Abschnitt 8 P-2). */
export class ModelError extends WapError {
  declare readonly code: ModelErrorCode;
  readonly field: string | null;
  readonly suggestion: IsoDate | null;

  constructor(
    code: ModelErrorCode,
    userMessage: UserMessage,
    details?: ModelErrorDetails,
    options?: { cause?: unknown },
  ) {
    super(code, userMessage, options);
    this.field = details?.field ?? null;
    this.suggestion = details?.suggestion ?? null;
  }
}

/** Feste Meldungen je Code (Vertrag E1-02a Abschnitt 4); `startNotMonday` setzt den Vorschlag ein. */
const MODEL_MESSAGES: Readonly<Record<Exclude<ModelErrorCode, 'startNotMonday'>, UserMessage>> = {
  timeNotOnFiveMinutes: {
    cause: 'Zeiten sind auf 5 Minuten genau, z.B. 0830 oder 0835.',
    nextStep: 'Die Zeit auf 5 Minuten runden und erneut eingeben.',
  },
  invalidTime: {
    cause: 'Die Zeit ist ungültig.',
    nextStep:
      'Die Zeit als hhmm von 0000 bis 2400 eingeben, z.B. 0830, 0900-1200, ab 1900, bis 1200 oder bis 21.10.',
  },
  invalidDate: {
    cause: 'Das Datum ist kein gültiges Kalenderdatum.',
    nextStep: 'Das Datum als dd.mm.yyyy eingeben, z.B. 28.09.2026.',
  },
  invalidEntry: {
    cause: 'Der Eintrag ist unvollständig oder ungültig.',
    nextStep: 'Die markierte Angabe ergänzen oder korrigieren.',
  },
  besoWithoutWindow: {
    cause: 'Ein Beso braucht mindestens ein Zeitfenster.',
    nextStep: 'Ein Zeitfenster mit Zeit erfassen.',
  },
  unknownTemplate: {
    cause: 'Die gewählte Vorlage ist nicht vorhanden.',
    nextStep: 'Eine vorhandene Vorlage wählen, z.B. «Kp».',
  },
  invalidColumnSet: {
    cause: 'Ein Spaltensatz der Vorlage ist ungültig.',
    nextStep:
      'Den Spaltensatz korrigieren: Planungsspalten, höchstens eine Nebenspalte, dann genau eine Rap-Spalte und eine Beso-Spalte.',
  },
  invalidPlanInput: {
    cause: 'Die Angaben für den neuen Plan sind ungültig.',
    nextStep: 'Die Angaben prüfen und den Plan erneut erstellen.',
  },
  unknownWeek: {
    cause: 'Die Woche ist im Plan nicht vorhanden.',
    nextStep: 'Eine vorhandene Woche wählen.',
  },
};

/** 'yyyy-mm-dd' → 'dd.mm.yyyy' für Meldungen (ohne Prüfung; der Aufrufer liefert ein gültiges Datum). */
function displayDate(d: IsoDate): string {
  const [y = '', m = '', day = ''] = d.split('-');
  return `${day}.${m}.${y}`;
}

/**
 * Erzeugt einen `ModelError` mit der Meldung aus dem Katalog oder der übergebenen Meldung
 * (z.B. aus einem Befund der Validierung). Bei `startNotMonday` nennt der nächste Schritt den Vorschlag.
 */
export function modelError(
  code: ModelErrorCode,
  details: ModelErrorDetails = {},
  message?: UserMessage,
): ModelError {
  if (message !== undefined) return new ModelError(code, message, details);
  if (code === 'startNotMonday') {
    const nextStep =
      details.suggestion === undefined
        ? 'Ein Startdatum an einem Montag wählen.'
        : `Den vorgeschlagenen Montag ${displayDate(details.suggestion)} übernehmen.`;
    return new ModelError(code, { cause: 'Das Startdatum ist kein Montag.', nextStep }, details);
  }
  return new ModelError(code, MODEL_MESSAGES[code], details);
}
