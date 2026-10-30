// @vitest-environment jsdom
// H-DATEN (Härtung vor Gate B): Termintexte im Terminbereich – Folgezeilen (CR-H-D-01) und Zellen (CR-H-D-02).
// Beschrieb 8.2 Regel 1, 8, 11, 12. Fiktive Arbeitsmappen, keine Inhalte aus reference/.
import { describe, expect, it } from 'vitest';
import type { DayRemark, Entry } from '../../../../src/model/wap/types';
import { besoBox, emptyWeek, normal } from '../../fixtures/import/kp-workbook';
import { besos, entries, importWeeks, kinds, titleOf } from '../import/support';
import { importWithAgendaCells } from './support';

const remarks = (es: readonly Entry[]): DayRemark[] =>
  es.filter((e): e is DayRemark => e.type === 'dayRemark');

describe('CR-H-D-01: Folgezeilen ohne Nummer im Textfeld', () => {
  it('[R-8.2-04][R-8.2-20] Folgezeile einer Bemerkung ohne Nummer geht nicht verloren und kommt als unsicher in den Bericht', () => {
    const o = importWeeks([
      emptyWeek({
        agenda: [
          { day: 0, paragraphs: [[normal('Fiktive Bemerkung Teil eins')], [normal('Teil zwei')]] },
        ],
      }),
    ]);
    const rs = remarks(entries(o.result.plan));
    expect(rs).toHaveLength(1);
    expect(rs[0]?.text).toContain('Teil eins');
    expect(rs[0]?.text).toContain('Teil zwei');
    expect(kinds(o)).toContain('uncertainParse');
  });

  it('[R-8.2-27] Folgezeile eines nummerierten Termins ohne Zeit landet in der Bemerkung', () => {
    const o = importWeeks([
      emptyWeek({
        agenda: [
          {
            day: 0,
            paragraphs: [[normal('15 Fiktiver Termin ohne Zeit')], [normal('Fortsetzung zwei')]],
          },
        ],
      }),
    ]);
    const rs = remarks(entries(o.result.plan));
    expect(rs).toHaveLength(1);
    expect(rs[0]?.text).toContain('Fiktiver Termin ohne Zeit');
    expect(rs[0]?.text).toContain('Fortsetzung zwei');
    expect(kinds(o)).toContain('numberedWithoutTime');
    expect(kinds(o)).toContain('uncertainParse');
  });

  it('[R-8.2-04] Folgezeile eines Beso mit Zeit wird an den Titel angehängt', () => {
    const o = importWeeks([
      emptyWeek({
        shapes: [besoBox(0, 4, '0900', 11)],
        agenda: [
          {
            day: 0,
            paragraphs: [[normal('11 0900: Fiktive Übung')], [normal('Fortsetzung drei')]],
          },
        ],
      }),
    ]);
    const [b] = besos(o.result.plan);
    expect(titleOf(b ?? { title: [] })).toBe('Fiktive Übung Fortsetzung drei');
    expect(remarks(entries(o.result.plan))).toHaveLength(0);
  });

  it('[R-8.2-04] Folgezeile eines Beso mit Freitext geht auch im Freitext nicht verloren', () => {
    const o = importWeeks([
      emptyWeek({
        shapes: [besoBox(0, 4, '0900', 11)],
        agenda: [
          { day: 0, paragraphs: [[normal('11 0900 Fiktiver Freitext')], [normal('und Rest')]] },
        ],
      }),
    ]);
    const [b] = besos(o.result.plan);
    expect(b?.agendaOverride ?? titleOf(b ?? { title: [] })).toContain('und Rest');
    expect(JSON.stringify(o.result.plan.entries)).toContain('und Rest');
  });

  it('[R-8.2-04] zwei abgeschlossene Bemerkungen (mit Punkt) bleiben zwei Bemerkungen', () => {
    const o = importWeeks([
      emptyWeek({
        agenda: [
          {
            day: 0,
            paragraphs: [[normal('Fiktive Bemerkung eins.')], [normal('Fiktive Bemerkung zwei.')]],
          },
        ],
      }),
    ]);
    const rs = remarks(entries(o.result.plan));
    expect(rs.map((r) => r.text)).toEqual(['Fiktive Bemerkung eins.', 'Fiktive Bemerkung zwei.']);
  });
});

