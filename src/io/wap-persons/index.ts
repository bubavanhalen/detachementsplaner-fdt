// Personenliste aus einer lokalen Datei (I3 C4; Beschrieb 4.1, 11; Prompt §8; Gate-0-Entscheid 8, Vertrag E1-09 §1).
// Übernommen werden ausschliesslich Grad, Name, Vorname und Funktion. Werte aller übrigen Spalten werden beim
// Lesen übersprungen: Sie entstehen nie als Zeichenkette, Objekt, Meldung, Protokoll oder Zwischenspeicher
// (R-4.1-11, R-11-05). Die Datei wird nur gelesen, nie verändert und nie übertragen.

import { type UserMessage, WapError } from '../../model/wap/errors';
import type { Person } from '../../model/wap/types';
import { openZipParts, type ZipParts } from './zip';

export type PersonRow = Omit<Person, 'id'>;

export interface PersonImportResult {
  readonly persons: readonly PersonRow[];
  readonly skippedRows: readonly {
    readonly row: number;
    readonly reason: 'empty' | 'missingName';
  }[];
  /** Nur die Anzahl der verworfenen Spalten, nie ihre Namen oder Inhalte. */
  readonly droppedColumnCount: number;
}

export type PersonFileErrorCode = 'unsupportedFormat' | 'missingColumns' | 'empty' | 'invalidFile';

export class PersonFileError extends WapError {
  declare readonly code: PersonFileErrorCode;
  constructor(code: PersonFileErrorCode, message: UserMessage) {
    super(code, message);
  }
}

/** Pflichtspalten in dieser Reihenfolge (Kopfzeile Pflicht, Gross/Klein und Leerraum egal). */
const REQUIRED = ['Grad', 'Name', 'Vorname', 'Funktion'] as const;
type Field = 'grad' | 'name' | 'vorname' | 'funktion';
const FIELD_OF: Readonly<Record<string, Field>> = {
  grad: 'grad',
  name: 'name',
  vorname: 'vorname',
  funktion: 'funktion',
};
/** Höchstens so viele Personen (Schutz vor versehentlich gewählten grossen Dateien). */
const MAX_ROWS = 5000;
const MAX_BYTES = 10 * 1024 * 1024;

function normalize(head: string): string {
  return head.replace(/^﻿/, '').trim().toLowerCase();
}

function fail(code: PersonFileErrorCode, fileName: string, cause: string, nextStep: string): never {
  throw new PersonFileError(code, { cause: cause.replaceAll('{datei}', fileName), nextStep });
}

/** Zuordnung Spaltenindex → Feld aus der Kopfzeile; fehlende Pflichtspalten → Meldung, die sie nennt. */
function mapHeader(heads: readonly string[], fileName: string): Map<number, Field> {
  const map = new Map<number, Field>();
  const seen = new Set<Field>();
  heads.forEach((h, i) => {
    const f = FIELD_OF[normalize(h)];
    if (f !== undefined && !seen.has(f)) {
      seen.add(f);
      map.set(i, f);
    }
  });
  const missing = REQUIRED.filter((r) => !seen.has(FIELD_OF[r.toLowerCase()] as Field));
  if (missing.length > 0) {
    fail(
      'missingColumns',
      fileName,
      `In «{datei}» fehlt in der ersten Zeile ${missing.length === 1 ? 'die Spalte' : 'die Spalten'} ${missing.map((m) => `«${m}»`).join(', ')}.`,
      'Eine Kopfzeile mit Grad, Name, Vorname und Funktion ergänzen und die Datei erneut wählen. Weitere Spalten werden nicht übernommen.',
    );
  }
  return map;
}

