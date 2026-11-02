// @vitest-environment node
// F-ABDECKUNG2: Personenliste aus Datei (Beschrieb 4.1; Prompt §8; Vertrag E1-09 §1; R-4.1-09, R-4.1-11, R-5.7-03,
// R-5.7-04). Grenzfälle des CSV- und XLSX-Lesers: Trennzeichen, Anführungszeichen, Leerzeilen, Kopfzeile mit
// doppelten oder fehlenden Spalten, Zeichenkodierung, Zellarten, Verweise im ersten Blatt und beschädigte
// Arbeitsmappen. Jede Ablehnung ist eine Meldung mit Ursache und nächstem Schritt. Nur fiktive Inhalte.
import { describe, expect, it } from 'vitest';
import { PersonFileError, readPersonFile } from '../../../../src/io/wap-persons/index';
import { bookOf, inl, KOPF, RELS, sheetOf, WORKBOOK, zipOf } from './zip';

const enc = new TextEncoder();
const csv = (text: string): Uint8Array => enc.encode(text);

async function fehler(f: () => Promise<unknown>): Promise<PersonFileError> {
  try {
    await f();
  } catch (e) {
    if (e instanceof PersonFileError) return e;
    throw e;
  }
  throw new Error('kein Fehler');
}

const XLSX_KAPUTT = {
  cause: '«liste.xlsx» konnte nicht als Excel-Arbeitsmappe (.xlsx) gelesen werden.',
  nextStep:
    'Die Datei in Excel öffnen, als «Excel-Arbeitsmappe (.xlsx)» speichern und erneut wählen.',
};

