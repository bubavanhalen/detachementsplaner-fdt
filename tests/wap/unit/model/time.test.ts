// @vitest-environment jsdom
// Zeiten und Zeitformen (Vertrag E1-02a Abschnitt 3 time.ts, 8 P-4, P-5; Beschrieb 4.5, 4.6).
import { describe, expect, it } from 'vitest';
import {
  compareEntries,
  formatMilTime,
  formatTimeSpec,
  parseMilTime,
  parseTimeSpec,
  snap,
  sortTime,
} from '../../../../src/model/wap/time';
import type { TimeSpec } from '../../../../src/model/wap/types';
import { expectModelError } from '../../support/model/builders';

describe('Militärzeit', () => {
  it('[R-4.5-09] (F-18) «0835» wird als 0835 übernommen, Randwerte 0000 und 2400', () => {
    expect(parseMilTime('0835')).toBe(515);
    expect(parseMilTime('0830')).toBe(510);
    expect(parseMilTime('0000')).toBe(0);
    expect(parseMilTime('2355')).toBe(1435);
    expect(parseMilTime('2400')).toBe(1440);
  });

  it('[R-4.5-09] (F-18) «0833» → timeNotOnFiveMinutes mit festem Wortlaut, nichts übernommen', () => {
    const err = expectModelError(() => parseMilTime('0833'), { code: 'timeNotOnFiveMinutes' });
    expect(err.userMessage.cause).toBe('Zeiten sind auf 5 Minuten genau, z.B. 0830 oder 0835.');
    expectModelError(() => parseMilTime('1201'), { code: 'timeNotOnFiveMinutes' });
    expectModelError(() => parseMilTime('0004'), { code: 'timeNotOnFiveMinutes' });
  });

  it('[R-4.5-09] ungültige Zeiten → invalidTime (Stunde > 24, Minuten ≥ 60, 24 mit Minuten, nicht genau vier Ziffern)', () => {
    for (const s of ['2500', '0860', '2405', '2430', '830', '08300', '08:30', 'abcd', '']) {
      expectModelError(() => parseMilTime(s), { code: 'invalidTime' });
    }
  });

  it('[R-4.5-01] formatMilTime: hhmm, 1440 → 2400, über Mitternacht als Uhrzeit des Folgetags', () => {
    expect(formatMilTime(0)).toBe('0000');
    expect(formatMilTime(240)).toBe('0400');
    expect(formatMilTime(515)).toBe('0835');
    expect(formatMilTime(1440)).toBe('2400');
    expect(formatMilTime(1445)).toBe('0005');
    expect(formatMilTime(1560)).toBe('0200');
  });

  it('[R-4.5-01] formatMilTime ausserhalb 0–2880 → invalidTime', () => {
    expectModelError(() => formatMilTime(-5), { code: 'invalidTime' });
    expectModelError(() => formatMilTime(2885), { code: 'invalidTime' });
  });

  it('[R-4.5-09] snap: nächste Rasterzeit auf 5 bzw. 15 Minuten, genau in der Mitte aufwärts, gebrochene Werte', () => {
    expect(snap(517, 5)).toBe(515);
    expect(snap(518, 5)).toBe(520);
    expect(snap(517.5, 5)).toBe(520);
    expect(snap(482, 15)).toBe(480);
    expect(snap(487.5, 15)).toBe(495);
    expect(snap(487.4, 15)).toBe(480);
    expect(snap(0, 15)).toBe(0);
    expect(snap(1440, 5)).toBe(1440);
  });
});

