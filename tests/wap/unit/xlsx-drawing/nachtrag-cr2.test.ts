// @vitest-environment jsdom
// Vertrag E1-07, Entscheid «Orchestrator, 05.10.2026 (Code-Review Runde 2, CR-E107-10/-11)»:
// (a) Jeder Blattteil und jeder Zeichnungsteil darf in einer Mappe höchstens einmal verwendet werden,
//     sonst 'corrupt', bevor der Teil ein zweites Mal ausgewertet wird (CR-E107-10).
// (b) G1 wird während des Lesens des Zentralverzeichnisses geprüft: beim 10 001. Eintrag sofort
//     'tooLarge', kein vollständiger Durchlauf (CR-E107-11).
// Alle Arbeitsmappen fiktiv und klein; die angegebene Eintragszahl steht nur im ZIP64-Ende.
// Zeitunabhängig (TR-E107-13, -14): Gezählt werden Aufrufe über die vertraglichen Aufrufwege,
// nämlich `unzipSync(bytes, { filter })` aus fflate (Änderungsnotiz CR-1 Punkt 1) und
// `readShapeRuns` aus './runs' (§2g «Aufrufweg», P14). Beide Hüllen sind transparent: Sie zählen
// und delegieren unverändert.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readWorkbook } from '../../../../src/io/xlsx-drawing';
import { expectXlsxCode, readValid } from './expect-xlsx';
import {
  absAnchor,
  bareRun,
  buildXlsx,
  drawingXml,
  NS_MAIN,
  NS_PKG_REL,
  NS_REL,
  sp,
  txBody,
  worksheetXml,
} from './fixture';
import { centralEntries } from './zip-directory';

const spy = vi.hoisted(() => ({ filterCalls: 0, runsCalls: 0 }));

vi.mock('fflate', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fflate')>();
  return {
    ...actual,
    unzipSync: (data: Uint8Array, opts?: Parameters<typeof actual.unzipSync>[1]) => {
      const filter = opts?.filter;
      if (!opts || !filter) return actual.unzipSync(data, opts);
      return actual.unzipSync(data, {
        ...opts,
        filter: (file) => {
          spy.filterCalls += 1;
          return filter(file);
        },
      });
    },
  };
});

vi.mock('../../../../src/io/xlsx-drawing/runs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../src/io/xlsx-drawing/runs')>();
  return {
    ...actual,
    readShapeRuns: (...args: Parameters<typeof actual.readShapeRuns>) => {
      spy.runsCalls += 1;
      return actual.readShapeRuns(...args);
    },
  };
});

afterEach(() => {
  spy.filterCalls = 0;
  spy.runsCalls = 0;
});

const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

const sheetA = worksheetXml({ rows: { 1: '<c r="A1"><v>1</v></c>' } });
const drawing = drawingXml(
  absAnchor(0, 0, 100_000, 100_000, sp({ name: 'Kasten', txBody: txBody([bareRun('Text')]) })),
);

const workbookXml = (entries: string): string =>
  `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="${NS_MAIN}" xmlns:r="${NS_REL}"><sheets>${entries}</sheets></workbook>`;
const wbRels = (rels: string): string =>
  `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="${NS_PKG_REL}">${rels}</Relationships>`;
const sheetRel = (id: string, target: string): string =>
  `<Relationship Id="${id}" Type="${REL}/worksheet" Target="${target}"/>`;
const drawingRels = (target: string): string =>
  `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="${NS_PKG_REL}"><Relationship Id="rId1" Type="${REL}/drawing" Target="${target}"/></Relationships>`;

/**
 * Gegenprobe: zwei Blätter mit je eigenem Blattteil und eigener Zeichnung sind gültig; eine
 * Ein-Blatt-Mappe mit Zeichnung wertet die Zeichnung genau einmal aus (Wirksamkeit der Hülle).
 */
function expectDistinctValid(): void {
  const wb = readValid(
    buildXlsx({
      sheets: [
        { name: 'Woche 1', sheetXml: sheetA, drawingXml: drawing },
        { name: 'Woche 2', sheetXml: sheetA, drawingXml: drawing },
      ],
    }),
  );
  expect(wb.sheets.map((s) => [s.name, s.shapes.length])).toEqual([
    ['Woche 1', 1],
    ['Woche 2', 1],
  ]);
  spy.runsCalls = 0;
  readValid(buildXlsx({ sheets: [{ name: 'Woche 1', sheetXml: sheetA, drawingXml: drawing }] }));
  expect(spy.runsCalls).toBe(1);
}

/** Doppelt verwendeter Teil: corrupt, und die Zeichnung wurde höchstens einmal ausgewertet. */
function expectCorruptOnce(bytes: Uint8Array): void {
  spy.runsCalls = 0;
  expectXlsxCode(() => readWorkbook(bytes), 'corrupt');
  expect(spy.runsCalls).toBeLessThanOrEqual(1);
}

