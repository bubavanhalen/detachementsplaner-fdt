// Uhren für die Tests von Paket E1-04 (Vertrag docs/wap-planer/plan/vertraege/E1-04.md, Notiz «Ausarbeitung
// Schritt 2» Abschnitt K2 und M1). Testzeitpunkte liegen zu vollen Stunden zwischen 06:00 und 20:00 UTC; dann ist
// der lokale Kalendertag in allen Zeitzonen der Schleuse (lokal, UTC, America/New_York) derselbe (ADR-010 V1).
// Keine E1-04-Logik.
import type { Clock } from '../../../../src/io/wap-plan/standStore';
import type { IsoDate } from '../../../../src/model/wap/types';

/** ISO-Zeitpunkt `tag` um `stunde`:00 UTC; nur Stunden 6 bis 20 (K2). */
export function zeitpunkt(tag: IsoDate, stunde = 12): string {
  if (!Number.isInteger(stunde) || stunde < 6 || stunde > 20) {
    throw new Error(
      'Testaufbau: Testzeitpunkte nur zu vollen Stunden zwischen 06:00 und 20:00 UTC',
    );
  }
  return `${tag}T${String(stunde).padStart(2, '0')}:00:00.000Z`;
}

/** Feste, verstellbare Uhr; zählt ihre Aufrufe (I1 Nr 4: genau ein `now()` je Methode). */
export class TestUhr implements Clock {
  private ms: number;
  /** Anzahl Aufrufe von `now()`. */
  aufrufe = 0;

  constructor(iso: string) {
    this.ms = TestUhr.lese(iso);
  }

  /** Gebunden: funktioniert auch ohne `this`. */
  readonly now = (): Date => {
    this.aufrufe += 1;
    return new Date(this.ms);
  };

  /** Stellt die Uhr auf `iso`. */
  setze(iso: string): this {
    this.ms = TestUhr.lese(iso);
    return this;
  }

  /** Stellt die Uhr um `ms` Millisekunden vor. */
  vor(ms: number): this {
    this.ms += ms;
    return this;
  }

  /** Aktueller Zeitpunkt als ISO-Text (ohne Aufruf zu zählen). */
  iso(): string {
    return new Date(this.ms).toISOString();
  }

  private static lese(iso: string): number {
    const ms = Date.parse(iso);
    if (Number.isNaN(ms)) throw new Error('Testaufbau: ungültiger Zeitpunkt');
    return ms;
  }
}

/** Schrittweise Uhr: jeder Aufruf liefert den aktuellen Zeitpunkt und stellt danach um `schrittMs` vor. */
export class SchrittUhr implements Clock {
  private ms: number;
  aufrufe = 0;

  constructor(
    iso: string,
    private readonly schrittMs = 1000,
  ) {
    this.ms = Date.parse(iso);
  }

  readonly now = (): Date => {
    this.aufrufe += 1;
    const d = new Date(this.ms);
    this.ms += this.schrittMs;
    return d;
  };
}

/** Ein Tag in Millisekunden. */
export const TAG_MS = 86_400_000;