describe('Zeitformen parsen', () => {
  const ref = '2026-10-19';

  it('[R-4.6-35] Zeitpunkt, von–bis, ab X, bis X', () => {
    expect(parseTimeSpec('1130', ref)).toEqual({
      time: { form: 'point', at: 690 },
      deadlineDate: null,
    });
    expect(parseTimeSpec('0900-1200', ref)).toEqual({
      time: { form: 'range', from: 540, to: 720 },
      deadlineDate: null,
    });
    expect(parseTimeSpec('ab 1900', ref)).toEqual({
      time: { form: 'from', from: 1140 },
      deadlineDate: null,
    });
    expect(parseTimeSpec('bis 1200', ref)).toEqual({
      time: { form: 'until', to: 720 },
      deadlineDate: null,
    });
  });

  it('[R-4.6-35] Leerraum, Gross-/Kleinschreibung von «ab»/«bis» und Halbgeviertstrich werden toleriert', () => {
    const range = { time: { form: 'range', from: 540, to: 720 }, deadlineDate: null };
    expect(parseTimeSpec('  0900 - 1200 ', ref)).toEqual(range);
    expect(parseTimeSpec('0900–1200', ref)).toEqual(range);
    expect(parseTimeSpec('AB 1900', ref).time).toEqual({ form: 'from', from: 1140 });
    expect(parseTimeSpec('Bis 1200', ref).time).toEqual({ form: 'until', to: 720 });
  });

  it('[R-4.6-35] von–bis über Mitternacht: Ende ≤ Beginn ergibt Ende + 1440; gleiche Zeiten → invalidTime', () => {
    expect(parseTimeSpec('2200-0200', ref).time).toEqual({ form: 'range', from: 1320, to: 1560 });
    expect(parseTimeSpec('2000-2400', ref).time).toEqual({ form: 'range', from: 1200, to: 1440 });
    expectModelError(() => parseTimeSpec('0900-0900', ref), { code: 'invalidTime' });
  });

  it('[R-4.6-36] (F-05) Frist «bis 21.10.» ohne Uhrzeit → ganztägige Frist (ohne Endzeit) am 21.10.2026', () => {
    const parsed = parseTimeSpec('bis 21.10.', ref);
    expect(parsed.time).toEqual({ form: 'deadline' });
    expect('to' in parsed.time).toBe(false);
    expect(parsed.deadlineDate).toBe('2026-10-21');
  });

  it('[R-4.6-36] Frist mit Uhrzeit und Frist mit Jahr', () => {
    expect(parseTimeSpec('bis 21.10. 1200', ref)).toEqual({
      time: { form: 'deadline', to: 720 },
      deadlineDate: '2026-10-21',
    });
    expect(parseTimeSpec('bis 21.10.2026', ref)).toEqual({
      time: { form: 'deadline' },
      deadlineDate: '2026-10-21',
    });
    expect(parseTimeSpec('bis 1.2.', ref).deadlineDate).toBe('2027-02-01');
  });

  it('[R-4.6-36] Frist ohne Jahr: Jahr mit dem kleinsten Abstand zum Bezugsdatum, bei Gleichstand das spätere', () => {
    expect(parseTimeSpec('bis 05.01.', '2026-12-28').deadlineDate).toBe('2027-01-05');
    expect(parseTimeSpec('bis 20.12.', '2027-01-03').deadlineDate).toBe('2026-12-20');
    expect(parseTimeSpec('bis 1.1.', '2028-07-02').deadlineDate).toBe('2029-01-01');
  });

  it('[R-4.5-09] (F-18) Zeitformen mit Minuten ausserhalb des 5-Minuten-Rasters → timeNotOnFiveMinutes', () => {
    for (const s of ['0833', '0900-1203', 'ab 1901', 'bis 1159', 'bis 21.10. 1202']) {
      expectModelError(() => parseTimeSpec(s, ref), { code: 'timeNotOnFiveMinutes' });
    }
  });

  it('[R-4.6-35] unbekannte Formen → invalidTime; ungültiges Fristdatum → invalidDate', () => {
    for (const s of ['', 'morgen', 'ab', 'bis', '2500', '0900-', 'ca 0900', '0900-1200-1300']) {
      expectModelError(() => parseTimeSpec(s, ref), { code: 'invalidTime' });
    }
    expectModelError(() => parseTimeSpec('bis 31.02.', ref), { code: 'invalidDate' });
    expectModelError(() => parseTimeSpec('bis 30.02.2027', ref), { code: 'invalidDate' });
  });
});

