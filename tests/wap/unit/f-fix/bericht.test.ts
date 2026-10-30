// @vitest-environment jsdom
// F-FIX Runde 5 (Zusatz, SA-34-Nacharbeit Runde 2): Meldungen des Importberichts mit Ursache und richtigem nächstem
// Schritt (Beschrieb 8.2 Regel 8 «keine Form geht still verloren», Regel 11; UI-Richtlinie 12).
// UX-AB-14: Ortsklammer eines Markers – Marker haben kein Ort-Feld (Beschrieb 4.6); der Ort wird nicht übernommen,
// aber gemeldet. UX-AB-16: Linie ohne Beschriftung – Art nicht bestimmbar. UX-AB-08: «in einen Beso umwandeln» nur
// ohne Kästchen derselben Nummer. Fiktive Arbeitsmappen.
import { describe, expect, it } from 'vitest';
import type { Marker } from '../../../../src/model/wap/types';
import { besoBox, block, emptyWeek, normal } from '../../fixtures/import/kp-workbook';
import { entries, importWeeks } from '../import/support';

describe('F-FIX Runde 5: Ort eines Markers (UX-AB-14, R-8.2-20)', () => {
  it('[R-8.2-20] Marker «AV (Halle Nord)»: der Ort bleibt Teil der Beschriftung (Art frei), nichts geht verloren, keine Meldung', () => {
    // Gate B 28.10.2026, Entscheid 14 b (ersetzt die Meldung aus UX-AB-14 bzw. CR-5-04): Marker haben kein Ort-Feld;
    // der Import übernimmt die ganze Beschriftung als Art frei.
    const o = importWeeks([
      emptyWeek({ shapes: [block(0, [0, 0], '0700', '0715', [[normal('AV (Halle Nord)')]])] }),
    ]);
    const m = entries(o.result.plan).find((e): e is Marker => e.type === 'marker');
    expect(m).toMatchObject({ kind: 'custom', customKind: 'AV (Halle Nord)', at: 420 });
    expect(o.report.items.filter((i) => i.kind === 'uncertainParse')).toEqual([]);
  });

  it('[R-8.2-20] Gegenprobe: Marker ohne Klammer → keine Meldung', () => {
    const o = importWeeks([
      emptyWeek({ shapes: [block(0, [0, 0], '0700', '0715', [[normal('AV')]])] }),
    ]);
    expect(o.report.items.filter((i) => i.kind === 'uncertainParse')).toEqual([]);
  });
});

describe('F-FIX Runde 5: Linie ohne Beschriftung (UX-AB-16, R-8.2-20)', () => {
  it('[R-8.2-20] Meldung nennt die Ursache (Art nicht bestimmbar) und einen ausführbaren nächsten Schritt', () => {
    const o = importWeeks([
      emptyWeek({ shapes: [block(2, [0, 2], '1200', '1200', [], { line: true })] }),
    ]);
    expect(o.report.items.find((i) => i.kind === 'unassignedShape')?.message).toEqual({
      cause:
        'Eine Linie ohne Beschriftung am Mi bei 1200 wurde nicht übernommen; ohne Beschriftung ist die Art des Markers nicht bestimmbar.',
      nextStep:
        'Die Art aus der Planung ergänzen (AV, ABV, HV oder eine freie Art mit Bezeichnung) oder die Meldung ignorieren, wenn die Linie nichts bedeutet.',
    });
  });
});

describe('F-FIX Runde 5: Termin ohne Zeit (UX-AB-08, R-8.2-27)', () => {
  it('[R-8.2-27] Mit Kästchen derselben Nummer: keine Empfehlung «in einen Beso umwandeln», Bemerkung und Beso bleiben', () => {
    const o = importWeeks([
      emptyWeek({
        shapes: [besoBox(0, 4, '0900', 51)],
        agenda: [{ day: 0, paragraphs: [[normal('51 Material fassen fiktiv.')]] }],
      }),
    ]);
    expect(o.report.items.find((i) => i.kind === 'numberedWithoutTime')?.message).toEqual({
      cause: 'Der Termin Nr 51 hat keine Zeit; er wurde als ganztägige Bemerkung übernommen.',
      nextStep:
        'Keine Aktion nötig, wenn der Termin ganztägig gilt; das Kästchen Nr 51 bleibt ein eigener Beso (siehe «Kästchen ohne Termintext»).',
    });
  });

  it('[R-8.2-27] Ohne Kästchen: Empfehlung bleibt «Zeit ergänzen und in einen Beso umwandeln, falls ein Zeitpunkt gilt»', () => {
    const o = importWeeks([
      emptyWeek({ agenda: [{ day: 0, paragraphs: [[normal('51 Material fassen fiktiv.')]] }] }),
    ]);
    expect(o.report.items.find((i) => i.kind === 'numberedWithoutTime')?.message.nextStep).toBe(
      'Zeit ergänzen und in einen Beso umwandeln, falls ein Zeitpunkt gilt.',
    );
  });
});
