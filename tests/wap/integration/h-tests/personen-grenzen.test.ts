// @vitest-environment jsdom
// H-TESTS (Härtung, TR-H-12): Personenliste aus Datei an den Grenzwerten 5000/5001 Personen und 10 MB ± 1 Byte, je
// als CSV und XLSX (Beschrieb 4.1, 11; Prompt §8; Vertrag E1-09 §1; R-4.1-11, R-11-05). Positivkontrolle: Die
// Eingabe enthält die Prüfwerte der verworfenen Spalten (AHV-Nr, Telefon, Adresse; fiktive Prüfwörter ohne Zahlen),
// das Ergebnis enthält sie nicht. Ausgabe nur Anzahlen.
import { strFromU8, strToU8, unzipSync, type Zippable, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { PersonFileError, readPersonFile } from '../../../../src/io/wap-persons/index';
import { csvMitZusatz, treffer, VERWORFEN, xlsxMitZusatz } from '../../support/i3/personen';

const MB10 = 10 * 1024 * 1024;
const utf8 = (s: string) => new TextEncoder().encode(s);

/** Zeile i: fiktive Person mit den Prüfwerten der Zusatzspalten (abwechselnd EINS und ZWEI). */
function zeile(i: number): string[] {
  const k = i % 2 === 0 ? 0 : 3;
  return [
    VERWORFEN[k] as string,
    `Muster${String(i).padStart(4, '0')}`,
    VERWORFEN[k + 1] as string,
    'Sdt',
    VERWORFEN[k + 2] as string,
    'Beispiel',
    'Fahrer',
  ];
}
const KOPF = ['AHV-Nr', 'Name', 'Telefon', 'Grad', 'Adresse', 'Vorname', 'Funktion'];

/** CSV mit `n` Personen; `pad` Zeichen in einer verworfenen Spalte «Notiz» der ersten Person. */
function csv(n: number, pad = 0): Uint8Array {
  const zeilen = [[...KOPF, 'Notiz'].join(';')];
  for (let i = 0; i < n; i++) zeilen.push([...zeile(i), i === 0 ? 'x'.repeat(pad) : ''].join(';'));
  return strToU8(`${zeilen.join('\r\n')}\r\n`);
}

/** CSV mit zwei Personen und genau `size` Bytes (Auffüllung in der verworfenen Spalte). */
function csvBytes(size: number): Uint8Array {
  const out = csv(2, size - csv(2, 0).byteLength);
  expect(out.byteLength).toBe(size);
  return out;
}

function esc(s: string): string {
  return s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

/** Arbeitsmappe mit `n` Personen (eingebettete Zeichenketten); `pad` Bytes in einem ungelesenen Teil, ungepackt. */
function xlsx(n: number, pad = 0): Uint8Array {
  const col = (j: number) => String.fromCharCode(65 + j);
  const row = (r: number, cells: readonly string[]) =>
    `<row r="${String(r)}">${cells.map((v, j) => `<c r="${col(j)}${String(r)}" t="inlineStr"><is><t>${esc(v)}</t></is></c>`).join('')}</row>`;
  const rows = [row(1, KOPF)];
  for (let i = 0; i < n; i++) rows.push(row(i + 2, zeile(i)));
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows.join('')}</sheetData></worksheet>`;
  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Personen" sheetId="1" r:id="rId1"/></sheets></workbook>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`;
  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
  const types = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/></Types>`;
  const files: Zippable = {
    '[Content_Types].xml': strToU8(types),
    '_rels/.rels': strToU8(rootRels),
    'xl/workbook.xml': strToU8(workbook),
    'xl/_rels/workbook.xml.rels': strToU8(rels),
    'xl/worksheets/sheet1.xml': strToU8(sheet),
    'docProps/auffuellung.bin': [new Uint8Array(pad), { level: 0 }],
  };
  return zipSync(files, { mtime: new Date('2026-10-14T08:00:00Z') });
}

/** Arbeitsmappe mit zwei Personen und genau `size` Bytes. */
function xlsxBytes(size: number): Uint8Array {
  const out = xlsx(2, size - xlsx(2, 0).byteLength);
  expect(out.byteLength).toBe(size);
  return out;
}

/** Prüfwerte in der (entpackten) Eingabe. */
function trefferEingabe(bytes: Uint8Array, name: string): number {
  if (name.endsWith('.csv')) return treffer(bytes);
  const teile = unzipSync(bytes, { filter: (f) => f.name.endsWith('.xml') });
  return treffer(
    utf8(
      Object.values(teile)
        .map((b) => strFromU8(b))
        .join('\n'),
    ),
  );
}

async function abgelehnt(bytes: Uint8Array, name: string): Promise<PersonFileError> {
  try {
    await readPersonFile(bytes, name);
  } catch (e) {
    if (e instanceof PersonFileError) return e;
    throw e;
  }
  throw new Error(`«${name}» wurde nicht abgelehnt`);
}

describe('H-TESTS Personenliste: Grenzwerte und Positivkontrolle', () => {
  it('[R-4.1-11][R-11-05] Positivkontrolle: die fiktiven Eingaben (CSV und XLSX) enthalten alle Prüfwerte, das Ergebnis keinen', async () => {
    for (const [name, bytes] of [
      ['liste.csv', csvMitZusatz()],
      ['liste.xlsx', xlsxMitZusatz()],
      ['viele.csv', csv(3)],
      ['viele.xlsx', xlsx(3)],
    ] as const) {
      expect(trefferEingabe(bytes, name), name).toBe(VERWORFEN.length);
      const r = await readPersonFile(bytes, name);
      expect(treffer(utf8(JSON.stringify(r))), name).toBe(0);
      expect(r.droppedColumnCount, name).toBeGreaterThanOrEqual(3);
    }
  });

  for (const art of ['csv', 'xlsx'] as const) {
    const datei = (n: number) => (art === 'csv' ? csv(n) : xlsx(n));

    it(`[R-4.1-11] ${art.toUpperCase()} mit genau 5000 Personen → alle übernommen, nur Grad, Name, Vorname, Funktion`, async () => {
      const bytes = datei(5000);
      expect(trefferEingabe(bytes, `l.${art}`)).toBe(VERWORFEN.length);
      const r = await readPersonFile(bytes, `liste.${art}`);
      expect(r.persons).toHaveLength(5000);
      expect(r.persons[4999]).toEqual({
        grad: 'Sdt',
        name: 'Muster4999',
        vorname: 'Beispiel',
        funktion: 'Fahrer',
      });
      expect(treffer(utf8(JSON.stringify(r)))).toBe(0);
    });

    it(`[R-4.1-11] ${art.toUpperCase()} mit 5001 Personen → abgelehnt mit Ursache und nächstem Schritt, ohne Prüfwerte in der Meldung`, async () => {
      const e = await abgelehnt(datei(5001), `liste.${art}`);
      expect(e.code).toBe('invalidFile');
      expect(e.userMessage.cause).toBe(`«liste.${art}» enthält mehr als 5000 Personen.`);
      expect(e.userMessage.nextStep).toBe(
        'Nur die Personen des Dienstes in eine eigene Datei übernehmen und diese wählen.',
      );
      expect(treffer(utf8(JSON.stringify(e.userMessage)))).toBe(0);
    });

    it(`[R-4.1-11] ${art.toUpperCase()} mit genau 10 MB → gelesen; 10 MB + 1 Byte → abgelehnt`, async () => {
      const genau = art === 'csv' ? csvBytes(MB10) : xlsxBytes(MB10);
      const r = await readPersonFile(genau, `gross.${art}`);
      expect(r.persons.map((p) => p.name)).toEqual(['Muster0000', 'Muster0001']);
      const e = await abgelehnt(
        art === 'csv' ? csvBytes(MB10 + 1) : xlsxBytes(MB10 + 1),
        `gross.${art}`,
      );
      expect(e.code).toBe('invalidFile');
      expect(e.userMessage.cause).toBe(
        `«gross.${art}» ist grösser als 10 MB und keine Personenliste.`,
      );
    });
  }
});