describe('Zeitformen darstellen und sortieren', () => {
  it('[R-4.6-37] formatTimeSpec gibt die erfasste Form wieder', () => {
    const d = '2026-10-21';
    expect(formatTimeSpec({ form: 'point', at: 690 }, d)).toBe('1130');
    expect(formatTimeSpec({ form: 'range', from: 540, to: 720 }, d)).toBe('0900-1200');
    expect(formatTimeSpec({ form: 'from', from: 1140 }, d)).toBe('ab 1900');
    expect(formatTimeSpec({ form: 'until', to: 720 }, d)).toBe('bis 1200');
    expect(formatTimeSpec({ form: 'deadline' }, d)).toBe('bis 21.10.');
    expect(formatTimeSpec({ form: 'deadline', to: 720 }, d)).toBe('bis 21.10. 1200');
  });

  it('[R-4.6-37] formatTimeSpec: Ende 2400 und Ende über Mitternacht', () => {
    expect(formatTimeSpec({ form: 'range', from: 1200, to: 1440 }, '2026-09-28')).toBe('2000-2400');
    expect(formatTimeSpec({ form: 'range', from: 1320, to: 1560 }, '2026-09-28')).toBe('2200-0200');
  });

  it('[R-4.6-37] parseTimeSpec und formatTimeSpec sind zueinander invers für alle fünf Zeitformen', () => {
    const ref = '2026-10-19';
    for (const s of ['1130', '0900-1200', 'ab 1900', 'bis 1200', 'bis 21.10.', 'bis 21.10. 1200']) {
      const p = parseTimeSpec(s, ref);
      expect(formatTimeSpec(p.time, p.deadlineDate ?? ref)).toBe(s);
    }
  });

  it('[R-4.6-38] Sortierzeit ist der Beginn: von–bis 0900-1200 → 0900, ab 1900 → 1900, Zeitpunkt 1130 → 1130', () => {
    expect(sortTime({ form: 'range', from: 540, to: 720 })).toBe(540);
    expect(sortTime({ form: 'from', from: 1140 })).toBe(1140);
    expect(sortTime({ form: 'point', at: 690 })).toBe(690);
  });

  it('[R-4.6-39] bei «bis X» ist die Sortierzeit X; Frist mit Zeit → Zeit, ohne Zeit → 0', () => {
    expect(sortTime({ form: 'until', to: 720 })).toBe(720);
    expect(sortTime({ form: 'deadline', to: 720 })).toBe(720);
    expect(sortTime({ form: 'deadline' })).toBe(0);
  });

  it('[R-4.6-39] «bis 1200» wird nach «1130» einsortiert, auch wenn es früher erfasst wurde (KVK Mo: Nr 13 nach Nr 14)', () => {
    const nr13 = { time: { form: 'until', to: 720 } as TimeSpec, createdSeq: 1 };
    const nr14 = { time: { form: 'point', at: 690 } as TimeSpec, createdSeq: 2 };
    expect(compareEntries(nr13, nr14)).toBeGreaterThan(0);
    expect(compareEntries(nr14, nr13)).toBeLessThan(0);
    expect([nr13, nr14].sort(compareEntries)).toEqual([nr14, nr13]);
  });

  it('[R-4.6-40] gleiche Sortierzeit: das früher Erfasste zuerst; gleicher Eintrag → 0', () => {
    const a = { time: { form: 'range', from: 540, to: 600 } as TimeSpec, createdSeq: 7 };
    const b = { time: { form: 'from', from: 540 } as TimeSpec, createdSeq: 3 };
    expect(compareEntries(b, a)).toBeLessThan(0);
    expect(compareEntries(a, b)).toBeGreaterThan(0);
    expect(compareEntries(a, a)).toBe(0);
  });
});