class Collector {
  readonly persons: PersonRow[] = [];
  readonly skipped: { row: number; reason: 'empty' | 'missingName' }[] = [];
  constructor(private readonly fileName: string) {}
  add(row: number, values: Readonly<Partial<Record<Field, string>>>): void {
    const p: PersonRow = {
      grad: (values.grad ?? '').trim(),
      name: (values.name ?? '').trim(),
      vorname: (values.vorname ?? '').trim(),
      funktion: (values.funktion ?? '').trim(),
    };
    if (p.grad === '' && p.name === '' && p.vorname === '' && p.funktion === '') {
      this.skipped.push({ row, reason: 'empty' });
      return;
    }
    if (p.name === '') {
      this.skipped.push({ row, reason: 'missingName' });
      return;
    }
    if (this.persons.length >= MAX_ROWS) {
      fail(
        'invalidFile',
        this.fileName,
        `«{datei}» enthält mehr als ${MAX_ROWS} Personen.`,
        'Nur die Personen des Dienstes in eine eigene Datei übernehmen und diese wählen.',
      );
    }
    this.persons.push(p);
  }
}

// ---------------------------------------------------------------------------------------------------------
// CSV (RFC 4180, Trennzeichen «;» oder «,», UTF-8 mit oder ohne BOM)
// ---------------------------------------------------------------------------------------------------------

/**
 * Liest die Felder zeichenweise. Nur Felder, deren Spalte `keep(i)` bejaht, werden zu Text zusammengesetzt; die
 * übrigen werden überlesen (nie als Zeichenkette gebildet).
 */
function csvRows(
  text: string,
  sep: string,
  onRow: (fields: ReadonlyMap<number, string>, line: number) => boolean,
  keep: (i: number) => boolean,
): void {
  let i = 0;
  let line = 1;
  const n = text.length;
  while (i < n) {
    const fields = new Map<number, string>();
    let col = 0;
    let rowLine = line;
    let ended = false;
    while (!ended) {
      const wanted = keep(col);
      let value = '';
      if (text[i] === '"') {
        i += 1;
        while (i < n) {
          const ch = text[i] as string;
          if (ch === '"') {
            if (text[i + 1] === '"') {
              if (wanted) value += '"';
              i += 2;
              continue;
            }
            i += 1;
            break;
          }
          if (ch === '\n') line += 1;
          if (wanted) value += ch;
          i += 1;
        }
      }
      while (i < n && text[i] !== sep && text[i] !== '\n' && text[i] !== '\r') {
        if (wanted) value += text[i];
        i += 1;
      }
      if (wanted) fields.set(col, value);
      if (i >= n) ended = true;
      else if (text[i] === sep) i += 1;
      else {
        if (text[i] === '\r' && text[i + 1] === '\n') i += 1;
        i += 1;
        line += 1;
        ended = true;
      }
      col += 1;
    }
    if (!onRow(fields, rowLine)) return;
    rowLine = line;
  }
}

function readCsv(bytes: Uint8Array, fileName: string): PersonImportResult {
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    fail(
      'invalidFile',
      fileName,
      '«{datei}» ist keine Textdatei in UTF-8.',
      'Die Liste in Excel als «CSV UTF-8 (durch Trennzeichen getrennt)» speichern oder als .xlsx wählen.',
    );
  }
  text = text.replace(/^﻿/, '');
  // Trennzeichen aus der ersten Zeile mit Inhalt (Leerzeilen vor der Kopfzeile werden übersprungen; FA2-01).
  const firstLine = text.split(/\r?\n/).find((l) => l.trim() !== '') ?? '';
  const sep =
    (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  let header: Map<number, Field> | null = null;
  let headCount = 0;
  const out = new Collector(fileName);
  csvRows(
    text,
    sep,
    (fields, line) => {
      if (header === null) {
        const heads: string[] = [];
        for (const [k, v] of fields) heads[k] = v;
        headCount = heads.length;
        if (heads.every((h) => (h ?? '').trim() === '')) return true;
        header = mapHeader(
          heads.map((h) => h ?? ''),
          fileName,
        );
        return true;
      }
      const values: Partial<Record<Field, string>> = {};
      for (const [k, f] of header) values[f] = fields.get(k) ?? '';
      out.add(line, values);
      return true;
    },
    // Kopfzeile ganz (nur Spaltennamen), danach nur die vier zugeordneten Spalten.
    (i) => header === null || header.has(i),
  );
  if (header === null) {
    fail(
      'empty',
      fileName,
      '«{datei}» ist leer.',
      'Eine Liste mit der Kopfzeile Grad, Name, Vorname, Funktion wählen.',
    );
  }
  return {
    persons: out.persons,
    skippedRows: out.skipped,
    droppedColumnCount: Math.max(0, headCount - (header as Map<number, Field>).size),
  };
}

