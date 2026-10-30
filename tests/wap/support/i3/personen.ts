// Fiktive Personenlisten für I3 C4 (Beschrieb 4.1, 11; Prompt §8): CSV und XLSX mit Zusatzspalten, deren Werte
// nirgends erscheinen dürfen. Alle Werte sind erfunden; in den Spalten AHV-Nr, Telefon und Adresse stehen nur
// Prüfwörter ohne Zahlen (für die Byte-Suche, keine echten oder echt aussehenden Daten).
import { strToU8, zipSync } from 'fflate';

/** Prüfwerte der verworfenen Spalten (Byte-Suche). */
export const VERWORFEN = [
  'PRUEFWERT-AHV-EINS',
  'PRUEFWERT-TELEFON-EINS',
  'PRUEFWERT-ADRESSE-EINS',
  'PRUEFWERT-AHV-ZWEI',
  'PRUEFWERT-TELEFON-ZWEI',
  'PRUEFWERT-ADRESSE-ZWEI',
] as const;

export const PERSONEN = [
  { grad: 'Lt', name: 'Muster', vorname: 'Beispiel', funktion: 'Zfhr' },
  { grad: 'Wm', name: 'Probe', vorname: 'Test', funktion: 'Einh Fw' },
] as const;

/** CSV mit Semikolon: Kopfzeile in anderer Reihenfolge, Zusatzspalten AHV, Telefon, Adresse. */
export function csvMitZusatz(): Uint8Array {
  const zeilen = [
    'AHV-Nr;Name;Telefon;Grad;Adresse;Vorname;Funktion',
    `${VERWORFEN[0]};Muster;${VERWORFEN[1]};Lt;"${VERWORFEN[2]}";Beispiel;Zfhr`,
    `${VERWORFEN[3]};Probe;${VERWORFEN[4]};Wm;"${VERWORFEN[5]}";Test;Einh Fw`,
  ];
  return strToU8(`﻿${zeilen.join('\r\n')}\r\n`);
}

function esc(s: string): string {
  return s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

/**
 * Minimale Arbeitsmappe: erstes Blatt mit Kopfzeile und zwei Personen (gemeinsame und eingebettete Zeichenketten),
 * Zusatzspalten mit Prüfwerten; ein zweites Blatt mit einer weiteren Kopfzeile wird nicht gelesen.
 */
export function xlsxMitZusatz(): Uint8Array {
  const shared = [
    'Grad',
    'Name',
    'Vorname',
    'Funktion',
    'AHV-Nr',
    'Telefon',
    'Adresse',
    ...PERSONEN.flatMap((p) => [p.grad, p.name, p.vorname, p.funktion]),
    ...VERWORFEN,
  ];
  const si = (s: string) => shared.indexOf(s);
  const c = (ref: string, s: string) => `<c r="${ref}" t="s"><v>${si(s)}</v></c>`;
  const inline = (ref: string, s: string) =>
    `<c r="${ref}" t="inlineStr"><is><t>${esc(s)}</t></is></c>`;
  const p0 = PERSONEN[0];
  const p1 = PERSONEN[1];
  const sheet1 = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>
<row r="1">${c('A1', 'AHV-Nr')}${c('B1', 'Grad')}${c('C1', 'Name')}${c('D1', 'Telefon')}${c('E1', 'Vorname')}${c('F1', 'Funktion')}${c('G1', 'Adresse')}</row>
<row r="2">${c('A2', VERWORFEN[0])}${c('B2', p0.grad)}${c('C2', p0.name)}${c('D2', VERWORFEN[1])}${c('E2', p0.vorname)}${c('F2', p0.funktion)}${c('G2', VERWORFEN[2])}</row>
<row r="3">${inline('A3', VERWORFEN[3])}${inline('B3', p1.grad)}${inline('C3', p1.name)}${inline('D3', VERWORFEN[4])}${inline('E3', p1.vorname)}${inline('F3', p1.funktion)}${inline('G3', VERWORFEN[5])}</row>
<row r="4"></row>
</sheetData></worksheet>`;
  const sheet2 = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>
<row r="1">${inline('A1', 'Grad')}${inline('B1', 'Name')}${inline('C1', 'Vorname')}${inline('D1', 'Funktion')}</row>
<row r="2">${inline('A2', 'Oblt')}${inline('B2', 'Zweitblatt')}${inline('C2', 'Nie')}${inline('D2', 'Kdt')}</row>
</sheetData></worksheet>`;
  const sst = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${shared.length}" uniqueCount="${shared.length}">${shared.map((s) => `<si><t>${esc(s)}</t></si>`).join('')}</sst>`;
  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Personen" sheetId="1" r:id="rId1"/><sheet name="Weitere" sheetId="2" r:id="rId2"/></sheets></workbook>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>`;
  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
  const types = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/></Types>`;
  return zipSync({
    '[Content_Types].xml': strToU8(types),
    '_rels/.rels': strToU8(rootRels),
    'xl/workbook.xml': strToU8(workbook),
    'xl/_rels/workbook.xml.rels': strToU8(rels),
    'xl/worksheets/sheet1.xml': strToU8(sheet1),
    'xl/worksheets/sheet2.xml': strToU8(sheet2),
    'xl/sharedStrings.xml': strToU8(sst),
  });
}

/** Enthält `bytes` einen der Prüfwerte (UTF-8)? Gibt nur die Anzahl der Treffer zurück. */
export function treffer(bytes: Uint8Array): number {
  const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  return VERWORFEN.filter((v) => text.includes(v)).length;
}
