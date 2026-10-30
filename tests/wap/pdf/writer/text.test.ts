// @vitest-environment jsdom
// Paket E1-02c: PDF-Schreiber – Text markier- und durchsuchbar (R-10-05; Vertrag E1-02c §2.3 Nr 4, §5;
// Präzisierung P-3; Änderungsnotiz Vertragsprüfung V02, V11, Runde 2 V15). Geprüft am fertigen PDF mit
// readPdf (E1-01b): Text je Lauf, Lage, Breite = measureRuns, Grösse, Drehung, Unicode-Zuordnung.
import { describe, expect, it } from 'vitest';
import { PdfWriteError, writePdf } from '../../../../src/io/wap-pdf/writer';
import type { TextRunOut } from '../../../../src/model/wap/layout/pageModel';
import { measureRuns } from '../../../../src/model/wap/layout/text/measure';
import { fontMetrics } from '../../../../src/model/wap/layout/text/metrics';
import { type PdfTextRun, readPdf } from '../../support/pdf/read';
import { ereignisse, texte } from './support/operatoren';
import { nahe } from './support/pruefen';
import { ablehnung, pdfMitArtefakt } from './support/schreiben';
import { BLAU, fett, GRUEN, lauf, ROT, SCHWARZ, seite, text, zeile } from './support/seiten';

const SONDERZEICHEN = 'ä ö ü Ä Ö Ü ß é à « » – ’';

function lauefe(info: { texts: PdfTextRun[] }, inhalt: string): PdfTextRun[] {
  return info.texts.filter((t) => t.text === inhalt);
}

/** Erwartete Lage des Laufs k (Vorschub = Summe der Breiten der vorherigen Läufe in Leserichtung). */
function lageVon(
  x: number,
  baselineY: number,
  rotation: 0 | 90 | 270,
  versatz: number,
): { x: number; y: number } {
  if (rotation === 90) return { x, y: baselineY - versatz };
  if (rotation === 270) return { x, y: baselineY + versatz };
  return { x: x + versatz, y: baselineY };
}