describe('F-ABDECKUNG2 Personenliste CSV', () => {
  it('[R-4.1-09] Komma als Trennzeichen, CRLF, BOM, Kopfzeile mit BOM-Zeichen und Leerraum; .txt und Grossschreibung der Endung', async () => {
    const text = '﻿ Grad , Name ,Vorname,Funktion\r\nLt,Muster,Anna,Zfhr\r\nWm,Probe,Beat,Four';
    const erwartet = [
      { grad: 'Lt', name: 'Muster', vorname: 'Anna', funktion: 'Zfhr' },
      { grad: 'Wm', name: 'Probe', vorname: 'Beat', funktion: 'Four' },
    ];
    for (const name of ['liste.csv', 'LISTE.CSV', 'liste.txt']) {
      const r = await readPersonFile(csv(text), name);
      expect(r.persons).toEqual(erwartet);
      expect(r.droppedColumnCount).toBe(0);
      expect(r.skippedRows).toEqual([]);
    }
  });

  it('[R-4.1-09] Leerzeilen vor der Kopfzeile werden übersprungen; Zeilennummern der übersprungenen Zeilen zählen ab der ersten Dateizeile', async () => {
    const text =
      ';;;\n\nGrad;Name;Vorname;Funktion\n;;;\nHptm;;Ohne;Kp Kdt\n\nLt;Muster;Anna;Zfhr\n';
    const r = await readPersonFile(csv(text), 'liste.csv');
    expect(r.persons).toEqual([{ grad: 'Lt', name: 'Muster', vorname: 'Anna', funktion: 'Zfhr' }]);
    expect(r.skippedRows).toEqual([
      { row: 4, reason: 'empty' },
      { row: 5, reason: 'missingName' },
      { row: 6, reason: 'empty' },
    ]);
  });

  it('[R-4.1-11] doppelte Kopfspalte: die erste gilt, die zweite zählt als verworfene Spalte; ihr Inhalt erscheint nirgends', async () => {
    const text =
      'Name;Grad;Name;Vorname;Funktion;Telefon\nMuster;Lt;PRUEFWERT-DOPPEL;Anna;Zfhr;PRUEFWERT-TEL\n';
    const r = await readPersonFile(csv(text), 'liste.csv');
    expect(r.persons).toEqual([{ grad: 'Lt', name: 'Muster', vorname: 'Anna', funktion: 'Zfhr' }]);
    expect(r.droppedColumnCount).toBe(2);
    expect(JSON.stringify(r).includes('PRUEFWERT')).toBe(false);
  });

  it('[R-4.1-11] Anführungszeichen in verworfenen und übernommenen Spalten, verdoppelte Anführungszeichen, Text nach dem Schlusszeichen, fehlende Spalten am Zeilenende', async () => {
    const text = [
      'Notiz;Grad;Name;Vorname;Funktion',
      '"PRUEFWERT ""a"";b";"Lt";"Muster ""M""";"An;na"x;Zfhr',
      'PRUEFWERT;Wm;Probe',
    ].join('\n');
    const r = await readPersonFile(csv(text), 'liste.csv');
    expect(r.persons).toEqual([
      { grad: 'Lt', name: 'Muster "M"', vorname: 'An;nax', funktion: 'Zfhr' },
      { grad: 'Wm', name: 'Probe', vorname: '', funktion: '' },
    ]);
    expect(r.droppedColumnCount).toBe(1);
    expect(JSON.stringify(r).includes('PRUEFWERT')).toBe(false);
  });

  it('[R-4.1-09] Zeilenumbruch in einem Feld: die Zeilennummer der folgenden übersprungenen Zeile berücksichtigt ihn', async () => {
    const text = 'Grad;Name;Vorname;Funktion\nLt;"Muster\nzwei";Anna;Zfhr\n;;;\n';
    const r = await readPersonFile(csv(text), 'liste.csv');
    expect(r.persons).toEqual([
      { grad: 'Lt', name: 'Muster\nzwei', vorname: 'Anna', funktion: 'Zfhr' },
    ]);
    expect(r.skippedRows).toEqual([{ row: 4, reason: 'empty' }]);
  });

  it('[R-5.7-03] fehlt eine Pflichtspalte, nennt die Meldung genau diese in der Einzahl; mehrere in der Mehrzahl', async () => {
    const eine = await fehler(() =>
      readPersonFile(csv('Grad;Name;Vorname\nLt;Muster;Anna\n'), 'eins.csv'),
    );
    expect(eine.code).toBe('missingColumns');
    expect(eine.userMessage).toEqual({
      cause: 'In «eins.csv» fehlt in der ersten Zeile die Spalte «Funktion».',
      nextStep:
        'Eine Kopfzeile mit Grad, Name, Vorname und Funktion ergänzen und die Datei erneut wählen. Weitere Spalten werden nicht übernommen.',
    });
    const zwei = await fehler(() => readPersonFile(csv('Name;Telefon\n'), 'zwei.csv'));
    expect(zwei.userMessage.cause).toBe(
      'In «zwei.csv» fehlt in der ersten Zeile die Spalten «Grad», «Vorname», «Funktion».',
    );
  });

  it('[R-5.7-03] leere Datei und Datei nur mit Leerzeilen: Meldung «leer»; keine UTF-8-Datei: Meldung mit Speicherhinweis', async () => {
    for (const text of ['', '﻿', '\n\n;;\n']) {
      const e = await fehler(() => readPersonFile(csv(text), 'leer.csv'));
      expect(e.code).toBe('empty');
      expect(e.userMessage).toEqual({
        cause: '«leer.csv» ist leer.',
        nextStep: 'Eine Liste mit der Kopfzeile Grad, Name, Vorname, Funktion wählen.',
      });
    }
    const latin1 = new Uint8Array([...enc.encode('Grad;Name;Vorname;Funktion\nLt;M'), 0xfc, 0x0a]);
    const e = await fehler(() => readPersonFile(latin1, 'alt.csv'));
    expect(e.code).toBe('invalidFile');
    expect(e.userMessage).toEqual({
      cause: '«alt.csv» ist keine Textdatei in UTF-8.',
      nextStep:
        'Die Liste in Excel als «CSV UTF-8 (durch Trennzeichen getrennt)» speichern oder als .xlsx wählen.',
    });
  });

  it('[FA2-01][R-4.1-09] Leerzeile vor einer Kopfzeile mit Komma: Trennzeichen aus der ersten Zeile mit Inhalt, Person übernommen', async () => {
    // Soll: Wie beim Semikolon wird die Leerzeile übersprungen und die Kopfzeile «Grad,Name,Vorname,Funktion»
    // erkannt (Trennzeichen aus der ersten Zeile mit Inhalt); die Person «Muster» wird übernommen. Bis F-FIX Runde 7
    // kam das Trennzeichen aus der ersten Dateizeile («;»), die Datei wurde mit «fehlende Spalten» abgelehnt (FA2-01).
    await expect(
      readPersonFile(csv('\nGrad,Name,Vorname,Funktion\nLt,Muster,Anna,Zfhr\n'), 'komma.csv'),
    ).resolves.toMatchObject({
      persons: [{ grad: 'Lt', name: 'Muster', vorname: 'Anna', funktion: 'Zfhr' }],
    });
  });
});