// ---------------------------------------------------------------------------------------------------------
// Excel (.xlsx, erstes Blatt): nur die Kopfzeile und die vier Spalten werden dekodiert
// ---------------------------------------------------------------------------------------------------------

function columnIndex(ref: string): number {
  const letters = /^[A-Z]+/i.exec(ref)?.[0]?.toUpperCase() ?? '';
  let col = 0;
  for (const ch of letters) col = col * 26 + (ch.charCodeAt(0) - 64);
  return col - 1;
}

/** Zeichenverweis ausserhalb von Unicode in einer Zelle: die Arbeitsmappe ist beschädigt (FA2-02). */
class InvalidCharacterReference extends Error {}

function unescapeXml(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e: string) => {
    const k = e.toLowerCase();
    if (k === 'amp') return '&';
    if (k === 'lt') return '<';
    if (k === 'gt') return '>';
    if (k === 'quot') return '"';
    if (k === 'apos') return "'";
    const code = k.startsWith('#x') ? Number.parseInt(k.slice(2), 16) : Number(k.slice(1));
    if (!(code <= 0x10ffff)) throw new InvalidCharacterReference();
    return String.fromCodePoint(code);
  });
}

/** Text der `<t>`-Elemente eines Abschnitts (ohne Lautschrift `<rPh>`). */
function textOf(xml: string): string {
  const noPhonetic = xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '');
  let out = '';
  for (const m of noPhonetic.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g))
    out += unescapeXml(m[1] ?? '');
  return out;
}

interface RawCell {
  readonly col: number;
  readonly type: string;
  readonly body: string;
}

/** Ende des Tags ab `<` bei `start` (Position nach `>`) und ob er sich selbst schliesst. */
function tagEnd(xml: string, start: number): { end: number; selfClosing: boolean } {
  const gt = xml.indexOf('>', start);
  if (gt < 0) return { end: xml.length, selfClosing: true };
  return { end: gt + 1, selfClosing: xml[gt - 1] === '/' };
}

/** Nächster Tag `<name` (nicht `<names…`) ab `from` bis `limit`; −1 wenn keiner. */
function findTag(xml: string, name: string, from: number, limit: number): number {
  let i = xml.indexOf(`<${name}`, from);
  while (i >= 0 && i < limit) {
    const after = xml[i + name.length + 1];
    if (
      after === ' ' ||
      after === '>' ||
      after === '/' ||
      after === '\t' ||
      after === '\n' ||
      after === '\r'
    )
      return i;
    i = xml.indexOf(`<${name}`, i + 1);
  }
  return -1;
}

/**
 * Zellen einer Zeile (Bereich `from`…`to` im Blatt). Gelesen werden nur die Kopfangaben jeder Zelle (Lage, Typ);
 * den Inhalt bildet die Funktion nur für Spalten mit `keep(col)`, alle übrigen werden übersprungen.
 */
function rowCells(
  xml: string,
  from: number,
  to: number,
  keep: (col: number) => boolean,
): RawCell[] {
  const out: RawCell[] = [];
  let next = 0;
  let i = findTag(xml, 'c', from, to);
  while (i >= 0) {
    const head = tagEnd(xml, i);
    const tag = xml.slice(i, head.end);
    const ref = /\br="([^"]+)"/.exec(tag)?.[1];
    const col = ref === undefined ? next : columnIndex(ref);
    next = col + 1;
    let after = head.end;
    let bodyEnd = head.end;
    if (!head.selfClosing) {
      const close = xml.indexOf('</c>', head.end);
      bodyEnd = close < 0 || close > to ? to : close;
      after = bodyEnd + 4;
    }
    if (keep(col))
      out.push({
        col,
        type: /\bt="([^"]+)"/.exec(tag)?.[1] ?? 'n',
        body: xml.slice(head.end, bodyEnd),
      });
    i = findTag(xml, 'c', after, to);
  }
  return out;
}