describe('writePdf: Text je Lauf (Vertrag §2.3 Nr 4)', () => {
  it('[R-10-05] jeder Lauf liefert genau seinen Text, auch ä ö ü Ä Ö Ü ß é à « » – ’; Schrift mit Unicode-Zuordnung', async () => {
    const info = await readPdf(
      await pdfMitArtefakt('sonderzeichen', [
        seite([
          text(60, 80, SONDERZEICHEN),
          text(60, 100, SONDERZEICHEN, { weight: 'bold' }),
          text(60, 120, 'Übermittlung «Fassung Mun» – Kp Kdt’s Rapport 0700-1200'),
        ]),
      ]),
    );
    expect(info.texts.map((t) => t.text)).toEqual([
      SONDERZEICHEN,
      SONDERZEICHEN,
      'Übermittlung «Fassung Mun» – Kp Kdt’s Rapport 0700-1200',
    ]);
    expect(info.texts.map((t) => t.bold)).toEqual([false, true, false]);
    expect(info.fonts.length).toBeGreaterThan(0);
    for (const f of info.fonts) expect(f.toUnicode, f.name).toBe(true);
  });

  it('[R-10-05] Lage x/Grundlinie ± 0,01 pt, Breite = measureRuns ± 0,01 pt, Grösse = sizePt, Farbe je Lauf; Läufe folgen ohne Abstand', async () => {
    const runs: TextRunOut[] = [
      lauf('Ausbildung ', { color: SCHWARZ }),
      fett('Zugführer', ROT),
      lauf(' im Gelände', { color: BLAU }),
    ];
    const z = zeile({ x: 123.45, baselineY: 234.56, sizePt: 5.5, runs });
    const info = await readPdf(await pdfMitArtefakt('laeufe-lage', [seite([z])]));
    expect(info.texts.map((t) => t.text)).toEqual(runs.map((r) => r.text));
    let versatz = 0;
    runs.forEach((r, k) => {
      const t = info.texts[k];
      nahe(t?.x, 123.45 + versatz, `Lauf ${String(k)} x`);
      nahe(t?.baselineY, 234.56, `Lauf ${String(k)} Grundlinie`);
      nahe(t?.width, measureRuns([r], 5.5), `Lauf ${String(k)} Breite`);
      nahe(t?.sizePt, 5.5, `Lauf ${String(k)} Grösse`);
      expect(t?.rotation).toBe(0);
      expect(t?.color).toEqual(r.color);
      expect(t?.bold).toBe(r.weight === 'bold');
      versatz += measureRuns([r], 5.5);
    });
  });

  it('[R-10-05] gedreht 90 und 270: Text, Drehung, Lage des Laufbeginns und Breite je Lauf', async () => {
    for (const rotation of [90, 270] as const) {
      const runs: TextRunOut[] = [
        lauf('Sph Det '),
        fett('FALCON'),
        lauf(' Übung', { color: GRUEN }),
      ];
      const z = zeile({ x: 300.5, baselineY: 400.25, sizePt: 4.5, rotation, runs });
      const info = await readPdf(await pdfMitArtefakt(`gedreht-${String(rotation)}`, [seite([z])]));
      expect(info.texts.map((t) => t.text)).toEqual(runs.map((r) => r.text));
      let versatz = 0;
      runs.forEach((r, k) => {
        const t = info.texts[k];
        const soll = lageVon(300.5, 400.25, rotation, versatz);
        expect(t?.rotation, `${String(rotation)} Lauf ${String(k)}`).toBe(rotation);
        nahe(t?.x, soll.x, `${String(rotation)} Lauf ${String(k)} x`);
        nahe(t?.baselineY, soll.y, `${String(rotation)} Lauf ${String(k)} Grundlinie`);
        nahe(t?.width, measureRuns([r], 4.5), `${String(rotation)} Lauf ${String(k)} Breite`);
        nahe(t?.sizePt, 4.5, `${String(rotation)} Lauf ${String(k)} Grösse`);
        versatz += measureRuns([r], 4.5);
      });
    }
  });

  it('[R-10-05] Schriftgrössen 4,5 / 5 / 5,5 / 8 / 12 pt werden exakt übernommen', async () => {
    const groessen = [4.5, 5, 5.5, 8, 12];
    const info = await readPdf(
      await pdfMitArtefakt('groessen', [
        seite(
          groessen.map((g, i) => text(100, 100 + i * 30, `Grösse ${String(g)}`, { sizePt: g })),
        ),
      ]),
    );
    groessen.forEach((g, i) => {
      nahe(info.texts[i]?.sizePt, g, `Grösse ${String(g)}`);
      nahe(
        info.texts[i]?.width,
        measureRuns([lauf(`Grösse ${String(g)}`)], g),
        `Breite ${String(g)}`,
      );
    });
  });

  it('[R-10-05] (P-3) Breite = measureRuns auch mit erlaubten unsichtbaren Zeichen U+200B, U+2060, U+FEFF und mit U+00A0', async () => {
    const proben = ['Wo\u200Bche', 'Ab\u2060marsch', 'Fass\uFEFFung', '0700 Uhr'];
    for (const cp of [0x200b, 0x2060, 0xfeff, 0x00a0]) {
      expect(fontMetrics().advance(cp, 'regular'), `U+${cp.toString(16)} in Arimo`).not.toBeNull();
    }
    const info = await readPdf(
      await pdfMitArtefakt('unsichtbar', [
        seite(proben.map((p, i) => text(100, 100 + i * 20, p, { sizePt: 8 }))),
      ]),
    );
    expect(info.texts).toHaveLength(proben.length);
    proben.forEach((p, i) => {
      nahe(info.texts[i]?.width, measureRuns([lauf(p)], 8), `Breite ${JSON.stringify(p)}`);
      nahe(info.texts[i]?.x, 100, `x ${JSON.stringify(p)}`);
    });
  });

  it('[R-10-05] keine Zeichen-, Wort- und Breitenabstände: Tc = 0, Tw = 0, Tz = 100 bei jeder Textanzeige', async () => {
    const bytes = await pdfMitArtefakt('abstaende', [
      seite([
        text(100, 100, 'Wort mit  zwei  Leerzeichen'),
        zeile({ x: 100, baselineY: 140, runs: [lauf('a b '), fett('c d')] }),
      ]),
    ]);
    const t = texte(await ereignisse(bytes));
    expect(t.length).toBeGreaterThanOrEqual(3);
    for (const x of t) {
      expect([x.tc, x.tw, x.tz], x.text).toEqual([0, 0, 100]);
    }
    const info = await readPdf(bytes);
    nahe(
      info.texts[0]?.width,
      measureRuns([lauf('Wort mit  zwei  Leerzeichen')], 10),
      'Breite mit Leerzeichen',
    );
  });

  it('[R-10-05] (V11) Läufe mit leerem Text werden nicht gezeichnet; die folgenden Läufe beginnen ohne Versatz', async () => {
    const runs = [lauf(''), lauf('Mitte'), fett(''), lauf(' Ende')];
    const bytes = await pdfMitArtefakt('leere-laeufe', [
      seite([zeile({ x: 50, baselineY: 60, runs })]),
    ]);
    const t = texte(await ereignisse(bytes));
    expect(t.map((x) => x.text)).toEqual(['Mitte', ' Ende']);
    const info = await readPdf(bytes);
    nahe(info.texts[0]?.x, 50, 'Mitte x');
    nahe(info.texts[1]?.x, 50 + measureRuns([lauf('Mitte')], 10), 'Ende x');
    expect(info.fonts.map((f) => f.name)).toEqual(['Arimo']);
  });

  it('[R-10-05] ohne ImageItem keine Bilder im PDF', async () => {
    const info = await readPdf(
      await pdfMitArtefakt('ohne-bild', [
        seite([text(100, 100, 'Kein Bild'), text(100, 200, 'Fett', { weight: 'bold' })]),
      ]),
    );
    expect(info.images).toBe(0);
  });
});

