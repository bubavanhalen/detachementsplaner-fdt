// F-ABDECKUNG2: kleiner ZIP-Baukasten für fiktive Personenlisten (.xlsx) mit gezielten Schäden (falsche Signaturen,
// unbekannte Packmethode, zu kurze Daten). Ohne Produktcode; Deflate über node:zlib. Nur erfundene Inhalte.
import { deflateRawSync } from 'node:zlib';

export interface ZipPart {
  readonly name: string;
  readonly text: string;
  /** 0 gespeichert, 8 Deflate (Vorgabe), andere Werte unverändert gespeichert (z.B. 12 = bzip2, nicht lesbar). */
  readonly method?: number;
}

export interface ZipDamage {
  /** Signatur des lokalen Kopfs des ersten Teils ersetzen. */
  readonly localSignature?: number;
  /** Signatur des ersten Eintrags im zentralen Verzeichnis ersetzen. */
  readonly centralSignature?: number;
  /** Gepackte Grösse des ersten Teils im zentralen Verzeichnis um so viele Bytes erhöhen. */
  readonly extraCompressedSize?: number;
  /** Ende-Kennung (EOCD) weglassen. */
  readonly withoutEnd?: boolean;
}

const enc = new TextEncoder();

/** ZIP mit den Teilen in dieser Reihenfolge, optional beschädigt. */
export function zipOf(parts: readonly ZipPart[], damage: ZipDamage = {}): Uint8Array {
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  parts.forEach((p, k) => {
    const name = enc.encode(p.name);
    const raw = enc.encode(p.text);
    const method = p.method ?? 8;
    const data = method === 8 ? new Uint8Array(deflateRawSync(raw)) : raw;
    const local = new Uint8Array(30 + name.length + data.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(
      0,
      k === 0 && damage.localSignature !== undefined ? damage.localSignature : 0x04034b50,
      true,
    );
    lv.setUint16(8, method, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, raw.length, true);
    lv.setUint16(26, name.length, true);
    local.set(name, 30);
    local.set(data, 30 + name.length);
    const cd = new Uint8Array(46 + name.length);
    const cv = new DataView(cd.buffer);
    cv.setUint32(
      0,
      k === 0 && damage.centralSignature !== undefined ? damage.centralSignature : 0x02014b50,
      true,
    );
    cv.setUint16(10, method, true);
    cv.setUint32(20, data.length + (k === 0 ? (damage.extraCompressedSize ?? 0) : 0), true);
    cv.setUint32(24, raw.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true);
    cd.set(name, 46);
    locals.push(local);
    centrals.push(cd);
    offset += local.length;
  });
  const cdSize = centrals.reduce((n, c) => n + c.length, 0);
  const end = new Uint8Array(damage.withoutEnd === true ? 0 : 22);
  if (damage.withoutEnd !== true) {
    const ev = new DataView(end.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(8, parts.length, true);
    ev.setUint16(10, parts.length, true);
    ev.setUint32(12, cdSize, true);
    ev.setUint32(16, offset, true);
  }
  const out = new Uint8Array(offset + cdSize + end.length);
  let at = 0;
  for (const b of [...locals, ...centrals, end]) {
    out.set(b, at);
    at += b.length;
  }
  return out;
}

export const WORKBOOK =
  '<workbook xmlns:r="r"><sheets><sheet name="Liste" sheetId="1" r:id="rId1"/><sheet name="Zwei" sheetId="2" r:id="rId2"/></sheets></workbook>';
export const RELS =
  '<Relationships><Relationship Id="rId2" Target="worksheets/sheet2.xml"/><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>';

export const inl = (ref: string, t: string): string =>
  `<c r="${ref}" t="inlineStr"><is><t>${t}</t></is></c>`;

/** Blatt aus Zeilen-XML. */
export const sheetOf = (rows: string): string =>
  `<worksheet><cols><col min="1" max="4" width="12"/></cols><sheetData>${rows}</sheetData></worksheet>`;

export const KOPF = `<row r="1">${inl('A1', 'Grad')}${inl('B1', 'Name')}${inl('C1', 'Vorname')}${inl('D1', 'Funktion')}</row>`;

/** Arbeitsmappe mit erstem Blatt `sheet1`, optional gemeinsamen Zeichenketten und abweichenden Teilen. */
export function bookOf(
  sheet1: string,
  over: {
    readonly shared?: string;
    readonly workbook?: string | null;
    readonly rels?: string | null;
    readonly sheetPath?: string;
    readonly method?: number;
  } = {},
): Uint8Array {
  const parts: ZipPart[] = [];
  const m = over.method === undefined ? {} : { method: over.method };
  if (over.workbook !== null)
    parts.push({ name: 'xl/workbook.xml', text: over.workbook ?? WORKBOOK, ...m });
  if (over.rels !== null)
    parts.push({ name: 'xl/_rels/workbook.xml.rels', text: over.rels ?? RELS, ...m });
  parts.push({ name: over.sheetPath ?? 'xl/worksheets/sheet1.xml', text: sheet1, ...m });
  parts.push({
    name: 'xl/worksheets/sheet2.xml',
    text: sheetOf(`<row r="1">${inl('A1', 'Zweitblatt')}</row>`),
    ...m,
  });
  if (over.shared !== undefined)
    parts.push({ name: 'xl/sharedStrings.xml', text: over.shared, ...m });
  return zipOf(parts);
}
