// @vitest-environment node
// I2b-B B7: tolerante Zeitfelder und Startdatum (UI-Richtlinie 12 «Zeit», «Startdatum»; F-15, F-18). Fiktive Werte.
import { describe, expect, it } from 'vitest';
import {
  mondayHint,
  parseDateInput,
  parseTimeInput,
} from '../../../../src/components/wap/i2/timeInput';

describe('I2b-B B7 Zeitfelder', () => {
  it.each([
    ['900', 540],
    ['0900', 540],
    ['9:00', 540],
    ['9', 540],
    ['09.00', 540],
    [' 1330 ', 810],
    ['13.05', 785],
    ['0', 0],
    ['2400', 1440],
    ['24', 1440],
  ])('[R-4.5-08] «%s» ergibt %i Minuten', (input, minutes) => {
    expect(parseTimeInput(input, 'Beginn')).toEqual({ ok: true, value: minutes });
  });

  it('[R-4.5-08] Meldung nennt Feld, Ursache und Beispiel', () => {
    const empty = parseTimeInput('  ', 'Beginn');
    expect(empty.ok).toBe(false);
    if (!empty.ok)
      expect(empty.message).toBe('«Beginn» ist leer. Eine Zeit eingeben, zum Beispiel 0900.');
    const text = parseTimeInput('neun', 'Ende');
    if (text.ok) throw new Error('ungültig erwartet');
    expect(text.message).toBe(
      '«Ende»: «neun» ist keine Zeit. Die Zeit als 0900, 900 oder 9:00 eingeben.',
    );
    const range = parseTimeInput('2515', 'Ende');
    if (range.ok) throw new Error('ungültig erwartet');
    expect(range.message).toContain('liegt nicht zwischen 0000 und 2400');
    for (const bad of ['0960', '2405', '9:7', '12345'])
      expect(parseTimeInput(bad, 'Beginn').ok, bad).toBe(false);
  });

  it('[R-4.5-08] ausserhalb des 5-Minuten-Rasters: Meldung mit den beiden nächsten Zeiten (F-18)', () => {
    const r = parseTimeInput('0833', 'Ende');
    if (r.ok) throw new Error('ungültig erwartet');
    expect(r.message).toBe(
      '«Ende»: «0833» liegt nicht im 5-Minuten-Raster. Zeiten auf 5 Minuten eingeben, zum Beispiel 0830 oder 0835.',
    );
  });
});

describe('I2b-B B7 Startdatum', () => {
  it('[R-5.2-01] dd.mm.yyyy, d.m.yyyy und ISO werden gelesen; Ungültiges mit Beispiel', () => {
    expect(parseDateInput('28.09.2026', 'Startdatum')).toEqual({ ok: true, value: '2026-09-28' });
    expect(parseDateInput('5.10.2026', 'Startdatum')).toEqual({ ok: true, value: '2026-10-05' });
    expect(parseDateInput('2026-09-28', 'Startdatum')).toEqual({ ok: true, value: '2026-09-28' });
    const bad = parseDateInput('31.02.2026', 'Startdatum');
    if (bad.ok) throw new Error('ungültig erwartet');
    expect(bad.message).toBe(
      '«Startdatum»: «31.02.2026» ist kein Datum. Das Datum als dd.mm.yyyy eingeben, zum Beispiel 28.09.2026.',
    );
  });

  it('[R-5.2-01] kein Montag: Hinweis mit dem Montag davor (F-15)', () => {
    expect(mondayHint('2026-09-28')).toBeNull();
    expect(mondayHint('2026-09-30')).toEqual({
      text: 'Der 30.09.2026 ist ein Mittwoch. Wochen beginnen am Montag.',
      monday: '2026-09-28',
    });
    expect(mondayHint('2026-10-04')?.monday).toBe('2026-09-28');
  });
});
