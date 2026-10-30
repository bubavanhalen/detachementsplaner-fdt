// @vitest-environment jsdom
// I3 C2: Status-Darstellung am fertigen PDF (Beschrieb 10 «Status»; R-10-27 bis R-10-29, R-10-31; Rot #c00000 nach
// Q-009 UI-F-1). Erzeugt wie die App (renderWeekPdf mit Status-Darstellung), gelesen mit readPdf. Fiktive Daten.
import { describe, expect, it } from 'vitest';
import { renderWeekPdf } from '../../../../src/io/wap-pdf/index';
import type { EntryDraft } from '../../../../src/model/wap/commands/entries';
import { createEntry } from '../../../../src/model/wap/commands/entries';
import type { Plan, Rgb } from '../../../../src/model/wap/types';
import { CTX, kpPlan, weekId } from '../../support/i3/plan';
import { pageOptions } from '../../support/i3/seite';
import { pdfArtefakt } from '../../support/pdf/artefakt';
import { type PdfInfo, readPdf } from '../../support/pdf/read';

const MO = '2026-09-28';
const ROT: Rgb = { r: 192, g: 0, b: 0 };
const SCHWARZ: Rgb = { r: 0, g: 0, b: 0 };

function plan(): Plan {
  let p = kpPlan(1);
  const drafts: EntryDraft[] = [
    {
      type: 'block',
      date: MO,
      time: { form: 'range', from: 480, to: 660 },
      columns: { kind: 'all' },
      title: [{ text: 'Offener Block', bold: true }],
      supplement: 'Zusatz Muster',
      status: 'open',
    },
    {
      type: 'block',
      date: MO,
      time: { form: 'range', from: 780, to: 960 },
      columns: { kind: 'all' },
      title: [{ text: 'Gestrichener Block', bold: true }],
      status: 'cancelled',
    },
    {
      type: 'beso',
      date: MO,
      title: [{ text: 'Offene Visite', bold: false }],
      windows: [{ time: { form: 'point', at: 600 } }],
      status: 'open',
    },
    {
      type: 'beso',
      date: MO,
      title: [{ text: 'Materialfassung', bold: false }],
      windows: [{ time: { form: 'point', at: 1020 } }],
      ort: 'offen',
    },
  ];
  for (const d of drafts) p = createEntry(p, d, CTX).plan;
  return p;
}

async function pdf(p: Plan, showStatus: boolean, fall: string): Promise<PdfInfo> {
  const r = await renderWeekPdf(p, weekId(p, 0), pageOptions({ showStatus }), 'I3 Status');
  await pdfArtefakt(`i3-status-${fall}`, r.bytes);
  return readPdf(r.bytes);
}

const gleich = (a: Rgb, b: Rgb) => a.r === b.r && a.g === b.g && a.b === b.b;

describe('I3 Status-Darstellung im PDF (Beschrieb 10)', () => {
  it('[R-10-27] offen → Titel des Blocks und Terminzeile des Beso in #c00000, Zusatz schwarz', async () => {
    const info = await pdf(plan(), true, 'an');
    const titel = info.texts.filter((t) => t.text.includes('Offener'));
    expect(titel.length).toBeGreaterThan(0);
    for (const t of titel) expect(t.color).toEqual(ROT);
    for (const t of info.texts.filter((x) => x.text.includes('Zusatz Muster')))
      expect(t.color).toEqual(SCHWARZ);
    const termin = info.texts.filter((t) => t.text.includes('Offene Visite'));
    expect(termin.length).toBeGreaterThan(0);
    for (const t of termin) expect(t.color).toEqual(ROT);
  });

  it('[R-10-28] Feldwert «offen» → nur das Wort «offen» rot, der übrige Text der Terminzeile schwarz', async () => {
    const info = await pdf(plan(), true, 'wort');
    const wort = info.texts.filter((t) => t.text.trim() === 'offen');
    expect(wort.length).toBeGreaterThan(0);
    for (const t of wort) expect(t.color).toEqual(ROT);
    const rest = info.texts.filter((t) => t.text.includes('Materialfassung'));
    expect(rest.length).toBeGreaterThan(0);
    for (const t of rest) expect(t.color).toEqual(SCHWARZ);
  });

  it('[R-10-29] gestrichen → jede Textzeile des Eintrags rot mit Durchstreichlinie in #c00000', async () => {
    const info = await pdf(plan(), true, 'gestrichen');
    // Alle roten Läufe ausser denen der offenen Einträge (Titel, Kästchennummer, Terminzeile) und des Worts «offen»
    // gehören zum gestrichenen Block.
    const zeilen = info.texts.filter(
      (t) => gleich(t.color, ROT) && !/Offen|Visite|^\s*(offen|\d+)\s*$/.test(t.text),
    );
    expect(zeilen.some((t) => t.text.includes('Gestrichener'))).toBe(true);
    for (const t of info.texts.filter((x) => x.text.includes('Gestrichener')))
      expect(t.color).toEqual(ROT);
    for (const t of zeilen) {
      expect(t.color).toEqual(ROT);
      // Linie in Rot, die die Zeile in ihrer Laufrichtung überdeckt (waagrecht oder senkrecht).
      const linie = info.strokes.find(
        (s) =>
          gleich(s.color, ROT) &&
          s.bbox.x <= t.x + 0.5 &&
          s.bbox.x + s.bbox.w >= t.x - 0.5 &&
          (t.rotation === 0
            ? s.bbox.y <= t.baselineY && s.bbox.y + s.bbox.h + 0.5 >= t.baselineY - t.sizePt
            : true),
      );
      expect(linie, `Durchstreichlinie für «${t.text}»`).toBeDefined();
    }
  });

  it('[R-10-31] Status-Darstellung pro PDF abschaltbar: ohne Option kein Text und keine Linie in #c00000', async () => {
    const info = await pdf(plan(), false, 'aus');
    expect(info.texts.some((t) => gleich(t.color, ROT))).toBe(false);
    expect(info.strokes.some((s) => gleich(s.color, ROT))).toBe(false);
    expect(info.texts.some((t) => t.text.includes('Gestrichener'))).toBe(true);
  });
});