describe('xlsx-drawing readWorkbook – Teil höchstens einmal verwendet (CR-E107-10, Entscheid a)', () => {
  it('[R-L-11] (Entscheid a; TR-E107-14, -16) zwei Blatteinträge auf denselben Blattteil, ohne und mit Zeichnung: corrupt, Blatt höchstens einmal ausgewertet; je eigener Blattteil gültig', () => {
    expectDistinctValid();
    // Ohne Zeichnung (TR-E107-16): Nur die Prüfung des Blattteils kann den Fall erkennen.
    // Mit Zeichnung (TR-E107-14): Deren Auswertung zeigt die des Blatts (höchstens 1 Aufruf).
    for (const withDrawing of [false, true]) {
      const check = withDrawing
        ? expectCorruptOnce
        : (bytes: Uint8Array): void => {
            expectXlsxCode(() => readWorkbook(bytes), 'corrupt');
          };
      const sheet1 = withDrawing
        ? { name: 'Woche 1', sheetXml: sheetA, drawingXml: drawing }
        : { name: 'Woche 1', sheetXml: sheetA };
      // Variante 1: beide Einträge mit derselben Beziehung.
      check(
        buildXlsx({
          sheets: [sheet1],
          workbookXmlOverride: workbookXml(
            '<sheet name="Woche 1" sheetId="1" r:id="rId1"/><sheet name="Woche 2" sheetId="2" r:id="rId1"/>',
          ),
        }),
      );
      // Variante 2: zwei Beziehungen mit demselben Ziel.
      // Variante 3: dasselbe Ziel in anderer Gross-/Kleinschreibung (Pfade ohne Gross-/Kleinschreibung).
      for (const target of ['worksheets/sheet1.xml', 'worksheets/SHEET1.xml']) {
        check(
          buildXlsx({
            sheets: [sheet1],
            workbookXmlOverride: workbookXml(
              '<sheet name="Woche 1" sheetId="1" r:id="rId1"/><sheet name="Woche 2" sheetId="2" r:id="rId9"/>',
            ),
            extraParts: {
              'xl/_rels/workbook.xml.rels': wbRels(
                sheetRel('rId1', 'worksheets/sheet1.xml') + sheetRel('rId9', target),
              ),
            },
          }),
        );
      }
    }
  });

  it('[R-L-11] (Entscheid a; TR-E107-14, -15) zwei Blätter auf dieselbe Zeichnung, auch in anderer Gross-/Kleinschreibung: corrupt, Zeichnung höchstens einmal ausgewertet; je eigene Zeichnung gültig', () => {
    expectDistinctValid();
    for (const target of ['../drawings/drawing1.xml', '../drawings/DRAWING1.xml']) {
      expectCorruptOnce(
        buildXlsx({
          sheets: [
            { name: 'Woche 1', sheetXml: sheetA, drawingXml: drawing },
            { name: 'Woche 2', sheetXml: sheetA },
          ],
          extraParts: { 'xl/worksheets/_rels/sheet2.xml.rels': drawingRels(target) },
        }),
      );
    }
  });
});

/**
 * Kopie der Datei mit einem ZIP64-Ende (Datensatz und Locator vor dem klassischen Ende), das
 * `count` Einträge angibt. Die echten Einträge und das Zentralverzeichnis bleiben unverändert;
 * die Datei wächst um 76 Byte.
 */
function withDeclaredEntryCount(bytes: Uint8Array, count: number): Uint8Array {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = bytes.length - 22;
  while (end >= 0 && dv.getUint32(end, true) !== 0x06054b50) end--;
  if (end < 0) throw new Error('Testhilfe: kein Ende des Zentralverzeichnisses');
  const cdSize = dv.getUint32(end + 12, true);
  const cdOffset = dv.getUint32(end + 16, true);
  const rec = new Uint8Array(56 + 20);
  const r = new DataView(rec.buffer);
  r.setUint32(0, 0x06064b50, true); // ZIP64-Ende
  r.setBigUint64(4, 44n, true);
  r.setUint16(12, 45, true);
  r.setUint16(14, 45, true);
  r.setBigUint64(24, BigInt(count), true); // Einträge auf diesem Datenträger
  r.setBigUint64(32, BigInt(count), true); // Einträge gesamt
  r.setBigUint64(40, BigInt(cdSize), true);
  r.setBigUint64(48, BigInt(cdOffset), true);
  r.setUint32(56, 0x07064b50, true); // Locator
  r.setBigUint64(56 + 8, BigInt(end), true); // Offset des ZIP64-Endes
  r.setUint32(56 + 16, 1, true);
  const out = new Uint8Array(bytes.length + rec.length);
  out.set(bytes.subarray(0, end), 0);
  out.set(rec, end);
  out.set(bytes.subarray(end), end + rec.length);
  return out;
}

describe('xlsx-drawing readWorkbook – G1 während des Lesens (CR-E107-11, Entscheid b)', () => {
  // Keine Zeitgrenze (TR-E107-13): Die Hülle zählt die Filteraufrufe von unzipSync. Nach Entscheid b
  // endet das Lesen beim 10 001. Eintrag, also nach genau 10 001 Aufrufen, unabhängig von der Angabe.
  // Die Testdauer ist grosszügig, damit ein vollständiger Durchlauf an der Zähl-Assertion scheitert.
  it('[R-L-11] (Entscheid b, G1; TR-E107-13) angegebene 10 001 und 30 000 000 Einträge (ZIP64, 1 KB-Datei): tooLarge nach genau 10 001 Filteraufrufen, kein vollständiger Durchlauf', () => {
    const base = buildXlsx({ sheets: [{ name: 'Woche 1', sheetXml: sheetA }] });
    expect(centralEntries(base).length).toBeLessThan(10); // Fixture-Prüfung: nur wenige echte Einträge
    // Wirksamkeit der Hülle: Eine gültige Mappe liest das Verzeichnis über den Filter.
    spy.filterCalls = 0;
    readValid(base);
    expect(spy.filterCalls).toBeGreaterThan(0);
    expectXlsxCode(() => readWorkbook(withDeclaredEntryCount(base, 10_001)), 'tooLarge');
    const huge = withDeclaredEntryCount(base, 30_000_000);
    expect(huge.length).toBeLessThan(4096); // Fixture-Prüfung: kein grosser Puffer
    spy.filterCalls = 0;
    expectXlsxCode(() => readWorkbook(huge), 'tooLarge');
    expect(spy.filterCalls).toBe(10_001);
  }, 60_000);
});