describe('CR-H-D-02: Termintexte aus Zellen des Terminbereichs', () => {
  it('[R-8.2-04] nummerierter Termin in einer Zelle wird Text des Beso mit Kästchen', () => {
    const o = importWithAgendaCells(
      [emptyWeek({ shapes: [besoBox(0, 4, '0900', 12)] })],
      [{ day: 0, text: '12 0900: Fiktive Zellenübung, Ort: Fiktivhalle.' }],
    );
    const [b] = besos(o.result.plan);
    expect(titleOf(b ?? { title: [] })).toBe('Fiktive Zellenübung');
    expect(b?.ort).toBe('Fiktivhalle');
    expect(kinds(o)).not.toContain('boxWithoutText');
  });

  it('[R-8.2-04] Zelle ohne Nummer wird ganztägige Bemerkung am Tag der Spalte', () => {
    const o = importWithAgendaCells(
      [emptyWeek()],
      [{ day: 2, col: 1, text: 'Fiktive Zellenbemerkung.' }],
    );
    const rs = remarks(entries(o.result.plan));
    expect(rs.map((r) => [r.date, r.text])).toEqual([['2099-10-07', 'Fiktive Zellenbemerkung.']]);
  });

  it('[R-8.2-04] Zeilenumbruch in der Zelle und Folgezeilen in der nächsten Zeile gehen nicht verloren', () => {
    const o = importWithAgendaCells(
      [emptyWeek({ shapes: [besoBox(1, 4, '1400', 21), besoBox(1, 4, '1600', 22)] })],
      [
        { day: 1, row: 1, text: '21 1400: Fiktiver Teil\nmit Umbruch' },
        { day: 1, row: 2, text: 'und Folgezeile' },
        { day: 1, row: 3, text: '22 1600: Zweiter fiktiver Termin.' },
      ],
    );
    expect(besos(o.result.plan).map((b) => titleOf(b))).toEqual([
      'Fiktiver Teil mit Umbruch und Folgezeile',
      'Zweiter fiktiver Termin',
    ]);
  });

  it('[R-8.2-05] rot durchgestrichene Nummer in einer Rich-Text-Zelle → Beso gestrichen', () => {
    const o = importWithAgendaCells(
      [emptyWeek({ shapes: [besoBox(0, 4, '0900', 13)] })],
      [
        {
          day: 0,
          text: [
            { text: '13', strike: true, color: 'FF0000' },
            { text: ' 0900: Alte fiktive Übung.' },
          ],
        },
      ],
    );
    expect(besos(o.result.plan)[0]?.status).toBe('cancelled');
  });

  it('[R-8.2-04] Kopfzeile des Terminbereichs («Nr.») wird kein Eintrag', () => {
    const o = importWithAgendaCells(
      [emptyWeek()],
      [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, row: 0, text: 'Nr.' })),
    );
    expect(entries(o.result.plan)).toHaveLength(0);
  });

  it('[R-8.2-04] Termin in Textfeld und Zelle am selben Tag: beide gelesen, gleiche Nummer kommt in den Bericht', () => {
    const o = importWithAgendaCells(
      [
        emptyWeek({
          shapes: [besoBox(0, 4, '0900', 11), besoBox(0, 4, '1000', 12)],
          agenda: [{ day: 0, paragraphs: [[normal('11 0900: Fiktiv im Textfeld.')]] }],
        }),
      ],
      [
        { day: 0, row: 12, text: '12 1000: Fiktiv in der Zelle.' },
        { day: 0, row: 13, text: '11 0900: Fiktiv doppelt.' },
      ],
    );
    expect(besos(o.result.plan).map((b) => titleOf(b))).toEqual([
      'Fiktiv im Textfeld',
      'Fiktiv in der Zelle',
    ]);
    expect(kinds(o)).toContain('uncertainParse');
  });
});