const badXlsx = (fileName: string): never =>
  fail(
    'invalidFile',
    fileName,
    '«{datei}» konnte nicht als Excel-Arbeitsmappe (.xlsx) gelesen werden.',
    'Die Datei in Excel öffnen, als «Excel-Arbeitsmappe (.xlsx)» speichern und erneut wählen.',
  );

async function readXlsx(bytes: Uint8Array, fileName: string): Promise<PersonImportResult> {
  const bad = () => badXlsx(fileName);
  let book: ZipParts;
  try {
    book = await openZipParts(bytes, (n) =>
      /^(xl\/workbook\.xml|xl\/_rels\/workbook\.xml\.rels)$/i.test(n),
    );
  } catch {
    return bad();
  }
  const workbook = book.text('xl/workbook.xml');
  const rels = book.text('xl/_rels/workbook.xml.rels');
  if (workbook === null || rels === null) return bad();
  const sheetTag = findTag(workbook, 'sheet', 0, workbook.length);
  if (sheetTag < 0) return bad();
  const tag = workbook.slice(sheetTag, tagEnd(workbook, sheetTag).end);
  const firstSheet = /\br:id="([^"]+)"/.exec(tag)?.[1] ?? /\bid="([^"]+)"/.exec(tag)?.[1];
  if (firstSheet === undefined) return bad();
  let target: string | undefined;
  for (const m of rels.matchAll(/<Relationship\b([^>]*)\/?>/g)) {
    const a = m[1] ?? '';
    if (/\bId="([^"]+)"/.exec(a)?.[1] === firstSheet) target = /\bTarget="([^"]+)"/.exec(a)?.[1];
  }
  if (target === undefined) return bad();
  const path = target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`;
  // Nur das erste Blatt und die gemeinsamen Zeichenketten; weitere Blätter bleiben gepackt.
  let parts: ZipParts;
  try {
    parts = await openZipParts(
      bytes,
      (n) => n.toLowerCase() === path.toLowerCase() || /^xl\/sharedStrings\.xml$/i.test(n),
    );
  } catch {
    return bad();
  }
  const sheet = parts.text(path);
  if (sheet === null) return bad();

  // Gemeinsame Zeichenketten: nur die Lage jedes Eintrags; dekodiert werden nur die gewünschten Nummern.
  const sharedXml = parts.text('xl/sharedStrings.xml');
  const sharedAt = (() => {
    let bounds: [number, number][] | null = null;
    return (wanted: ReadonlySet<number>): Map<number, string> => {
      const out = new Map<number, string>();
      if (sharedXml === null) return out;
      if (bounds === null) {
        bounds = [];
        let i = findTag(sharedXml, 'si', 0, sharedXml.length);
        while (i >= 0) {
          const head = tagEnd(sharedXml, i);
          if (head.selfClosing) {
            bounds.push([head.end, head.end]);
            i = findTag(sharedXml, 'si', head.end, sharedXml.length);
            continue;
          }
          const close = sharedXml.indexOf('</si>', head.end);
          const end = close < 0 ? sharedXml.length : close;
          bounds.push([head.end, end]);
          i = findTag(sharedXml, 'si', end, sharedXml.length);
        }
      }
      for (const k of wanted) {
        const b = bounds[k];
        if (b !== undefined) out.set(k, textOf(sharedXml.slice(b[0], b[1])));
      }
      return out;
    };
  })();
  // Zeilen: nur ihre Lage im Blatt.
  const rows: { readonly rowNo: number; readonly from: number; readonly to: number }[] = [];
  {
    let i = findTag(sheet, 'row', 0, sheet.length);
    while (i >= 0) {
      const head = tagEnd(sheet, i);
      const rowNo = Number(/\br="(\d+)"/.exec(sheet.slice(i, head.end))?.[1] ?? '0');
      if (head.selfClosing) {
        i = findTag(sheet, 'row', head.end, sheet.length);
        continue;
      }
      const close = sheet.indexOf('</row>', head.end);
      const to = close < 0 ? sheet.length : close;
      rows.push({ rowNo, from: head.end, to });
      i = findTag(sheet, 'row', to, sheet.length);
    }
  }
  const cellText = (c: RawCell, shared: ReadonlyMap<number, string>): string => {
    if (c.type === 's') {
      const k = Number(/<v>([\s\S]*?)<\/v>/.exec(c.body)?.[1] ?? '-1');
      return shared.get(k) ?? '';
    }
    if (c.type === 'inlineStr') return textOf(/<is>([\s\S]*?)<\/is>/.exec(c.body)?.[1] ?? '');
    return unescapeXml(/<v>([\s\S]*?)<\/v>/.exec(c.body)?.[1] ?? '');
  };
  const sharedIndices = (cells: readonly RawCell[]): Set<number> =>
    new Set(
      cells
        .filter((c) => c.type === 's')
        .map((c) => Number(/<v>([\s\S]*?)<\/v>/.exec(c.body)?.[1] ?? '-1')),
    );

  let header: Map<number, Field> | null = null;
  let headCount = 0;
  const out = new Collector(fileName);
  for (const { rowNo, from, to } of rows) {
    if (header === null) {
      // Kopfzeile: die erste Zeile mit Inhalt; nur sie wird ganz gelesen (Spaltennamen).
      const cells = rowCells(sheet, from, to, () => true);
      const shared = sharedAt(sharedIndices(cells));
      const heads: string[] = [];
      for (const c of cells) heads[c.col] = cellText(c, shared);
      if (heads.every((h) => (h ?? '').trim() === '')) continue;
      headCount = heads.length;
      header = mapHeader(
        Array.from(heads, (h) => h ?? ''),
        fileName,
      );
      continue;
    }
    const map = header;
    const cells = rowCells(sheet, from, to, (col) => map.has(col));
    const shared = sharedAt(sharedIndices(cells));
    const values: Partial<Record<Field, string>> = {};
    for (const c of cells) {
      const f = map.get(c.col);
      if (f !== undefined) values[f] = cellText(c, shared);
    }
    out.add(rowNo, values);
  }
  if (header === null) {
    fail(
      'empty',
      fileName,
      'Das erste Blatt von «{datei}» ist leer.',
      'Eine Liste mit der Kopfzeile Grad, Name, Vorname, Funktion im ersten Blatt wählen.',
    );
  }
  return {
    persons: out.persons,
    skippedRows: out.skipped,
    droppedColumnCount: Math.max(0, headCount - (header as Map<number, Field>).size),
  };
}

/**
 * Liest eine Personenliste: `.csv` (`;` oder `,`) oder `.xlsx` (erstes Blatt), Kopfzeile Pflicht (Vertrag E1-09
 * §1). Andere Formate werden mit Meldung abgelehnt. Asynchron, weil das Entpacken der Arbeitsmappe die
 * Web-Schnittstelle DecompressionStream verwendet (Abweichung vom Vertragsentwurf E1-09 §2: dort synchron).
 */
export async function readPersonFile(
  bytes: Uint8Array,
  fileName: string,
): Promise<PersonImportResult> {
  const lower = fileName.toLowerCase();
  if (bytes.byteLength > MAX_BYTES) {
    fail(
      'invalidFile',
      fileName,
      '«{datei}» ist grösser als 10 MB und keine Personenliste.',
      'Nur die Spalten Grad, Name, Vorname und Funktion in eine eigene Datei übernehmen.',
    );
  }
  if (lower.endsWith('.csv') || lower.endsWith('.txt')) return readCsv(bytes, fileName);
  if (lower.endsWith('.xlsx'))
    return readXlsx(bytes, fileName).catch((e: unknown) =>
      e instanceof InvalidCharacterReference ? badXlsx(fileName) : Promise.reject(e),
    );
  if (lower.endsWith('.xls')) {
    fail(
      'unsupportedFormat',
      fileName,
      '«{datei}» ist im alten Excel-Format (.xls).',
      'Die Datei in Excel öffnen, als «Excel-Arbeitsmappe (.xlsx)» speichern und erneut wählen.',
    );
  }
  return fail(
    'unsupportedFormat',
    fileName,
    '«{datei}» ist keine CSV- oder Excel-Datei.',
    'Eine Liste als .csv oder .xlsx mit der Kopfzeile Grad, Name, Vorname, Funktion wählen.',
  );
}
