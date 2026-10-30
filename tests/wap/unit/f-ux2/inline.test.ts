// @vitest-environment node
// F-UX2 P2 (Rückmeldung N2; Beschrieb 5.1; ADR-004 Leitplanke 2): Abbildung der bearbeiteten Felder auf die
// vorberechneten Zeilen – Schreibmarke und Markierung liegen im gezeichneten Text, auch bei Umbruch (entfallenes
// Leerzeichen), Silbentrennung (eingefügter Trennstrich) und Kürzung («…»). Fiktive Daten.
import { describe, expect, it } from 'vitest';
import {
  caretBox,
  indexAt,
  placeFields,
  selectionBoxes,
  wordAt,
} from '../../../../src/components/wap/i2/inlineText';
import type { ScreenLine } from '../../../../src/components/wap/i2/layoutViews';
import { measureRuns } from '../../../../src/model/wap/layout/text/measure';

function line(text: string, top: number, bold = true, left = 2): ScreenLine {
  return {
    left,
    top,
    fontPx: 12,
    rotation: 0,
    runs: [
      {
        text,
        bold,
        color: 'rgb(0 0 0)',
        strike: false,
        widthPx: measureRuns([{ text, weight: bold ? 'bold' : 'regular' }], 12),
      },
    ],
  };
}

const w = (t: string, bold = true) =>
  measureRuns([{ text: t, weight: bold ? 'bold' : 'regular' }], 12);

describe('F-UX2 P2: Direktbearbeitung im Block – Lage der Felder im gezeichneten Text', () => {
  it('[R-5.1-08] Umbruch: das Leerzeichen am Zeilenende entfällt, die Marke folgt dem Text auf die nächste Zeile', () => {
    const lines = [line('Wache', 2), line('Nord', 16), line('Zusatz', 30, false)];
    const l = placeFields(lines, ['Wache Nord', 'Zusatz', '', '']);
    expect(l.fields[0]?.complete).toBe(true);
    expect(l.fields[1]?.complete).toBe(true);
    // Marke nach «Wache» (Index 5) am Zeilenende, nach dem Leerzeichen (6) am Anfang von «Nord».
    expect(caretBox(l, 0, 5)?.left).toBeCloseTo(2 + w('Wache') - 0.5, 6);
    expect(caretBox(l, 0, 6)?.top).toBeCloseTo(16 - 0.6, 6);
    expect(caretBox(l, 0, 10)?.left).toBeCloseTo(2 + w('Nord') - 0.5, 6);
    // Zusatz beginnt auf der dritten Zeile.
    expect(caretBox(l, 1, 0)?.top).toBeCloseTo(30 - 0.6, 6);
    // Markierung über zwei Zeilen.
    expect(selectionBoxes(l, 0, 3, 8).length).toBe(2);
  });

  it('[R-5.1-08] Silbentrennung: der eingefügte Trennstrich gehört nicht zum Feld; Kürzung: der Rest ist nicht gezeichnet', () => {
    const lines = [line('Sanitäts-', 2), line('dienst', 16)];
    const l = placeFields(lines, ['Sanitätsdienst']);
    expect(l.fields[0]?.complete).toBe(true);
    // Vor «s» noch in der ersten Zeile, vor «d» am Anfang der zweiten (der Trennstrich wird übersprungen).
    expect(caretBox(l, 0, 7)?.left).toBeCloseTo(2 + w('Sanitäts'.slice(0, 7)) - 0.5, 6);
    expect(caretBox(l, 0, 8)?.top).toBeCloseTo(16 - 0.6, 6);
    expect(caretBox(l, 0, 14)?.left).toBeCloseTo(2 + w('dienst') - 0.5, 6);
    const cut = placeFields([line('Fahrschule La…', 2)], ['Fahrschule Lastwagen']);
    expect(cut.fields[0]?.complete).toBe(false);
    expect(cut.fields[0]?.slots.slice(0, 13).every((s) => s !== null)).toBe(true);
    expect(cut.fields[0]?.slots.slice(13).every((s) => s === null)).toBe(true);
    // Leeres oder nicht gezeichnetes Feld: keine Marke im Block (Feldanzeige).
    expect(caretBox(placeFields([line('Titel', 2)], ['Titel', 'Ort']), 1, 0)).toBeNull();
  });

  it('[R-5.1-08] Klick in den Text: nächstes Zeichen, Hälfte entscheidet vor/nach; Doppelklick wählt das Wort', () => {
    const l = placeFields([line('Wache', 2), line('Nord', 16)], ['Wache Nord']);
    expect(indexAt(l, 2.5, 8)).toEqual({ field: 0, index: 0 });
    expect(indexAt(l, 2 + w('Wache') + 4, 8)).toEqual({ field: 0, index: 5 });
    expect(indexAt(l, 3, 22)).toEqual({ field: 0, index: 6 });
    expect(wordAt('Wache Nord', 7)).toEqual({ start: 6, end: 10 });
    expect(wordAt('Funk SE-235', 6)).toEqual({ start: 5, end: 11 });
  });
});