describe('F-ABDECKUNG2 Personenliste Formate', () => {
  it('[R-5.7-03] .xls und unbekannte Endung: Meldung mit Ursache und nächstem Schritt, Datei wird nicht gelesen', async () => {
    const xls = await fehler(() => readPersonFile(csv('Grad;Name'), 'alt.XLS'));
    expect(xls.code).toBe('unsupportedFormat');
    expect(xls.userMessage).toEqual({
      cause: '«alt.XLS» ist im alten Excel-Format (.xls).',
      nextStep:
        'Die Datei in Excel öffnen, als «Excel-Arbeitsmappe (.xlsx)» speichern und erneut wählen.',
    });
    const pdf = await fehler(() => readPersonFile(csv('Grad;Name'), 'liste.pdf'));
    expect(pdf.code).toBe('unsupportedFormat');
    expect(pdf.userMessage).toEqual({
      cause: '«liste.pdf» ist keine CSV- oder Excel-Datei.',
      nextStep:
        'Eine Liste als .csv oder .xlsx mit der Kopfzeile Grad, Name, Vorname, Funktion wählen.',
    });
  });
});

describe('F-ABDECKUNG2 Personenliste XLSX', () => {
  it('[R-4.1-09] gemeinsame Zeichenketten mit Lautschrift, leerem Eintrag und Zeichenverweisen; Zahl, Formeltext und leere Zelle', async () => {
    const shared =
      '<sst><si><t>Grad</t></si><si><t>Name</t></si><si><t>Vorname</t></si><si><t>Funktion</t></si>' +
      '<si><r><t>Mus</t></r><r><t xml:space="preserve">ter &amp; Co</t></r><rPh><t>PHONETIK</t></rPh></si>' +
      '<si/><si><t>&#x41;nna &#66;&lt;&gt;&quot;&apos;</t></si></sst>';
    const s = (ref: string, k: number) => `<c r="${ref}" t="s"><v>${String(k)}</v></c>`;
    const sheet = sheetOf(
      `<row r="1" spans="1:4">${s('A1', 0)}${s('B1', 1)}${s('C1', 2)}${s('D1', 3)}</row>` +
        `<row r="2">${s('A2', 5)}${s('B2', 4)}${s('C2', 6)}<c r="D2"><v>42</v></c></row>` +
        `<row r="3"><c r="A3" t="str"><f>A1</f><v>Wm</v></c>${s('B3', 4)}<c r="C3" s="1"/>${s('D3', 99)}</row>`,
    );
    const r = await readPersonFile(bookOf(sheet, { shared }), 'liste.xlsx');
    expect(r.persons).toEqual([
      { grad: '', name: 'Muster & Co', vorname: 'Anna B<>"\'', funktion: '42' },
      { grad: 'Wm', name: 'Muster & Co', vorname: '', funktion: '' },
    ]);
    expect(JSON.stringify(r).includes('PHONETIK')).toBe(false);
  });

  it('[R-4.1-11] Zellen ohne Lageangabe folgen der vorigen Zelle; leere und selbstschliessende Zeilen werden übersprungen; Zeilennummer aus dem Blatt', async () => {
    const sheet = sheetOf(
      '<row r="1"/><row r="2"></row>' +
        `<row r="3"><c r="B3" t="inlineStr"><is><t>Grad</t></is></c><c t="inlineStr"><is><t>Name</t></is></c>` +
        `<c t="inlineStr"><is><t>Vorname</t></is></c><c t="inlineStr"><is><t>Funktion</t></is></c>` +
        `<c t="inlineStr"><is><t>Adresse</t></is></c></row>` +
        `<row r="4">${inl('B4', 'Lt')}<c t="inlineStr"><is><t>Muster</t></is></c>${inl('D4', 'Anna')}${inl('E4', 'Zfhr')}${inl('F4', 'PRUEFWERT-ADR')}</row>` +
        `<row r="7">${inl('B7', 'Wm')}</row><rowBreaks count="0"/>`,
    );
    const r = await readPersonFile(bookOf(sheet), 'liste.xlsx');
    expect(r.persons).toEqual([{ grad: 'Lt', name: 'Muster', vorname: 'Anna', funktion: 'Zfhr' }]);
    expect(r.skippedRows).toEqual([{ row: 7, reason: 'missingName' }]);
    // Kopfzeile von A bis F: A leer, B–E Pflichtspalten, F verworfen → 2 verworfene Spalten.
    expect(r.droppedColumnCount).toBe(2);
    expect(JSON.stringify(r).includes('PRUEFWERT')).toBe(false);
  });

  it('[R-4.1-09] Blatt-Verweis: Beziehung mit «id» ohne Präfix, Ziel absolut oder mit «./»; gespeicherte (ungepackte) Teile', async () => {
    const zeile = `<row r="2">${inl('A2', 'Lt')}${inl('B2', 'Muster')}${inl('C2', 'Anna')}${inl('D2', 'Zfhr')}</row>`;
    const person = [{ grad: 'Lt', name: 'Muster', vorname: 'Anna', funktion: 'Zfhr' }];
    const ohnePraefix = bookOf(sheetOf(KOPF + zeile), {
      workbook: '<workbook><sheets><sheet name="A" sheetId="7" id="rId1"/></sheets></workbook>',
    });
    expect((await readPersonFile(ohnePraefix, 'a.xlsx')).persons).toEqual(person);
    const absolut = bookOf(sheetOf(KOPF + zeile), {
      rels: '<Relationships><Relationship Id="rId1" Target="/xl/worksheets/blatt.xml"/></Relationships>',
      sheetPath: 'xl/worksheets/blatt.xml',
    });
    expect((await readPersonFile(absolut, 'b.xlsx')).persons).toEqual(person);
    const punkt = bookOf(sheetOf(KOPF + zeile), {
      rels: '<Relationships><Relationship Id="rId1" Target="./worksheets/Sheet1.XML"/></Relationships>',
      method: 0,
    });
    expect((await readPersonFile(punkt, 'c.xlsx')).persons).toEqual(person);
  });

  it('[R-5.7-03] erstes Blatt ohne Inhalt: Meldung «leer» mit Hinweis auf das erste Blatt', async () => {
    const e = await fehler(() =>
      readPersonFile(bookOf(sheetOf('<row r="1"><c r="A1"/></row>')), 'leer.xlsx'),
    );
    expect(e.code).toBe('empty');
    expect(e.userMessage).toEqual({
      cause: 'Das erste Blatt von «leer.xlsx» ist leer.',
      nextStep:
        'Eine Liste mit der Kopfzeile Grad, Name, Vorname, Funktion im ersten Blatt wählen.',
    });
  });

  it('[R-5.7-03] fehlende Pflichtspalte im ersten Blatt: Meldung nennt die Spalte; das zweite Blatt wird nie gelesen', async () => {
    const sheet = sheetOf(
      `<row r="1">${inl('A1', 'Grad')}${inl('B1', 'Name')}${inl('C1', 'Vorname')}</row>`,
    );
    const e = await fehler(() => readPersonFile(bookOf(sheet), 'liste.xlsx'));
    expect(e.code).toBe('missingColumns');
    expect(e.userMessage.cause).toBe(
      'In «liste.xlsx» fehlt in der ersten Zeile die Spalte «Funktion».',
    );
  });

  const kaputt: readonly (readonly [string, () => Uint8Array])[] = [
    [
      'keine ZIP-Datei',
      () => enc.encode('Dies ist kein Archiv, nur fiktiver Text ohne Ende-Kennung.'),
    ],
    ['kürzer als die Ende-Kennung', () => new Uint8Array([0x50, 0x4b, 3, 4])],
    [
      'ohne Ende-Kennung',
      () => zipOf([{ name: 'xl/workbook.xml', text: WORKBOOK }], { withoutEnd: true }),
    ],
    [
      'falsche Signatur im zentralen Verzeichnis',
      () => zipOf([{ name: 'xl/workbook.xml', text: WORKBOOK }], { centralSignature: 0x12345678 }),
    ],
    [
      'falsche Signatur im lokalen Kopf',
      () => zipOf([{ name: 'xl/workbook.xml', text: WORKBOOK }], { localSignature: 0x12345678 }),
    ],
    [
      'gepackte Grösse länger als die Datei',
      () => zipOf([{ name: 'xl/workbook.xml', text: WORKBOOK }], { extraCompressedSize: 4096 }),
    ],
    [
      'unbekannte Packmethode',
      () =>
        zipOf([
          { name: 'xl/workbook.xml', text: WORKBOOK, method: 12 },
          { name: 'xl/_rels/workbook.xml.rels', text: RELS },
        ]),
    ],
    ['ohne workbook.xml', () => bookOf(sheetOf(KOPF), { workbook: null })],
    ['ohne Beziehungen', () => bookOf(sheetOf(KOPF), { rels: null })],
    [
      'Arbeitsmappe ohne Blatt',
      () => bookOf(sheetOf(KOPF), { workbook: '<workbook><sheets></sheets></workbook>' }),
    ],
    [
      'Blatt ohne Verweis',
      () =>
        bookOf(sheetOf(KOPF), {
          workbook: '<workbook><sheets><sheet name="A"/></sheets></workbook>',
        }),
    ],
    [
      'Verweis ohne passende Beziehung',
      () =>
        bookOf(sheetOf(KOPF), {
          rels: '<Relationships><Relationship Id="rId9" Target="worksheets/sheet1.xml"/></Relationships>',
        }),
    ],
    [
      'Blatt fehlt im Archiv',
      () => bookOf(sheetOf(KOPF), { sheetPath: 'xl/worksheets/anders.xml' }),
    ],
  ];

  it.each(kaputt)(
    '[R-5.7-04] beschädigte Arbeitsmappe (%s): Meldung «invalidFile» mit Ursache und nächstem Schritt',
    async (_, bytes) => {
      const e = await fehler(() => readPersonFile(bytes(), 'liste.xlsx'));
      expect(e.code).toBe('invalidFile');
      expect(e.userMessage).toEqual(XLSX_KAPUTT);
    },
  );

  it('[FA2-02][R-5.7-04] Zeichenverweis ausserhalb von Unicode in einer Zelle: Meldung «invalidFile» mit Ursache und nächstem Schritt', async () => {
    // Soll: Die beschädigte Zelle führt zur Meldung «konnte nicht als Excel-Arbeitsmappe (.xlsx) gelesen werden», nie
    // zu einem Programmfehler ohne Ursache und nächsten Schritt (R-5.7-03). Bis F-FIX Runde 7 ein RangeError (FA2-02).
    const sheet = sheetOf(`${KOPF}<row r="2">${inl('A2', 'Lt')}${inl('B2', 'M&#99999999;')}</row>`);
    let gefangen: unknown;
    try {
      await readPersonFile(bookOf(sheet), 'liste.xlsx');
    } catch (e) {
      gefangen = e;
    }
    expect(gefangen).toBeInstanceOf(PersonFileError);
    expect((gefangen as PersonFileError).code).toBe('invalidFile');
    expect((gefangen as PersonFileError).userMessage).toEqual(XLSX_KAPUTT);
  });

  it('[FA2-02][R-5.7-04] Gegenprobe: gültiger Zeichenverweis (&#252;) wird als Zeichen übernommen', async () => {
    const sheet = sheetOf(`${KOPF}<row r="2">${inl('A2', 'Lt')}${inl('B2', 'M&#252;ller')}</row>`);
    const r = await readPersonFile(bookOf(sheet), 'liste.xlsx');
    expect(r.persons[0]?.name).toBe('Müller');
  });
});