describe('writePdf: geteilte Glyphen (V02)', () => {
  // U+037E ist nicht NFC (NFC ergibt U+003B) und wird nach Runde 2 V16 abgelehnt; der Pflichtfall aus V02 mit
  // U+037E ist darum nur am Adapter prüfbar (tests/wap/unit/pdf-writer/fontkit-adapter.test.ts). Im PDF dienen
  // die übrigen Paare in NFC: U+202F/U+2009, U+2215/U+2044, U+04D8/U+018F.
  const vorwaerts = [
    lauf('c\u202Fd'),
    lauf('e\u2009f'),
    lauf('x\u2215y'),
    lauf('a\u2044b'),
    lauf('\u04D8\u018F'),
  ];
  const gelesen = ['c\u2009d', 'e\u2009f', 'x\u2044y', 'a\u2044b', '\u018F\u018F'];

  it('[R-10-05] (V02) U+202F vor U+2009, U+2215 vor U+2044 und U+04D8 vor U+018F im selben Schnitt lesen sich mit dem Hauptcodepunkt', async () => {
    for (const cp of [0x202f, 0x2009, 0x2215, 0x2044, 0x04d8, 0x018f]) {
      expect(fontMetrics().advance(cp, 'regular'), `U+${cp.toString(16)} in Arimo`).not.toBeNull();
      expect(String.fromCodePoint(cp).normalize('NFC')).toBe(String.fromCodePoint(cp));
    }
    const info = await readPdf(
      await pdfMitArtefakt('geteilt-vor', [
        seite(vorwaerts.map((r, i) => zeile({ x: 100, baselineY: 100 + i * 20, runs: [r] }))),
      ]),
    );
    expect(info.texts.map((t) => t.text)).toEqual(gelesen);
    vorwaerts.forEach((r, i) => {
      nahe(info.texts[i]?.width, measureRuns([r], 10), `Breite ${String(i)}`);
    });
  });

  it('[R-10-05] (V02) auch in umgekehrter Reihenfolge und im fetten Schnitt', async () => {
    const rueckwaerts = [...vorwaerts].reverse();
    const fetteRuns = vorwaerts.map((r) => fett(r.text));
    const info = await readPdf(
      await pdfMitArtefakt('geteilt-rueck', [
        seite([
          ...rueckwaerts.map((r, i) => zeile({ x: 100, baselineY: 100 + i * 20, runs: [r] })),
          ...fetteRuns.map((r, i) => zeile({ x: 400, baselineY: 100 + i * 20, runs: [r] })),
        ]),
      ]),
    );
    expect(info.texts.map((t) => t.text)).toEqual([...[...gelesen].reverse(), ...gelesen]);
  });

  it('[R-10-05] (V02) ein Lauf mit Haupt- und Zweitcodepunkt zugleich liest sich zweimal mit dem Hauptcodepunkt', async () => {
    const info = await readPdf(
      await pdfMitArtefakt('geteilt-gemischt', [
        seite([text(100, 100, 'A\u202F\u2009\u2215\u2044B')]),
      ]),
    );
    expect(lauefe(info, 'A\u2009\u2009\u2044\u2044B')).toHaveLength(1);
  });

  it('[R-10-05] (V02, V16) U+037E (Zweitcodepunkt von «;», nicht NFC) ergibt invalidItem mit character U+037E', async () => {
    const e = (await ablehnung(
      writePdf({ pages: [seite([text(10, 10, 'x\u037Ey')])], title: 'Fiktiv' }),
    )) as PdfWriteError;
    expect(e).toBeInstanceOf(PdfWriteError);
    expect([e.code, e.pageIndex, e.itemIndex, e.character]).toEqual([
      'invalidItem',
      0,
      0,
      '\u037E',
    ]);
  });
});
